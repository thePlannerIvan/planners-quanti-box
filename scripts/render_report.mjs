#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { moduleScript } from './lib/planners-modules.mjs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/data.mjs';
import { loadAndValidateSchema } from './lib/schema.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args._[0] || !args.output || !args.judgments || !args.findings || !args.brief) {
  console.error('Usage: node render_report.mjs REPORT_SPEC.json --output report.html [--markdown report.md] --results results.json --findings findings-ledger.json --judgments judgment-ledger.json --brief execution-brief.json [--template path]');
  process.exit(2);
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const list = (items, renderText) => `<ul>${(items ?? []).map((v) => `<li>${renderText(v)}</li>`).join('')}</ul>`;
const tokenPattern = /\{\{metric:([a-z][a-z0-9_-]*)\}\}/g;

function getByPath(root, ref) {
  const parts = String(ref).replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current = root;
  for (const part of parts) {
    if (current == null || !Object.prototype.hasOwnProperty.call(current, part)) throw new Error(`Unknown result_ref: ${ref}`);
    current = current[part];
  }
  return current;
}

function formatNumber(value, digits, notation) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: digits, notation }).format(value);
}

function formatChartNumber(value, item = {}) {
  const digits = Number.isInteger(item.digits) ? item.digits : 1;
  const format = item.format ?? 'number';
  let unit = item.unit ?? '';
  let display;
  if (format === 'percent') {
    if (!item.input_scale) throw new Error('Chart percent values must declare input_scale=fraction|percent.');
    display = formatNumber(item.input_scale === 'fraction' ? value * 100 : value, digits);
    unit = '%';
  } else if (format === 'compact') display = formatNumber(value, digits, 'compact');
  else if (format === 'currency') { display = formatNumber(value, digits); unit ||= '元'; }
  else display = formatNumber(value, digits);
  return { value, display: String(display), unit, formatted: `${display}${unit}` };
}

function resultValue(results, resultId) {
  const binding=results?.results?.[resultId];
  if(!binding)throw new Error(`Unknown result_id: ${resultId}`);
  return binding.value;
}

function compileMetrics(spec, results) {
  return Object.fromEntries(Object.entries(spec.metrics ?? {}).map(([id, metric]) => {
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) throw new Error(`Invalid metric id: ${id}`);
    if (results == null) throw new Error(`Metric ${id} requires --results.`);
    const value = resultValue(results, metric.result_id);
    if (value == null || (typeof value === 'number' && !Number.isFinite(value))) throw new Error(`Metric ${id} resolved to an invalid value.`);
    const digits = Number.isInteger(metric.digits) ? metric.digits : 1;
    const format = metric.format ?? 'number';
    if (metric.unit === '%' && format !== 'percent') throw new Error(`Metric ${id} uses % but does not declare format=percent.`);
    if (format === 'percent' && !metric.input_scale) throw new Error(`Percent metric ${id} must declare input_scale=fraction|percent.`);
    let display;
    let unit = metric.unit ?? '';
    if (metric.display != null) display = metric.display;
    else if (format === 'percent') {
      if (typeof value !== 'number') throw new Error(`Percent metric ${id} must resolve to a number.`);
      display = formatNumber(metric.input_scale === 'fraction' ? value * 100 : value, digits);
      unit = '%';
    } else if (format === 'compact' && typeof value === 'number') display = formatNumber(value, digits, 'compact');
    else if (format === 'currency' && typeof value === 'number') { display = formatNumber(value, digits); unit ||= '元'; }
    else if (typeof value === 'number') display = formatNumber(value, digits);
    else display = String(value);
    return [id, { ...metric, value, format, unit, display: String(display), formatted: `${display}${unit}` }];
  }));
}

function renderSpec(spec, metrics, judgmentMap, findingMap, results) {
  const text = (value) => {
    if (value !== null && typeof value === 'object') throw new Error('Report text cannot render an object value.');
    const source = String(value ?? '');
    let cursor = 0, html = '';
    for (const match of source.matchAll(tokenPattern)) {
      html += esc(source.slice(cursor, match.index));
      const metric = metrics[match[1]];
      if (!metric) throw new Error(`Unknown metric token: ${match[1]}`);
      const tail = source.slice(match.index + match[0].length);
      if (metric.unit && new RegExp(`^\\s*${metric.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(tail)) {
        throw new Error(`Duplicate unit after metric ${match[1]}: ${metric.unit}`);
      }
      html += `<span class="metric" data-metric-id="${esc(match[1])}" data-metric-value="${esc(metric.value)}" data-metric-unit="${esc(metric.unit)}">${esc(metric.formatted)}</span>`;
      cursor = match.index + match[0].length;
    }
    return html + esc(source.slice(cursor));
  };
  const plainText = (value) => String(value ?? '').replace(tokenPattern, (_, id) => {
    if (!metrics[id]) throw new Error(`Unknown metric token: ${id}`);
    return metrics[id].formatted;
  });
  const resolve = (item, prefix = '') => {
    const metricId = item?.[prefix ? `${prefix}_metric` : 'metric'];
    if (metricId) {
      if (!metrics[metricId]) throw new Error(`Unknown chart/table metric: ${metricId}`);
      return { ...metrics[metricId], metricId };
    }
    const value = item?.[prefix || 'value'];
    if (value == null || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Chart/table value is invalid.');
    return typeof value === 'number' ? { ...formatChartNumber(value, item), metricId: null } : { value, formatted: String(value), unit: item?.unit ?? '', metricId: null };
  };
  const hydrateChart = (chart) => {
    const raw = resultValue(results, chart.data_ref);
    if (!Array.isArray(raw) || raw.length === 0) throw new Error(`Chart ${chart.title} data_ref must resolve to a non-empty array.`);
    const decorate = (value) => {
      if (Array.isArray(value)) return value.map(decorate);
      if (!value || typeof value !== 'object') return value;
      const forbidden = ['metric','x_metric','y_metric','size_metric','start_metric','end_metric','low_metric','mid_metric','high_metric'].filter(key=>Object.prototype.hasOwnProperty.call(value,key));
      if (forbidden.length) throw new Error(`Chart ${chart.title} series point uses forbidden scalar metric binding (${forbidden.join(', ')}). Put specific evidence bindings in chart.result_refs and keep point values in the data_ref series.`);
      const out = { ...value, digits: value.digits ?? chart.digits ?? 1, format: value.format ?? chart.format ?? 'number', input_scale: value.input_scale ?? chart.input_scale, unit: value.unit ?? chart.unit ?? '' };
      if (out.segments) out.segments = decorate(out.segments);
      if (out.points) out.points = decorate(out.points);
      return out;
    };
    return { ...chart, data: decorate(raw) };
  };
  const metricAttrs = (resolved) => resolved.metricId ? ` data-metric-id="${esc(resolved.metricId)}" data-metric-value="${esc(resolved.value)}"` : '';
  const niceTicks = (min, max, target = 5) => {
    const raw = Math.abs(max - min) / Math.max(1, target - 1) || 1;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    const normalized = raw / magnitude;
    const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
    const start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
    const out = [];
    for (let v = start; v <= end + step * .001; v += step) out.push(Math.abs(v) < step * .0001 ? 0 : Number(v.toFixed(10)));
    return out;
  };

  function barChart(chart, diverging = false) {
    const data = chart.data.map((d) => ({ ...d, r: resolve(d) })).filter((d) => Number.isFinite(Number(d.r.value)));
    if(data.length!==chart.data.length||data.length===0)throw new Error(`Chart ${chart.title} contains non-numeric or empty data.`);
    const width = 820, rowH = 44, left = 170, right = 92, top = 26, bottom = 34;
    const height = Math.max(170, top + data.length * rowH + bottom);
    const values = data.map((d) => Number(d.r.value));
    let min = diverging ? Math.min(0, ...values, chart.benchmark ?? 0) : 0;
    let max = Math.max(0, ...values, chart.benchmark ?? 0) || 1;
    const axisTicks = niceTicks(min, max); min = axisTicks[0]; max = axisTicks.at(-1);
    const span = max - min || 1, inner = width - left - right;
    const x = (v) => left + inner * (v - min) / span;
    const zero = x(0);
    const grid = axisTicks.map((v) => `<line x1="${x(v)}" y1="${top - 7}" x2="${x(v)}" y2="${height - bottom}" class="grid"/><text x="${x(v)}" y="${height - 10}" text-anchor="middle" class="axis-label">${esc(formatNumber(v, 1))}</text>`).join('');
    const benchmark = Number.isFinite(chart.benchmark) ? `<line x1="${x(chart.benchmark)}" y1="${top - 9}" x2="${x(chart.benchmark)}" y2="${height - bottom}" class="benchmark"/><text x="${x(chart.benchmark) + 5}" y="${top}" class="benchmark-label">${esc(chart.benchmark_label ?? '基准')}</text>` : '';
    const rows = data.map((d, i) => {
      const v = Number(d.r.value), x1 = Math.min(zero, x(v)), w = Math.max(2, Math.abs(x(v) - zero)), y = top + i * rowH;
      const hi = d.highlight === true || chart.highlight === d.label;
      const valueX = v >= 0 ? Math.min(x(v) + 9, width - right + 12) : Math.max(x(v) - 9, left - 4);
      return `<text x="${left - 14}" y="${y + 23}" text-anchor="end" class="chart-label">${esc(d.label)}</text><rect x="${x1}" y="${y + 8}" width="${w}" height="18" class="bar${hi ? ' is-highlight' : ''}"/><text x="${valueX}" y="${y + 22}" text-anchor="${v >= 0 ? 'start' : 'end'}" class="chart-value"${metricAttrs(d.r)}>${esc(d.r.formatted)}</text>`;
    }).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(plainText(chart.alt ?? chart.title))}"><title>${esc(plainText(chart.title))}</title>${grid}${benchmark}${rows}</svg>`;
  }

  function lineChart(chart) {
    const data = chart.data.map((d) => ({ ...d, r: resolve(d) })).filter((d) => Number.isFinite(Number(d.r.value)));
    if(data.length!==chart.data.length||data.length===0)throw new Error(`Chart ${chart.title} contains non-numeric or empty data.`);
    const width = 820, height = 340, left = 78, right = 42, top = 34, bottom = 58;
    const values = data.map((d) => Number(d.r.value));
    let min = Math.min(...values), max = Math.max(...values);
    const pad = (max - min || Math.abs(max) || 1) * .12;
    min = Math.min(0, min - pad); max += pad;
    const yTickValues = niceTicks(min, max); min = yTickValues[0]; max = yTickValues.at(-1);
    const x = (i) => left + (width - left - right) * (data.length <= 1 ? .5 : i / (data.length - 1));
    const y = (v) => top + (height - top - bottom) * (1 - (v - min) / (max - min || 1));
    const yticks = yTickValues.map((v) => `<line x1="${left}" y1="${y(v)}" x2="${width - right}" y2="${y(v)}" class="grid"/><text x="${left - 12}" y="${y(v) + 4}" text-anchor="end" class="axis-label">${esc(formatNumber(v, 1))}</text>`).join('');
    const points = data.map((d, i) => `${x(i)},${y(Number(d.r.value))}`).join(' ');
    const dots = data.map((d, i) => {
      const hi = d.highlight === true || chart.highlight === d.label;
      const show = hi || i === 0 || i === data.length - 1;
      return `<circle cx="${x(i)}" cy="${y(Number(d.r.value))}" r="${hi ? 5 : 3}" class="line-dot${hi ? ' is-highlight' : ''}"${metricAttrs(d.r)}><title>${esc(d.label)}: ${esc(d.r.formatted)}</title></circle>${show ? `<text x="${x(i)}" y="${y(Number(d.r.value)) - 11}" text-anchor="middle" class="chart-value">${esc(d.r.formatted)}</text>` : ''}`;
    }).join('');
    const labels = data.map((d, i) => (i === 0 || i === data.length - 1 || data.length <= 8 || i % Math.ceil(data.length / 6) === 0) ? `<text x="${x(i)}" y="${height - 21}" text-anchor="middle" class="axis-label">${esc(d.label)}</text>` : '').join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(plainText(chart.alt ?? chart.title))}"><title>${esc(plainText(chart.title))}</title>${yticks}<line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" class="axis"/><polyline points="${points}" class="line"/>${dots}${labels}</svg>`;
  }

  function dotChart(chart) {
    const data = chart.data.map((d) => ({ ...d, r: resolve(d) })).filter((d) => Number.isFinite(Number(d.r.value)));
    if(data.length!==chart.data.length||data.length===0)throw new Error(`Chart ${chart.title} contains non-numeric or empty data.`);
    const width = 820, rowH = 44, left = 170, right = 92, top = 26, bottom = 34, height = Math.max(170, top + data.length * rowH + bottom);
    const values = data.map((d) => Number(d.r.value)), axisTicks = niceTicks(Math.min(0, ...values), Math.max(...values, 1)), min = axisTicks[0], max = axisTicks.at(-1), span = max - min || 1;
    const x = (v) => left + (width - left - right) * (v - min) / span;
    const grid = axisTicks.map((v) => `<line x1="${x(v)}" y1="${top - 7}" x2="${x(v)}" y2="${height - bottom}" class="grid"/><text x="${x(v)}" y="${height - 10}" text-anchor="middle" class="axis-label">${esc(formatNumber(v, 1))}</text>`).join('');
    const rows = data.map((d, i) => { const y = top + i * rowH + 18, hi = d.highlight === true || chart.highlight === d.label; return `<text x="${left - 14}" y="${y + 4}" text-anchor="end" class="chart-label">${esc(d.label)}</text><line x1="${left}" y1="${y}" x2="${x(Number(d.r.value))}" y2="${y}" class="dot-stem"/><circle cx="${x(Number(d.r.value))}" cy="${y}" r="${hi ? 7 : 5}" class="dot${hi ? ' is-highlight' : ''}"${metricAttrs(d.r)}/><text x="${x(Number(d.r.value)) + 11}" y="${y + 4}" class="chart-value">${esc(d.r.formatted)}</text>`; }).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${rows}</svg>`;
  }

  function scatterChart(chart) {
    const data = chart.data.map((d) => ({ ...d, x: resolve(d, 'x'), y: resolve(d, 'y') })).filter((d) => Number.isFinite(Number(d.x.value)) && Number.isFinite(Number(d.y.value)));
    if(data.length!==chart.data.length||data.length===0)throw new Error(`Chart ${chart.title} contains non-numeric or empty data.`);
    const width = 820, height = 380, left = 78, right = 42, top = 30, bottom = 62;
    const xs = data.map(d => Number(d.x.value)), ys = data.map(d => Number(d.y.value));
    const xTicks = niceTicks(Math.min(0,...xs),Math.max(...xs,1)), yTicks = niceTicks(Math.min(0,...ys),Math.max(...ys,1));
    const xmin=xTicks[0],xmax=xTicks.at(-1),ymin=yTicks[0],ymax=yTicks.at(-1);
    const x = v => left + (width-left-right)*(v-xmin)/(xmax-xmin||1), y = v => top+(height-top-bottom)*(1-(v-ymin)/(ymax-ymin||1));
    const grid = yTicks.map(v=>`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" class="grid"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const dots = data.map(d=>{const hi=d.highlight===true||chart.highlight===d.label;return `<circle cx="${x(Number(d.x.value))}" cy="${y(Number(d.y.value))}" r="${hi?7:5}" class="dot${hi?' is-highlight':''}"${metricAttrs(d.y)}><title>${esc(d.label)}: ${esc(d.x.formatted)}, ${esc(d.y.formatted)}</title></circle>${hi?`<text x="${x(Number(d.x.value))+10}" y="${y(Number(d.y.value))-8}" class="chart-value">${esc(d.label)}</text>`:''}`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}<line x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}" class="axis"/>${dots}<text x="${(left+width-right)/2}" y="${height-12}" text-anchor="middle" class="axis-label">${esc(chart.x_label??'')}</text></svg>`;
  }

  function dumbbellChart(chart) {
    const data = chart.data.map(d=>({...d,start:resolve(d,'start'),end:resolve(d,'end')}));
    if(data.length===0||data.some(d=>!Number.isFinite(Number(d.start.value))||!Number.isFinite(Number(d.end.value))))throw new Error(`Chart ${chart.title} contains non-numeric or empty data.`);
    const width=820,rowH=48,left=170,right=92,top=26,bottom=34,height=Math.max(170,top+data.length*rowH+bottom);
    const vals=data.flatMap(d=>[Number(d.start.value),Number(d.end.value)]),axisTicks=niceTicks(Math.min(0,...vals),Math.max(...vals,1)),min=axisTicks[0],max=axisTicks.at(-1),span=max-min||1,x=v=>left+(width-left-right)*(v-min)/span;
    const grid=axisTicks.map(v=>`<line x1="${x(v)}" y1="${top-7}" x2="${x(v)}" y2="${height-bottom}" class="grid"/><text x="${x(v)}" y="${height-10}" text-anchor="middle" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const rows=data.map((d,i)=>{const y=top+i*rowH+18;return `<text x="${left-14}" y="${y+4}" text-anchor="end" class="chart-label">${esc(d.label)}</text><line x1="${x(Number(d.start.value))}" y1="${y}" x2="${x(Number(d.end.value))}" y2="${y}" class="dumbbell-line"/><circle cx="${x(Number(d.start.value))}" cy="${y}" r="5" class="dot start"${metricAttrs(d.start)}/><circle cx="${x(Number(d.end.value))}" cy="${y}" r="6" class="dot is-highlight"${metricAttrs(d.end)}/><text x="${x(Number(d.end.value))+10}" y="${y+4}" class="chart-value">${esc(d.end.formatted)}</text>`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${rows}</svg>`;
  }

  function stackedChart(chart, normalized = false) {
    const rows=chart.data.map(row=>({...row,segments:(row.segments??[]).map(s=>({...s,r:resolve(s)}))}));
    if(!rows.length||rows.some(row=>!row.segments.length||row.segments.some(s=>!Number.isFinite(Number(s.r.value)))))throw new Error(`Chart ${chart.title} contains invalid stacked data.`);
    const width=820,rowH=50,left=170,right=70,top=54,bottom=38,height=Math.max(190,top+rows.length*rowH+bottom);
    const totals=rows.map(row=>row.segments.reduce((n,s)=>n+Number(s.r.value),0));
    const max=normalized?1:Math.max(...totals,1),inner=width-left-right;
    const legend=[...new Set(rows.flatMap(row=>row.segments.map(s=>s.label)))].map((label,i)=>`<rect x="${left+i*140}" y="12" width="10" height="10" class="segment-${i%5}"/><text x="${left+16+i*140}" y="21" class="legend-label">${esc(label)}</text>`).join('');
    const body=rows.map((row,i)=>{const total=totals[i]||1,y=top+i*rowH;let cursor=left;const segs=row.segments.map((s,j)=>{const ratio=normalized?Number(s.r.value)/total:Number(s.r.value)/max,w=Math.max(0,inner*ratio),x=cursor;cursor+=w;const label=w>48?`<text x="${x+w/2}" y="${y+20}" text-anchor="middle" class="chart-value">${esc(normalized?formatNumber(ratio*100,1)+'%':s.r.formatted)}</text>`:'';return `<rect x="${x}" y="${y+5}" width="${w}" height="24" class="segment-${j%5}"${metricAttrs(s.r)}/>${label}`}).join('');return `<text x="${left-14}" y="${y+22}" text-anchor="end" class="chart-label">${esc(row.label)}</text>${segs}`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${legend}${body}</svg>`;
  }

  function heatmapChart(chart) {
    const data=chart.data.map(d=>({...d,r:resolve(d)}));
    if(!data.length||data.some(d=>!d.row||!d.column||!Number.isFinite(Number(d.r.value))))throw new Error(`Chart ${chart.title} contains invalid heatmap data.`);
    const rows=[...new Set(data.map(d=>d.row))],cols=[...new Set(data.map(d=>d.column))],width=820,left=150,right=36,top=76,bottom=38,cellW=(width-left-right)/cols.length,cellH=42,height=top+rows.length*cellH+bottom;
    const vals=data.map(d=>Number(d.r.value)),min=Math.min(...vals),max=Math.max(...vals),color=v=>{const t=(v-min)/(max-min||1),l=94-t*55;return `hsl(198 48% ${l}%)`};
    const colLabels=cols.map((c,i)=>`<text x="${left+(i+.5)*cellW}" y="55" text-anchor="middle" class="axis-label">${esc(c)}</text>`).join('');
    const cells=data.map(d=>{const x=left+cols.indexOf(d.column)*cellW,y=top+rows.indexOf(d.row)*cellH,v=Number(d.r.value),dark=(v-min)/(max-min||1)>.58;return `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" class="heat-cell" style="fill:${color(v)}"${metricAttrs(d.r)}/><text x="${x+cellW/2}" y="${y+26}" text-anchor="middle" class="chart-value" style="fill:${dark?'#fff':'#173246'}">${esc(d.r.formatted)}</text>`}).join('');
    const rowLabels=rows.map((r,i)=>`<text x="${left-12}" y="${top+(i+.6)*cellH}" text-anchor="end" class="chart-label">${esc(r)}</text>`).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${colLabels}${rowLabels}${cells}</svg>`;
  }

  function distributionChart(chart, kind) {
    const data=chart.data.map(d=>({...d,r:resolve(d)}));
    if(!data.length||data.some(d=>!Number.isFinite(Number(d.r.value))))throw new Error(`Chart ${chart.title} contains invalid distribution data.`);
    const width=820,height=330,left=72,right=38,top=30,bottom=58,vals=data.map(d=>Number(d.r.value)).sort((a,b)=>a-b),ticks=niceTicks(Math.min(...vals),Math.max(...vals)),xmin=ticks[0],xmax=ticks.at(-1),x=v=>left+(width-left-right)*(v-xmin)/(xmax-xmin||1);
    const grid=ticks.map(v=>`<line x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height-bottom}" class="grid"/><text x="${x(v)}" y="${height-24}" text-anchor="middle" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    let marks='';
    if(kind==='histogram'){
      const bins=Math.max(5,Math.min(20,Math.ceil(Math.sqrt(vals.length)))),span=xmax-xmin||1,counts=Array(bins).fill(0);for(const v of vals)counts[Math.min(bins-1,Math.floor((v-xmin)/span*bins))]++;
      const ymax=Math.max(...counts,1),base=height-bottom;marks=counts.map((n,i)=>{const bx=left+i*(width-left-right)/bins,bw=(width-left-right)/bins-2,bh=(base-top)*n/ymax;return `<rect x="${bx}" y="${base-bh}" width="${bw}" height="${bh}" class="bar${n===ymax?' is-highlight':''}"/><title>${n}</title>`}).join('');
    }else{
      const points=vals.map((v,i)=>`${x(v)},${top+(height-top-bottom)*(1-(i+1)/vals.length)}`).join(' ');marks=`<polyline points="${points}" class="line"/>`;
    }
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${marks}<line x1="${left}" y1="${height-bottom}" x2="${width-right}" y2="${height-bottom}" class="axis"/></svg>`;
  }

  function intervalChart(chart, kind='interval') {
    const data=chart.data.map(d=>({...d,low:resolve(d,'low'),mid:resolve(d,'mid'),high:resolve(d,'high')}));
    if(!data.length||data.some(d=>[d.low,d.mid,d.high].some(v=>!Number.isFinite(Number(v.value)))))throw new Error(`Chart ${chart.title} contains invalid interval data.`);
    const width=820,rowH=52,left=170,right=70,top=30,bottom=40,height=Math.max(180,top+data.length*rowH+bottom),vals=data.flatMap(d=>[Number(d.low.value),Number(d.high.value)]),ticks=niceTicks(Math.min(0,...vals),Math.max(...vals,1)),xmin=ticks[0],xmax=ticks.at(-1),x=v=>left+(width-left-right)*(v-xmin)/(xmax-xmin||1);
    const grid=ticks.map(v=>`<line x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height-bottom}" class="grid"/><text x="${x(v)}" y="${height-12}" text-anchor="middle" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const marks=data.map((d,i)=>{const y=top+i*rowH+19,lo=x(Number(d.low.value)),mi=x(Number(d.mid.value)),hi=x(Number(d.high.value));return `<text x="${left-14}" y="${y+4}" text-anchor="end" class="chart-label">${esc(d.label)}</text>${kind==='box'?`<rect x="${lo}" y="${y-10}" width="${Math.max(2,hi-lo)}" height="20" class="box-fill"/>`:''}<line x1="${lo}" y1="${y}" x2="${hi}" y2="${y}" class="box-line"/><circle cx="${mi}" cy="${y}" r="5" class="dot is-highlight"${metricAttrs(d.mid)}/>`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${marks}</svg>`;
  }

  function bubbleChart(chart, quadrant=false) {
    const data=chart.data.map(d=>({...d,x:resolve(d,'x'),y:resolve(d,'y'),size:d.size_metric||d.size!=null?resolve(d,'size'):{value:1,formatted:'1'}}));
    if(!data.length||data.some(d=>[d.x,d.y,d.size].some(v=>!Number.isFinite(Number(v.value)))))throw new Error(`Chart ${chart.title} contains invalid bubble data.`);
    const width=820,height=390,left=78,right=42,top=32,bottom=62,xs=data.map(d=>Number(d.x.value)),ys=data.map(d=>Number(d.y.value)),sizes=data.map(d=>Math.max(0,Number(d.size.value))),xt=niceTicks(Math.min(0,...xs),Math.max(...xs,1)),yt=niceTicks(Math.min(0,...ys),Math.max(...ys,1)),xmin=xt[0],xmax=xt.at(-1),ymin=yt[0],ymax=yt.at(-1),x=v=>left+(width-left-right)*(v-xmin)/(xmax-xmin||1),y=v=>top+(height-top-bottom)*(1-(v-ymin)/(ymax-ymin||1)),maxSize=Math.max(...sizes,1);
    const grid=yt.map(v=>`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" class="grid"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('')+xt.map(v=>`<text x="${x(v)}" y="${height-27}" text-anchor="middle" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const bench=quadrant?`<line x1="${x(chart.x_benchmark??0)}" y1="${top}" x2="${x(chart.x_benchmark??0)}" y2="${height-bottom}" class="benchmark"/><line x1="${left}" y1="${y(chart.y_benchmark??0)}" x2="${width-right}" y2="${y(chart.y_benchmark??0)}" class="benchmark"/>`:'';
    const dots=data.map((d,i)=>{const r=5+16*Math.sqrt(Number(d.size.value)/maxSize),hi=d.highlight===true||chart.highlight===d.label,show=hi||data.length<=8;return `<circle cx="${x(Number(d.x.value))}" cy="${y(Number(d.y.value))}" r="${r}" class="bubble${hi?' is-highlight':''}"${metricAttrs(d.y)}><title>${esc(d.label)}: ${esc(d.x.formatted)}, ${esc(d.y.formatted)}, n=${esc(d.size.formatted)}</title></circle>${show?`<text x="${x(Number(d.x.value))+r+5}" y="${y(Number(d.y.value))+(i%2?-5:12)}" class="chart-value">${esc(d.label)}</text>`:''}`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${bench}${dots}<text x="${(left+width-right)/2}" y="${height-12}" text-anchor="middle" class="axis-label">${esc(chart.x_label??'')}</text></svg>`;
  }

  function stripChart(chart) {
    const data=chart.data.map(d=>({...d,r:resolve(d)}));
    if(!data.length||data.some(d=>!d.label||!Number.isFinite(Number(d.r.value))))throw new Error(`Chart ${chart.title} contains invalid strip data.`);
    const groups=[...new Set(data.map(d=>d.label))],width=820,height=340,left=80,right=38,top=32,bottom=66,vals=data.map(d=>Number(d.r.value)),ticks=niceTicks(Math.min(0,...vals),Math.max(...vals,1)),xmin=ticks[0],xmax=ticks.at(-1),x=v=>left+(width-left-right)*(v-xmin)/(xmax-xmin||1),y=g=>top+(height-top-bottom)*(groups.indexOf(g)+.5)/groups.length;
    const grid=ticks.map(v=>`<line x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height-bottom}" class="grid"/><text x="${x(v)}" y="${height-25}" text-anchor="middle" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const labels=groups.map(g=>`<text x="${left-12}" y="${y(g)+4}" text-anchor="end" class="chart-label">${esc(g)}</text>`).join('');
    const points=data.map((d,i)=>{const jitter=((i*17)%13-6)*1.4;return `<circle cx="${x(Number(d.r.value))}" cy="${y(d.label)+jitter}" r="4" class="strip-dot"${metricAttrs(d.r)}><title>${esc(d.label)}: ${esc(d.r.formatted)}</title></circle>`}).join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${labels}${points}</svg>`;
  }

  function multiLineChart(chart) {
    const series=chart.data.map((s,si)=>({...s,index:si,points:(s.points??[]).map(p=>({...p,r:resolve(p)}))}));
    if(!series.length||series.some(s=>!s.points.length||s.points.some(p=>!Number.isFinite(Number(p.r.value)))))throw new Error(`Chart ${chart.title} contains invalid series data.`);
    const labels=[...new Set(series.flatMap(s=>s.points.map(p=>p.label)))],width=820,height=360,left=78,right=100,top=34,bottom=62,vals=series.flatMap(s=>s.points.map(p=>Number(p.r.value))),ticks=niceTicks(Math.min(0,...vals),Math.max(...vals,1)),ymin=ticks[0],ymax=ticks.at(-1),x=l=>left+(width-left-right)*(labels.length<=1?.5:labels.indexOf(l)/(labels.length-1)),y=v=>top+(height-top-bottom)*(1-(v-ymin)/(ymax-ymin||1));
    const grid=ticks.map(v=>`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" class="grid"/><text x="${left-12}" y="${y(v)+4}" text-anchor="end" class="axis-label">${esc(formatNumber(v,1))}</text>`).join('');
    const lines=series.map(s=>{const pts=s.points.map(p=>`${x(p.label)},${y(Number(p.r.value))}`).join(' '),last=s.points.at(-1);return `<polyline points="${pts}" class="line series-${s.index%4}"/><text x="${x(last.label)+8}" y="${y(Number(last.r.value))+4}" class="chart-value">${esc(s.label)}</text>`}).join('');
    const xlabels=labels.map((l,i)=>(labels.length<=8||i===0||i===labels.length-1||i%Math.ceil(labels.length/6)===0)?`<text x="${x(l)}" y="${height-22}" text-anchor="middle" class="axis-label">${esc(l)}</text>`:'').join('');
    return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img"><title>${esc(plainText(chart.title))}</title>${grid}${lines}${xlabels}</svg>`;
  }

  function chartRows(chart) {
    if (chart.type === 'scatter') return chart.data.map(d=>[d.label,resolve(d,'x').formatted,resolve(d,'y').formatted]);
    if (['bubble','quadrant'].includes(chart.type)) return chart.data.map(d=>[d.label,resolve(d,'x').formatted,resolve(d,'y').formatted,(d.size_metric||d.size!=null)?resolve(d,'size').formatted:'1']);
    if (chart.type === 'dumbbell') return chart.data.map(d=>[d.label,resolve(d,'start').formatted,resolve(d,'end').formatted]);
    if (['box','interval'].includes(chart.type)) return chart.data.map(d=>[d.label,resolve(d,'low').formatted,resolve(d,'mid').formatted,resolve(d,'high').formatted]);
    if (['stacked-bar','normalized-stacked-bar'].includes(chart.type)) return chart.data.flatMap(d=>d.segments.map(s=>[d.label,s.label,resolve(s).formatted]));
    if (chart.type === 'heatmap') return chart.data.map(d=>[d.row,d.column,resolve(d).formatted]);
    if (chart.type === 'small-multiple-line') return chart.data.flatMap(s=>s.points.map(p=>[s.label,p.label,resolve(p).formatted]));
    return chart.data.map(d=>[d.label,resolve(d).formatted]);
  }

  function chartValues(chart) {
    if (chart.type === 'scatter') return chart.data.flatMap(d=>[resolve(d,'x').value,resolve(d,'y').value]);
    if (['bubble','quadrant'].includes(chart.type)) return chart.data.flatMap(d=>[resolve(d,'x').value,resolve(d,'y').value,(d.size!=null?resolve(d,'size').value:1)]);
    if (['dumbbell','slope'].includes(chart.type)) return chart.data.flatMap(d=>[resolve(d,'start').value,resolve(d,'end').value]);
    if (['box','interval'].includes(chart.type)) return chart.data.flatMap(d=>[resolve(d,'low').value,resolve(d,'mid').value,resolve(d,'high').value]);
    if (['stacked-bar','normalized-stacked-bar'].includes(chart.type)) return chart.data.flatMap(d=>(d.segments??[]).map(s=>resolve(s).value));
    if (chart.type === 'heatmap') return chart.data.map(d=>resolve(d).value);
    if (chart.type === 'small-multiple-line') return chart.data.flatMap(s=>(s.points??[]).map(p=>resolve(p).value));
    return chart.data.map(d=>resolve(d).value);
  }

  function renderChart(chart, index) {
    chart = hydrateChart(chart);
    const svg = chart.type === 'line' ? lineChart(chart) : chart.type === 'dot' ? dotChart(chart) : chart.type === 'diverging-bar' ? barChart(chart,true) : chart.type === 'scatter' ? scatterChart(chart) : chart.type === 'dumbbell' || chart.type === 'slope' ? dumbbellChart(chart) : chart.type === 'stacked-bar' ? stackedChart(chart,false) : chart.type === 'normalized-stacked-bar' ? stackedChart(chart,true) : chart.type === 'heatmap' ? heatmapChart(chart) : chart.type === 'histogram' ? distributionChart(chart,'histogram') : chart.type === 'ecdf' ? distributionChart(chart,'ecdf') : chart.type === 'box' ? intervalChart(chart,'box') : chart.type === 'interval' ? intervalChart(chart,'interval') : chart.type === 'strip' ? stripChart(chart) : chart.type === 'small-multiple-line' ? multiLineChart(chart) : chart.type === 'bubble' ? bubbleChart(chart,false) : chart.type === 'quadrant' ? bubbleChart(chart,true) : barChart(chart);
    const rows = chartRows(chart), heads = ['bubble','quadrant'].includes(chart.type) ? ['项目','X','Y','规模'] : chart.type === 'scatter' ? ['项目','X','Y'] : ['dumbbell','slope'].includes(chart.type) ? ['项目','起点','终点'] : ['box','interval'].includes(chart.type) ? ['项目','下界','中心','上界'] : ['stacked-bar','normalized-stacked-bar'].includes(chart.type) ? ['项目','构成','数值'] : chart.type === 'heatmap' ? ['行','列','数值'] : chart.type === 'small-multiple-line' ? ['系列','时间','数值'] : ['项目','数值'];
    const table = `<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`${i===0?'<th scope="row">':'<td>'}${esc(c)}${i===0?'</th>':'</td>'}`).join('')}</tr>`).join('')}</tbody></table>`;
    const guide=chart.reading_guide,valueFingerprint=sha256(JSON.stringify(chartValues(chart)));
    return `<figure class="chart-card" data-chart-id="chart-${index}" data-view-id="${esc(chart.view_id)}" data-render-values-sha256="${valueFingerprint}"><figcaption><span>${esc(chart.kicker ?? 'DATA VIEW')}</span><h3>${text(chart.title)}</h3>${chart.subtitle?`<p>${text(chart.subtitle)}</p>`:''}<div class="chart-reading-guide" aria-label="读图指引"><b>怎么看</b><ol><li>${text(guide.focus)}</li><li>${text(guide.comparison)}</li><li>${text(guide.signal)}</li></ol></div></figcaption><div class="chart-tools" aria-label="图表导出工具"><button type="button" data-action="copy-data">复制数据</button><button type="button" data-action="download-csv">下载 CSV</button><button type="button" data-action="download-svg">下载 SVG</button><span class="tool-status" aria-live="polite"></span></div>${svg}<details class="data-table"><summary>查看图表数据</summary><div class="table-scroll">${table}</div></details><p class="chart-source">来源：${text(chart.source)} · 分母：${text(chart.denominator)}</p>${chart.note?`<p class="chart-note">${text(chart.note)}</p>`:''}</figure>`;
  }

  const meta = Object.entries(spec.meta ?? {}).map(([k,v])=>`<span><b>${esc(k)}</b>${text(v)}</span>`).join('');
  const kpis = (spec.hero.kpis ?? []).map(k=>{const v=k.metric?metrics[k.metric]?.formatted:k.value;if(k.metric&&!metrics[k.metric])throw new Error(`Unknown KPI metric: ${k.metric}`);return `<article class="kpi"><span>${text(k.label)}</span><strong${k.metric?` data-metric-id="${esc(k.metric)}" data-metric-value="${esc(metrics[k.metric].value)}"`:''}>${esc(v)}</strong><small>${text(k.note??'')}</small></article>`}).join('');
  const sectionIds=new Set(spec.sections.map(s=>s.id));
  const conclusions=spec.hero.conclusions.map((c,i)=>{if(!sectionIds.has(c.target))throw new Error(`Conclusion ${i+1} targets unknown section: ${c.target}`);if(!judgmentMap.has(c.judgment_id))throw new Error(`Conclusion ${i+1} references unknown judgment: ${c.judgment_id}`);return `<a class="conclusion-link" data-judgment-id="${esc(c.judgment_id)}" href="#${esc(c.target)}"><span>${String(i+1).padStart(2,'0')}</span><strong>${text(c.title)}</strong>${c.summary?`<small>${text(c.summary)}</small>`:''}<em>查看证据 →</em></a>`}).join('');
  let chartIndex=0;
  const sections=spec.sections.map((section,index)=>{if(!judgmentMap.has(section.judgment_id))throw new Error(`Section ${section.id} references unknown judgment: ${section.judgment_id}`);const findings=(section.finding_refs??[]).map(id=>{const f=findingMap.get(id);if(!f)throw new Error(`Section references unknown finding: ${id}`);return `<article class="finding" data-finding-id="${esc(f.finding_id)}"><div class="finding-head"><span class="badge ${esc(f.type)}">${esc(f.type)}</span><span class="confidence">${esc(f.robustness_status)}</span></div><h3>${text(f.title)}</h3><p>${text(f.text)}</p>${f.source?`<p class="evidence">数据来源：${text(f.source)}</p>`:''}</article>`}).join('');const charts=(section.charts??[]).map(c=>renderChart(c,++chartIndex)).join('');const table=section.table?`<div class="table-scroll"><table><thead><tr>${section.table.columns.map(c=>`<th>${text(c)}</th>`).join('')}</tr></thead><tbody>${section.table.rows.map(row=>`<tr>${row.map(cell=>{const r=typeof cell==='object'&&cell?.metric?resolve(cell):null;return `<td${r?metricAttrs(r):''}>${r?esc(r.formatted):text(cell)}</td>`}).join('')}</tr>`).join('')}</tbody></table></div>`:'';return `<section id="${esc(section.id)}" data-judgment-id="${esc(section.judgment_id)}" class="${section.appendix?'appendix':''}"><div class="section-number">${section.appendix?'APPENDIX':String(index+1).padStart(2,'0')}</div><h2>${text(section.title)}</h2>${section.lede?`<p class="lede">${text(section.lede)}</p>`:''}<div class="finding-list">${findings}</div>${charts}${table}</section>`}).join('');
  const methods=(spec.methodology??[]).map(m=>`<details><summary>${text(m.title)}</summary><div>${Array.isArray(m.content)?list(m.content,text):`<p>${text(m.content)}</p>`}</div></details>`).join('');
  const actionLabels={direct:'可直接决策','test-first':'先验证','data-needed':'需要补数据','no-action':'暂不行动'};
  const actionBlock=`<p class="hero-action" data-action-status="${esc(spec.hero.action_status)}"><b>${esc(actionLabels[spec.hero.action_status])}</b>${spec.hero.action?text(spec.hero.action):''}</p>`;
  return `<header class="topbar"><div class="brand">QUANTI BOX</div><nav>${spec.sections.filter(s=>!s.appendix).map(s=>`<a href="#${esc(s.id)}">${esc(s.nav??s.title)}</a>`).join('')}</nav><div class="personal-watermark" aria-label="作者水印">{{WATERMARK}}</div></header><main><section class="hero" data-judgment-id="${esc(spec.hero.judgment_id)}"><div class="meta">${meta}</div><p class="eyebrow">${esc(spec.hero.eyebrow??'DECISION REPORT')}</p><h1>${text(spec.hero.headline)}</h1><p class="answer">${text(spec.hero.answer)}</p><ul class="hero-evidence">${spec.hero.evidence.map(v=>`<li>${text(v)}</li>`).join('')}</ul>${actionBlock}<div class="conclusion-links">${conclusions}</div>${kpis?`<div class="kpis">${kpis}</div>`:''}${spec.hero.limitation?`<aside class="limitation"><b>重要边界</b>${text(spec.hero.limitation)}</aside>`:''}</section>${sections}<section id="method" class="method"><div class="section-number">METHOD</div><h2>数据、口径与复算</h2>${methods}</section>${spec.next_steps?.length?`<section class="next"><div class="section-number">NEXT</div><h2>下一步</h2>${list(spec.next_steps,text)}</section>`:''}</main><footer>${text(spec.footer??'本报告由已审核的判断与聚合结果生成。')}</footer>`;
}

function renderMarkdown(spec, metrics, findingMap) {
  const plain=(value)=>String(value??'').replace(tokenPattern,(_,id)=>{
    if(!metrics[id])throw new Error(`Unknown metric token: ${id}`);
    return metrics[id].formatted;
  });
  const lines=[`# ${spec.title}`];
  if(spec.subtitle)lines.push('',spec.subtitle);
  lines.push('',`## ${plain(spec.hero.headline)}`,'',plain(spec.hero.answer));
  if(spec.hero.evidence?.length)lines.push('','### 关键依据',...spec.hero.evidence.map(v=>`- ${plain(v)}`));
  if(spec.hero.action)lines.push('',`**行动状态：${spec.hero.action_status}** — ${plain(spec.hero.action)}`);
  if(spec.hero.limitation)lines.push('',`**重要边界**：${plain(spec.hero.limitation)}`);
  for(const section of spec.sections){
    lines.push('',`## ${plain(section.title)}`);
    if(section.lede)lines.push('',plain(section.lede));
    for(const id of section.finding_refs??[]){
      const f=findingMap.get(id);if(!f)throw new Error(`Section references unknown finding: ${id}`);
      lines.push('',`### ${plain(f.title)}`,'',plain(f.text));
      if(f.source)lines.push('',`数据来源：${plain(f.source)}`);
    }
    for(const c of section.charts??[])lines.push('',`**图表：${plain(c.title)}**  `,`怎么看：${plain(c.reading_guide.focus)} ${plain(c.reading_guide.comparison)} ${plain(c.reading_guide.signal)}  `,`数据来源：${plain(c.source)}；分母：${plain(c.denominator)}。`);
  }
  lines.push('','## 数据、口径与复算');
  for(const m of spec.methodology??[]){
    lines.push('',`### ${plain(m.title)}`);
    if(Array.isArray(m.content))lines.push(...m.content.map(v=>`- ${plain(v)}`));else lines.push('',plain(m.content));
  }
  if(spec.next_steps?.length)lines.push('','## 下一步',...spec.next_steps.map(v=>`- ${plain(v)}`));
  return lines.join('\n')+'\n';
}

try {
  const specText=fs.readFileSync(args._[0],'utf8'),spec=JSON.parse(specText);
  const resultsText=args.results?fs.readFileSync(args.results,'utf8'):null,results=resultsText?JSON.parse(resultsText):null;
  const findingsText=fs.readFileSync(args.findings,'utf8'),findings=JSON.parse(findingsText);
  const briefText=fs.readFileSync(args.brief,'utf8'),brief=JSON.parse(briefText);
  const judgmentsText=fs.readFileSync(args.judgments,'utf8'),judgments=JSON.parse(judgmentsText);
  const here=path.dirname(fileURLToPath(import.meta.url));
  loadAndValidateSchema(path.resolve(here,'../contracts/report-spec.schema.json'),spec,'report-spec');
  loadAndValidateSchema(path.resolve(here,'../contracts/analysis-results.schema.json'),results,'analysis-results');
  loadAndValidateSchema(path.resolve(here,'../contracts/findings-ledger.schema.json'),findings,'findings-ledger');
  loadAndValidateSchema(path.resolve(here,'../contracts/execution-brief.schema.json'),brief,'execution-brief');
  loadAndValidateSchema(path.resolve(here,'../contracts/judgment-ledger.schema.json'),judgments,'judgment-ledger');
  if(judgments.context_id!==brief.context.context_id||findings.context_id!==brief.context.context_id)throw new Error('Findings/judgments are not bound to the execution context.');
  const judgmentIds=judgments.judgments.map(j=>j.judgment_id);if(new Set(judgmentIds).size!==judgmentIds.length)throw new Error('Judgment ids must be unique.');
  const judgmentMap=new Map(judgments.judgments.map(j=>[j.judgment_id,j]));
  const reportRefs=[spec.hero.judgment_id,...spec.hero.conclusions.map(c=>c.judgment_id),...spec.sections.map(s=>s.judgment_id)];
  for(const id of reportRefs)if(!judgmentMap.has(id))throw new Error(`Report references unknown judgment: ${id}`);
  if(spec.hero.headline!==judgmentMap.get(spec.hero.judgment_id).title)throw new Error('Hero headline must exactly reuse the approved judgment title.');
  if(spec.hero.action_status!==judgmentMap.get(spec.hero.judgment_id).action_status)throw new Error('Hero action_status must match the approved judgment.');
  for(const section of spec.sections)if(section.title!==judgmentMap.get(section.judgment_id).title)throw new Error(`Section ${section.id} title must exactly reuse its approved judgment title.`);
  for(const conclusion of spec.hero.conclusions)if(conclusion.title!==judgmentMap.get(conclusion.judgment_id).title)throw new Error(`Conclusion title must exactly reuse judgment ${conclusion.judgment_id}.`);
  const findingMap=new Map(findings.findings.map(f=>[f.finding_id,f])),findingIds=new Set(findingMap.keys());
  for(const judgment of judgments.judgments)for(const ref of judgment.fact_refs)if(!findingIds.has(ref))throw new Error(`Judgment ${judgment.judgment_id} references missing finding: ${ref}`);
  const ids=spec.sections.map(s=>s.id); if(new Set(ids).size!==ids.length)throw new Error('Section ids must be unique.');
  const metrics=compileMetrics(spec,results);
  const templatePath=args.template??path.resolve(here,'../assets/report-shell.html');
  const fingerprints=`<meta name="quanti-spec-sha256" content="${sha256(specText)}"><meta name="quanti-results-sha256" content="${sha256(resultsText)}"><meta name="quanti-findings-sha256" content="${sha256(findingsText)}"><meta name="quanti-judgments-sha256" content="${sha256(judgmentsText)}"><meta name="quanti-brief-sha256" content="${sha256(briefText)}">`;
  // 装配归公共件 planners-report-kit（落点、水印、未解析就不写盘）；本 Skill 保留骨架与图表。
  // 内容可能很大（内联 SVG），所以走临时文件而不是命令行参数。
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'quanti-report-'));
  const contentPath=path.join(scratch,'content.html'),mapPath=path.join(scratch,'placeholders.json');
  fs.writeFileSync(contentPath,renderSpec(spec,metrics,judgmentMap,findingMap,results),'utf8');
  fs.writeFileSync(mapPath,JSON.stringify({REPORT_FINGERPRINTS:fingerprints,TITLE:esc(spec.title)}),'utf8');
  const kit=moduleScript('planners-report-kit','scripts/render-report.mjs');
  const assembled=spawnSync(process.execPath,[kit,'--frame',templatePath,'--content',contentPath,'--placeholders',mapPath,'--out',path.resolve(args.output)],{encoding:'utf8'});
  fs.rmSync(scratch,{recursive:true,force:true});
  process.stdout.write(assembled.stdout??'');
  if(assembled.status!==0){process.stderr.write(assembled.stderr??'');process.exit(assembled.status??1);}
  fs.mkdirSync(path.dirname(path.resolve(args.output)),{recursive:true});
  if(args.markdown){fs.mkdirSync(path.dirname(path.resolve(args.markdown)),{recursive:true});fs.writeFileSync(args.markdown,renderMarkdown(spec,metrics,findingMap),'utf8');}
  console.log(`Rendered ${spec.sections.length} section(s), ${judgmentIds.length} judgment(s), ${Object.keys(metrics).length} metric(s), confirmed method ${brief.method_plan.primary_method} -> ${args.output}`);
} catch(error){console.error(error.message);process.exit(1);}

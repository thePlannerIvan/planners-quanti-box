#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/data.mjs';
import { loadAndValidateSchema } from './lib/schema.mjs';

const args=parseArgs(process.argv.slice(2)),runDir=path.resolve(args._[0]??'.'),requested=args.stage??'auto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),file=n=>path.join(runDir,n),exists=n=>fs.existsSync(file(n)),raw=n=>fs.readFileSync(file(n),'utf8'),read=n=>JSON.parse(raw(n)),sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const checks=[],warnings=[];let failures=0;
const check=(name,ok,detail='')=>{checks.push([name,Boolean(ok),detail]);if(!ok)failures++;};
const schema=(contract,name)=>{try{const value=read(name);loadAndValidateSchema(path.join(root,'contracts',contract),value,name);check(`${name} schema`,true);return value}catch(error){check(`${name} schema`,false,error.message);return null}};
const forbiddenPointBindings=new Set(['metric','x_metric','y_metric','size_metric','start_metric','end_metric','low_metric','mid_metric','high_metric']);
const findForbidden=(value,p='value')=>{const out=[];if(Array.isArray(value))value.forEach((v,i)=>out.push(...findForbidden(v,`${p}[${i}]`)));else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(forbiddenPointBindings.has(k))out.push(`${p}.${k}`);if(['segments','points'].includes(k))out.push(...findForbidden(v,`${p}.${k}`));}return out};
const chartValues=(type,data)=>{const num=(v,l)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new Error(`invalid ${l}`);return v};if(type==='scatter')return data.flatMap((d,i)=>[num(d.x,`x[${i}]`),num(d.y,`y[${i}]`)]);if(['bubble','quadrant'].includes(type))return data.flatMap((d,i)=>[num(d.x,`x[${i}]`),num(d.y,`y[${i}]`),d.size==null?1:num(d.size,`size[${i}]`)]);if(['dumbbell','slope'].includes(type))return data.flatMap((d,i)=>[num(d.start,`start[${i}]`),num(d.end,`end[${i}]`)]);if(['box','interval'].includes(type))return data.flatMap((d,i)=>[num(d.low,`low[${i}]`),num(d.mid,`mid[${i}]`),num(d.high,`high[${i}]`)]);if(['stacked-bar','normalized-stacked-bar'].includes(type))return data.flatMap((d,i)=>(d.segments??[]).map((s,j)=>num(s.value,`segments[${i}][${j}]`)));if(type==='small-multiple-line')return data.flatMap((s,i)=>(s.points??[]).map((p,j)=>num(p.value,`points[${i}][${j}]`)));return data.map((d,i)=>num(d.value,`value[${i}]`))};

try{
  for(const n of ['data-profile.json','execution-brief.json','confirmation-record.json'])if(!exists(n))throw new Error(`RUN_DIRECTORY must contain ${n}.`);
  const profile=schema('data-profile.schema.json','data-profile.json'),brief=schema('execution-brief.schema.json','execution-brief.json'),confirmation=schema('confirmation-record.schema.json','confirmation-record.json');
  if(profile&&brief&&confirmation){
    check('CP0 approval bound to exact execution brief',confirmation.proposal_sha256===sha(raw('execution-brief.json')));
    check('CP0 approval bound to data snapshot',confirmation.data_snapshot_sha256===profile.snapshot?.sha256);
    check('CP0 records an explicit approval decision',confirmation.user_confirmation?.decision==='approve');
    check('CP0 preserves the user verbatim',confirmation.user_confirmation?.verbatim?.trim().length>0);
  }
  const stage=requested==='auto'?(exists('analysis-report.html')?'final':exists('report-spec.json')?'preflight':'cp0'):requested;
  if(stage!=='cp0'){
    const required=['analysis-results.json','findings-ledger.json','judgment-ledger.json','report-spec.json'];
    for(const n of required)check(`${n} present`,exists(n));
    const results=exists('analysis-results.json')?schema('analysis-results.schema.json','analysis-results.json'):null;
    const findings=exists('findings-ledger.json')?schema('findings-ledger.schema.json','findings-ledger.json'):null;
    const judgments=exists('judgment-ledger.json')?schema('judgment-ledger.schema.json','judgment-ledger.json'):null;
    const spec=exists('report-spec.json')?schema('report-spec.schema.json','report-spec.json'):null;
    const relation=exists('relation-map.json')?schema('relation-map.schema.json','relation-map.json'):null;
    const views=exists('analytical-views.json')?schema('analytical-views.schema.json','analytical-views.json'):null;
    const manifest=exists('dataset-manifest.json')?schema('dataset-manifest.schema.json','dataset-manifest.json'):null;
    const classification=exists('classification-audit.json')?schema('classification-audit.schema.json','classification-audit.json'):null;
    if(brief?.tier!=='quick'){
      check('standard/deep run has relation map',Boolean(relation));check('standard/deep run has analytical views',Boolean(views));check('standard/deep run has normalized dataset manifest',Boolean(manifest));
      if(manifest&&profile){
        check('dataset manifest bound to CP0 data snapshot',manifest.source_snapshot_sha256===profile.snapshot.sha256);
        const manifestDir=path.dirname(file('dataset-manifest.json')),resolved=manifest.tables.map(t=>path.resolve(manifestDir,t.path));
        check('manifest table paths stay inside run directory',resolved.every(p=>p===runDir||p.startsWith(runDir+path.sep)));
        check('all manifest tables exist',resolved.every(p=>fs.existsSync(p)));
        check('all manifest table hashes match',manifest.tables.every((t,i)=>fs.existsSync(resolved[i])&&sha(fs.readFileSync(resolved[i]))===t.sha256));
      }
    }
    if(results&&brief&&profile){
      check('results bound to data snapshot',results.input.data_snapshot_sha256===profile.snapshot.sha256);
      check('results bound to execution brief',results.input.execution_brief_sha256===sha(raw('execution-brief.json')));
      if(manifest)check('results bound to normalized dataset manifest',results.input.dataset_manifest_sha256===sha(raw('dataset-manifest.json')));
      const contracts=new Set(brief.method_plan.metric_contracts.map(m=>m.contract_id));
      check('all results use approved metric contracts',Object.values(results.results).every(r=>contracts.has(r.contract_id)));
    }
    let expected=[];
    if(spec&&results&&findings&&judgments&&brief){
      const resultIds=new Set(Object.keys(results.results)),findingMap=new Map(findings.findings.map(f=>[f.finding_id,f])),findingIds=new Set(findingMap.keys()),judgmentMap=new Map(judgments.judgments.map(j=>[j.judgment_id,j])),sections=spec.sections??[];
      check('findings and judgments share confirmed context',findings.context_id===brief.context.context_id&&judgments.context_id===brief.context.context_id);
      check('finding result references close',findings.findings.every(f=>f.result_refs.every(id=>resultIds.has(id))));
      check('failed findings cannot enter judgments',judgments.judgments.every(j=>j.fact_refs.every(id=>findingMap.get(id)?.robustness_status!=='failed')));
      if(brief.method_plan.primary_method.includes('classification')||brief.method_plan.secondary_methods.some(m=>m.includes('classification'))){
        check('deep classification has an audit record',Boolean(classification));
        if(classification?.status!=='passed')check('unpassed classification only yields exploratory judgments',judgments.judgments.every(j=>j.claim_status==='exploratory'));
      }
      check('judgment finding references close',judgments.judgments.every(j=>j.fact_refs.every(id=>findingIds.has(id))));
      check('report finding references close',sections.every(s=>(s.finding_refs??[]).every(id=>findingIds.has(id))));
      check('report judgment references close',[spec.hero.judgment_id,...spec.hero.conclusions.map(c=>c.judgment_id),...sections.map(s=>s.judgment_id)].every(id=>judgmentMap.has(id)));
      check('approved judgment titles reused',spec.hero.headline===judgmentMap.get(spec.hero.judgment_id)?.title&&sections.every(s=>s.title===judgmentMap.get(s.judgment_id)?.title));
      check('report scalar bindings resolve',Object.values(spec.metrics).every(m=>resultIds.has(m.result_id)&&results.results[m.result_id].kind==='scalar'));
      const charts=sections.flatMap(s=>s.charts??[]),series=charts.map(c=>results.results[c.data_ref]);
      check('chart result references resolve',series.every(r=>r?.kind==='series'&&Array.isArray(r.value)&&r.value.length));
      check('chart result_refs close',charts.every(c=>c.result_refs.every(id=>resultIds.has(id))));
      check('charts explain how to read evidence',charts.every(c=>c.reading_guide.focus.trim()&&c.reading_guide.comparison.trim()&&c.reading_guide.signal.trim()));
      check('charts bind retained views',!views||charts.every(c=>views.views.some(v=>v.view_id===c.view_id&&['keep','appendix'].includes(v.status))));
      const forbidden=series.flatMap((r,i)=>r?findForbidden(r.value,charts[i].data_ref):[]);check('chart series avoid scalar metric bindings',forbidden.length===0,forbidden.join(', '));
      try{expected=charts.map((c,i)=>sha(JSON.stringify(chartValues(c.type,series[i].value))));check('chart series value shapes are valid',true)}catch(error){check('chart series value shapes are valid',false,error.message)}
    }
    if(stage==='preflight')check('preflight does not require rendered files',true);
    if(stage==='final'){
      for(const n of ['analysis-report.html','analysis-report.md'])check(`${n} present`,exists(n));
      if(exists('analysis-report.html')){
        const html=raw('analysis-report.html'),meta=n=>html.match(new RegExp(`<meta\\s+name=["']${n}["']\\s+content=["']([^"']+)["']`,'i'))?.[1];
        for(const [n,f] of [['quanti-spec-sha256','report-spec.json'],['quanti-results-sha256','analysis-results.json'],['quanti-findings-sha256','findings-ledger.json'],['quanti-judgments-sha256','judgment-ledger.json'],['quanti-confirmation-sha256','confirmation-record.json'],['quanti-brief-sha256','execution-brief.json']])check(`HTML ${n.replace('quanti-','')} fingerprint`,meta(n)===sha(raw(f)));
        check('HTML basic structure',/<!doctype html>/i.test(html)&&/<main[\s>]/i.test(html)&&/<h1[\s>]/i.test(html));
        check('personal header watermark',/personal-watermark[\s\S]*?阿祖不看红绿灯 · demyth\.info/i.test(html));
        check('offline HTML',!/<(?:script|link)[^>]+https?:\/\//i.test(html));
        check('no unresolved output',!/\{\{[A-Z0-9_:.-]+\}\}|(?:>\s*|=["'])(?:NaN|Infinity|undefined|null|\[object Object\])(?:\s*<|["'])/i.test(html));
        const rendered=[...html.matchAll(/class="chart-card"[^>]*data-render-values-sha256="([a-f0-9]{64})"/g)].map(m=>m[1]);check('rendered chart values match result series',expected.length===rendered.length&&rendered.every((v,i)=>v===expected[i]));
      }
    }
  }
  for(const [name,ok,detail] of checks)console.log(`${ok?'PASS':'FAIL'} ${name}${detail?` — ${detail}`:''}`);for(const w of warnings)console.log(`WARN ${w}`);
  if(failures)throw new Error(`${failures} validation check(s) failed.`);
  console.log(`PASS official QuantiBox ${stage} validation (${checks.length} checks). It proves bindings and rendering integrity, not method fit or judgment quality.`);
}catch(error){console.error(error.message);process.exit(1)}

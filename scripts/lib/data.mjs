import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) out._.push(token);
    else {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i += 1; }
    }
  }
  return out;
}

export function parseDelimited(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  while (rows.length && rows.at(-1).every((v) => v === '')) rows.pop();
  if (!rows.length) return [];
  const headers = rows[0].map((v, i) => v.trim() || `column_${i + 1}`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}

function normalizeJson(value) {
  if (Array.isArray(value)) return value.filter((v) => v && typeof v === 'object' && !Array.isArray(v));
  if (value && Array.isArray(value.data)) return normalizeJson(value.data);
  if (value && Array.isArray(value.rows)) return normalizeJson(value.rows);
  throw new Error('JSON must be an array of objects or contain a data/rows array.');
}

export function loadRows(input, options = {}) {
  if (!fs.existsSync(input)) throw new Error(`Input does not exist: ${input}`);
  const ext = path.extname(input).toLowerCase();
  if (['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods'].includes(ext)) {
    const args = ['excel', '--quiet', '--sheet', String(options.sheet ?? 0), input];
    const proc = spawnSync('qsv', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    if (proc.status !== 0) throw new Error(`qsv excel failed: ${(proc.stderr || proc.stdout).trim()}`);
    return parseDelimited(proc.stdout, ',');
  }
  const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
  if (ext === '.json') return normalizeJson(JSON.parse(text));
  if (ext === '.jsonl' || ext === '.ndjson') {
    return text.split(/\r?\n/).filter(Boolean).map((line, i) => {
      const value = JSON.parse(line);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`JSONL line ${i + 1} is not an object.`);
      return value;
    });
  }
  if (ext === '.tsv') return parseDelimited(text, '\t');
  if (ext === '.csv' || ext === '.txt') return parseDelimited(text, ext === '.txt' && text.includes('\t') ? '\t' : ',');
  throw new Error(`Unsupported input format: ${ext || '(none)'}`);
}

export function writeJson(output, value) {
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).trim().replace(/,/g, '').replace(/[%元¥]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

export function quantile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

export function summarizeNumbers(values) {
  const nums = values.map(toNumber).filter((v) => v !== null).sort((a, b) => a - b);
  if (!nums.length) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    count: nums.length,
    min: nums[0],
    q1: quantile(nums, 0.25),
    median: quantile(nums, 0.5),
    mean: sum / nums.length,
    q3: quantile(nums, 0.75),
    max: nums.at(-1),
    sum,
    zeros: nums.filter((v) => v === 0).length,
    negatives: nums.filter((v) => v < 0).length,
  };
}

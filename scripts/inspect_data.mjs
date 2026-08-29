#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRows, parseArgs, summarizeNumbers, toNumber, writeJson } from './lib/data.mjs';
import { loadAndValidateSchema } from './lib/schema.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args._[0] || !args.output) {
  console.error('Usage: node inspect_data.mjs INPUT --output data-profile.json [--sheet 0] [--unique-limit 10000]');
  process.exit(2);
}

try {
  const input = path.resolve(args._[0]);
  const rows = loadRows(input, { sheet: args.sheet ?? 0 });
  if (!rows.length) throw new Error('Input contains no data rows.');
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const uniqueLimit = Number(args['unique-limit'] ?? 10000);
  const profile = columns.map((name) => {
    const values = rows.map((row) => row[name]);
    const nonEmpty = values.filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const numericCount = nonEmpty.filter((v) => toNumber(v) !== null).length;
    const unique = new Set(nonEmpty.slice(0, uniqueLimit).map((v) => String(v)));
    const numericShare = nonEmpty.length ? numericCount / nonEmpty.length : 0;
    return {
      name,
      non_null: nonEmpty.length,
      missing: rows.length - nonEmpty.length,
      missing_share: (rows.length - nonEmpty.length) / rows.length,
      inferred_type: numericShare >= 0.9 ? 'number' : 'string',
      numeric_share: numericShare,
      unique_count_observed: unique.size,
      unique_count_capped: nonEmpty.length > uniqueLimit,
      sample_values: [...unique].slice(0, 8),
      numeric_summary: numericShare >= 0.9 ? summarizeNumbers(nonEmpty) : null,
    };
  });
  const result = {
    schema_version: '1.1',
    input,
    sheet: args.sheet ?? 0,
    snapshot: {
      sha256: crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),
      bytes: fs.statSync(input).size,
    },
    row_count: rows.length,
    column_count: columns.length,
    columns: profile,
    generated_at: new Date().toISOString(),
    notes: ['Type inference is mechanical and does not prove business meaning.', 'For large cardinality columns, unique counts may be capped.'],
  };
  const here = path.dirname(fileURLToPath(import.meta.url));
  loadAndValidateSchema(path.resolve(here, '../contracts/data-profile.schema.json'), result, 'data-profile');
  writeJson(args.output, result);
  console.log(`Profiled ${rows.length} rows x ${columns.length} columns -> ${args.output}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

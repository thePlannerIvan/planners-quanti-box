#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runDir=path.resolve(process.argv[2]??'.'),root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=[path.join(runDir,'report-spec.json'),'--results',path.join(runDir,'analysis-results.json'),'--findings',path.join(runDir,'findings-ledger.json'),'--judgments',path.join(runDir,'judgment-ledger.json'),'--brief',path.join(runDir,'execution-brief.json'),'--output',path.join(runDir,'analysis-report.html'),'--markdown',path.join(runDir,'analysis-report.md')];
const result=spawnSync(process.execPath,[path.join(root,'scripts/render_report.mjs'),...args],{encoding:'utf8'});
process.stdout.write(result.stdout);process.stderr.write(result.stderr);process.exit(result.status??1);

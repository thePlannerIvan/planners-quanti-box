#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),temp=fs.mkdtempSync(path.join(os.tmpdir(),'quanti-contract-test-')),fixture=n=>path.join(root,'evals/fixtures',n);
const run=(script,args,expected=0)=>{const r=spawnSync(process.execPath,[path.join(root,'scripts',script),...args],{encoding:'utf8'});if(r.status!==expected){process.stderr.write(r.stdout+r.stderr);throw new Error(`${script} returned ${r.status}; expected ${expected}`)}};
try{
  const runDir=path.join(temp,'run');fs.mkdirSync(runDir);
  const confirmation=JSON.parse(fs.readFileSync(fixture('smoke-confirmation.json'),'utf8'));
  const profile={schema_version:'1.1',input:'fixture',snapshot:{sha256:confirmation.data_snapshot_sha256,bytes:0},row_count:8,column_count:2,columns:[{name:'channel',non_null:8,missing:0,inferred_type:'string'}]};
  fs.writeFileSync(path.join(runDir,'data-profile.json'),JSON.stringify(profile));
  fs.copyFileSync(fixture('smoke-execution-brief.json'),path.join(runDir,'execution-brief.json'));
  fs.copyFileSync(fixture('smoke-confirmation.json'),path.join(runDir,'confirmation-record.json'));
  run('validate_run.mjs',[runDir,'--stage','cp0']);
  const bad={...confirmation,proposal_sha256:'f'.repeat(64)};fs.writeFileSync(path.join(runDir,'confirmation-record.json'),JSON.stringify(bad));run('validate_run.mjs',[runDir,'--stage','cp0'],1);
  console.log('PASS v3 contracts (exact proposal approval binding accepted; mismatched approval rejected)');
}finally{fs.rmSync(temp,{recursive:true,force:true})}

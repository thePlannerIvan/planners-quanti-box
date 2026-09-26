#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { loadRows, parseArgs } from './lib/data.mjs';

const args=parseArgs(process.argv.slice(2));if(!args._.length||!args.output){console.error('Usage: node normalize_data.mjs INPUT [INPUT ...] --output normalized-dataset.jsonl [--manifest dataset-manifest.json] [--source-snapshot PROFILE_SHA256] [--table-id observations] [--observation-unit record] [--sheet 0] [--entity-key noteId] [--canonical-policy keep-all|first|group-entity] [--source-index source-index.json] [--coverage-status full|partial|sampled|excluded|unread] [--coverage-scope ...] [--impact ...]');process.exit(2)}
try{
  const inputs=args._.map(value=>path.resolve(value)),sources=inputs.map((input,source_index)=>{const rows=loadRows(input,{sheet:args.sheet??0}),hash=crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');return {input,rows,hash,bytes:fs.statSync(input).size,source_index,source_group:path.basename(input,path.extname(input))}});
  if(sources.some(s=>!s.rows.length))throw new Error('Every input must contain at least one row.');
  const seen=new Set(),normalized=sources.flatMap(source=>source.rows.map((row,index)=>{const clean=Object.fromEntries(Object.entries(row).map(([k,v])=>[String(k).trim(),typeof v==='string'?v.trim():v]));const base=`${source.source_index}:${source.hash}:${args.sheet??0}:${index+1}`,rowId=`r_${crypto.createHash('sha256').update(base).digest('hex').slice(0,16)}`;if(seen.has(rowId))throw new Error(`Duplicate row_id ${rowId}`);seen.add(rowId);return {row_id:rowId,source_file:source.input,source_group:source.source_group,source_row:index+2,...clean}}));
  const entityKey=args['entity-key'],policy=args['canonical-policy']??'keep-all';if(!['keep-all','first','group-entity'].includes(policy))throw new Error('canonical-policy must be keep-all, first, or group-entity.');
  const duplicateSummary={entity_key:entityKey??null,policy,total_rows:normalized.length,unique_entities:null,duplicate_rows:0};
  if(entityKey){const counts=new Map();for(const row of normalized){const id=String(row[entityKey]??'').trim();if(!id)continue;counts.set(id,(counts.get(id)??0)+1)}duplicateSummary.unique_entities=counts.size;duplicateSummary.duplicate_rows=[...counts.values()].reduce((n,c)=>n+Math.max(0,c-1),0);const canonicalSeen=new Set();for(const row of normalized){const id=String(row[entityKey]??'').trim(),key=policy==='group-entity'?`${row.source_group}\u0000${id}`:id;row.duplicate_entity=id?((counts.get(id)??0)>1):false;row.canonical_sample=policy==='keep-all'||!id||!canonicalSeen.has(key);if(id)canonicalSeen.add(key)}}else for(const row of normalized)row.canonical_sample=true;
  const out=path.resolve(args.output);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,normalized.map(r=>JSON.stringify(r)).join('\n')+'\n','utf8');
  const combinedHash=crypto.createHash('sha256').update(sources.map(s=>`${s.source_index}:${s.input}:${s.hash}`).join('\n')).digest('hex'),outputHash=crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');
  const audit={schema_version:'1.1',inputs:sources.map(({input,hash,bytes,source_index,source_group,rows})=>({input,snapshot_sha256:hash,bytes,source_index,source_group,row_count:rows.length})),combined_snapshot_sha256:combinedHash,sheet:args.sheet??0,row_count:normalized.length,row_id_rule:'sha256(source_index:source_hash:sheet:data_row_index)[0:16]',duplicate_summary:duplicateSummary,canonical_sample_rule:policy,output:out,generated_at:new Date().toISOString()};fs.writeFileSync(`${out}.audit.json`,JSON.stringify(audit,null,2)+'\n','utf8');
  const sourceSnapshot=args['source-snapshot']??combinedHash;if(!/^[a-f0-9]{64}$/.test(sourceSnapshot))throw new Error('--source-snapshot must be a 64-character lowercase SHA-256.');
  const manifest={schema_version:'1.0',source_snapshot_sha256:sourceSnapshot,tables:[{table_id:args['table-id']??'observations',path:path.relative(path.dirname(path.resolve(args.manifest??path.join(path.dirname(out),'dataset-manifest.json'))),out)||path.basename(out),sha256:outputHash,row_count:normalized.length,observation_unit:args['observation-unit']??'record'}]};const manifestPath=path.resolve(args.manifest??path.join(path.dirname(out),'dataset-manifest.json'));fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n','utf8');
  // 来源索引 = **文件级**账目（哈希 / 字节 / 覆盖 / 锚点）；表级账目仍在 dataset-manifest 里。
  // 契约与校验器都在公共件 planners-source-index（source-index/2.0.0），这里只负责写成那个形状。
  const coverageStatus=args['coverage-status']??'full';
  if(!['full','partial','sampled','excluded','unread'].includes(coverageStatus))throw new Error('--coverage-status must be full, partial, sampled, excluded, or unread.');
  const indexPath=path.resolve(args['source-index']??path.join(path.dirname(manifestPath),'source-index.json'));
  const indexDir=path.dirname(indexPath),cwd=process.cwd();
  const toPosix=value=>value.split(path.sep).join('/');
  // source_root 是「相对索引文件所在目录」的路径；origin.path 再相对它解析。
  const sourceRoot=toPosix(path.relative(indexDir,cwd))||'.';
  const slug=value=>path.basename(value,path.extname(value)).toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'file';
  let cursor=0;
  const sourceIndex={contract_version:'source-index/2.0.0',source_root:sourceRoot,index_sha256:null,
    sources:sources.map(source=>{
      const start=cursor+1;cursor+=source.rows.length;
      const pathHash=crypto.createHash('sha1').update(source.input).digest('hex').slice(0,6);
      return {
        source_id:`src-${slug(source.input)}-${pathHash}`,
        origin:{path:toPosix(path.relative(cwd,source.input)),sha256:source.hash,bytes:source.bytes},
        kind:'workbook',
        role:args['source-role']??`${source.source_group}（规范化输入）`,
        audit_layer:{mode:'normalized_table',path:toPosix(path.relative(indexDir,out)),sha256:outputHash,derived_from_sha256:source.hash,snapshot_sha256:sourceSnapshot,method:'normalize_data.mjs',anchor_marks:null},
        coverage:{status:coverageStatus,scope:args['coverage-scope']??null,reason:args['coverage-reason']??null,impact_if_incomplete:args.impact??null,counts:{rows:source.rows.length}},
        analysis_unit:args['observation-unit']??'record',
        anchors:[{kind:'normalized-rows',value:`${start}-${cursor}`,note:'本输入在规范化表里的行区间'}],
        conflicts:[],notes:''};
    }),
    blind_spots:[]};
  fs.writeFileSync(indexPath,JSON.stringify(sourceIndex,null,2)+'\n','utf8');console.log(`Normalized ${normalized.length} rows from ${sources.length} input(s); canonical policy=${policy}, duplicate rows=${duplicateSummary.duplicate_rows} -> ${out}; manifest -> ${manifestPath}; source-index -> ${indexPath}`);
}catch(error){console.error(error.message);process.exit(1)}

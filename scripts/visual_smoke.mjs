#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const runDir=path.resolve(process.argv[2]??'.'),htmlPath=path.join(runDir,'analysis-report.html'),outDir=path.join(runDir,'visual-smoke');
if(!fs.existsSync(htmlPath)){console.error('analysis-report.html not found');process.exit(2)}
const require=createRequire(path.join(process.cwd(),'package.json'));let chromium;
try{({chromium}=require('playwright'))}catch(error){console.error('Playwright is required for visual_smoke.mjs');process.exit(2)}
fs.mkdirSync(outDir,{recursive:true});const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await page.goto(pathToFileURL(htmlPath).href,{waitUntil:'load'});
const inspect=async(label)=>page.evaluate((label)=>{const body=document.body,root=document.documentElement,q=s=>document.querySelector(s),rect=e=>e?.getBoundingClientRect(),text=body.innerText;return {label,viewport:innerWidth,scroll_width:Math.max(body.scrollWidth,root.scrollWidth),overflow_x:Math.max(body.scrollWidth,root.scrollWidth)-innerWidth,watermark:Boolean(q('.personal-watermark')),h1:rect(q('h1')),hero:rect(q('.hero')),chart_cards:document.querySelectorAll('.chart-card').length,reading_guides:document.querySelectorAll('.chart-reading-guide').length,charts:[...document.querySelectorAll('.chart-svg')].map((e,i)=>({i,...rect(e),marks:e.querySelectorAll('rect,circle,polyline,line').length})),unresolved:/\{\{|NaN|Infinity|undefined|\[object Object\]/.test(text),long_float:/\d+\.\d{4,}/.test(text)}} ,label);
const results=[];results.push(await inspect('desktop'));await page.screenshot({path:path.join(outDir,'desktop.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});results.push(await inspect('mobile'));await page.screenshot({path:path.join(outDir,'mobile.png'),fullPage:true});
await page.emulateMedia({media:'print'});results.push(await inspect('print'));await page.screenshot({path:path.join(outDir,'print.png'),fullPage:true});await browser.close();
const failures=[];for(const r of results){if(r.overflow_x>1)failures.push(`${r.label} horizontal overflow ${r.overflow_x}px`);if(!r.watermark)failures.push(`${r.label} missing watermark`);if(!r.h1?.width||!r.hero?.height)failures.push(`${r.label} missing first-screen elements`);if(r.unresolved)failures.push(`${r.label} unresolved output`);if(r.long_float)failures.push(`${r.label} contains long float artifacts`);if(r.chart_cards!==r.reading_guides)failures.push(`${r.label} chart reading guide coverage ${r.reading_guides}/${r.chart_cards}`);if(r.charts.some(c=>c.width<120||c.height<80||c.marks===0))failures.push(`${r.label} empty or collapsed chart`);}if(errors.length)failures.push(`console errors: ${errors.join(' | ')}`);
const report={checked_at:new Date().toISOString(),html:htmlPath,results,console_errors:errors,failures};fs.writeFileSync(path.join(outDir,'visual-smoke.json'),JSON.stringify(report,null,2),'utf8');
if(failures.length){for(const f of failures)console.error(`FAIL ${f}`);process.exit(1)}console.log(`PASS visual smoke: desktop + 390px + print; screenshots in ${outDir}`);

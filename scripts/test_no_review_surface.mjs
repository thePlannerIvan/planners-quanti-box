#!/usr/bin/env node
/**
 * 防回退：**本 Skill 的人的决定留在对话里，不上公共审阅缝。**
 *
 * 为什么需要这条（不是"文件今天不存在"的复述）：
 * 这一家的人下决定的唯一地点是 **CP0**（`stages/01-analysis-design.md` 的「给用户的确认界面」），
 * 而它发生在**要求阶段、模型就在对话里的时候**；产物阶段的"审阅"只有阅读
 * （`stages/07-render-and-review.md` 的"最多一次视觉审阅"），不产生决定。
 * `scripts/visual_smoke.mjs` 是**渲染自检**（headless 三段截图 + DOM 断言），全程无人下决定；
 * `contracts/classification-audit.schema.json` 有词表但**没有一个字段是人的决定** ——
 * 它是分析者自己写的记录，缺了只是把 judgment 降级成 `exploratory`（**降级规则不是决定入口**）。
 * 而且这一家**亲手删掉过**"证明 CP0 发生过"的机器（git 8c4be05，删 `confirmation-record.schema.json`
 * 与全部哈希绑定，阶段名 `cp0` 改成 `design`），理由写在 `stages/01-analysis-design.md`：
 * **"CP0 是人的决定，不是机器的状态；机器能验的只有'某个字符串非空'，
 * 那既不能证明批准发生过，也会逼模型写一份看起来像证据的东西。"**
 *
 * 判据写成**扫描式**：这个 Skill 的 scripts / assets / stages / contracts / references / methods / playbooks 里，
 * **任何缝的标志物一出现即红** —— 这样它真的会在"有人把确认机器加回来"的那天红，
 * 而不是靠"这些文件今天本来就不存在"永远为真。
 *
 * 跑法：node scripts/test_no_review_surface.mjs
 */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// 扫**整棵 Skill 树**（不是几个提名目录）：标志物可能出现在任意新目录里
// （例如 review/review-surface.json —— 只扫提名目录就会整个漏掉，而"漏掉"正是这条判据最坏的失败方式）。
const SKIP=new Set(['.git','node_modules','__pycache__']);
const TEXT=new Set(['.mjs','.js','.cjs','.json','.md','.html','.css','.py','.txt','.jsonl']);
// 测试自己必须跳过：**断言里写着标志物字符串**，扫自己就是"永远为真"。
const SELF=path.relative(root,fileURLToPath(import.meta.url));
// 硬红：出现即"缝被接了回来"。
const MARKERS=[
  [/\{\{REVIEW_BRIDGE\}\}/,'桥的注入点（宿主原地替换的裸标记）'],
  [/\bReviewBridge\b/,'公共桥的全局对象'],
  [/\breview-bridge\b/,'公共桥的文件名（页面不许自带副本）'],
  [/\breview[-_]surface\b/,'缝的契约文件（review-surface.json / schema）'],
  [/\bwriteSurface\b/,'缝的生命周期 API'],
  [/(review-host|serve-review|review-inbox)\.mjs/,'缝的宿主（页面不许自带服务器）'],
  [/\bcreateServer\b|\.listen\s*\(/,'页面/脚本不许自带服务器'],
  // 反馈文件与决定词表：本家**没有**任何 feedback 文件，它一旦出现就是缝接回来了。
  [/\bfeedback\b|反馈文件|反馈词表/,'缝的收件文件'],
];
// 软提示：**不是**缝的证据（报告页不在 iframe 里，且已 try/catch），
// 但一旦这页真的被 serve 进不透明帧，顶层读 web storage 会抛异常（验证 13）。
const ADVISORY=[[/localStorage|sessionStorage/,'不透明帧里顶层读 web storage 会抛异常；本家报告页当前不在帧里']];
// 唯一允许说出缝名字的两个地方（豁免**故意写得很窄**，不是放宽判据）：
// ① `planners-modules.mjs` 是一张"有哪些公共件"的名单，它**不是**接缝的证据 —— 名单里有名字 ≠ 这一家用了它。
// ② `SKILL.md` 里**表格中登记这条回归自己**的那一行：那行必须写出标志物字面量（否则读者不知道它在拦什么）；
//    豁免卡的是"含脚本名 + 表格竖线"，所以 SKILL.md 里任何别的接缝写法（包括正文段落里提一句）照样会红。
const ALLOW={'scripts/lib/planners-modules.mjs':[/planners-review-core/],
  // 安装器 MODULE_SPECS 里 review-core 的锚点文件名是"名单"，不是接缝的证据；
  // 只豁免裸的锚点文件名字面量那一行，整文件不豁免 —— 谁真在安装器里接缝照样红。
  'scripts/lib/planners-modules-install.mjs':[/^\s*'[^']*\/(review-surface|review-host)[^']*',?\s*$/],
  'SKILL.md':[/scripts\/test_no_review_surface\.mjs.*\|/]};
const allowed=(rel,line)=>(ALLOW[rel]||[]).some(p=>p.test(line));
const reds=[],notes=[];
function scanFile(file){const rel=path.relative(root,file);if(rel===SELF)return;const base=path.basename(file);
  // 文件名本身就是标志物（不依赖内容）
  if(/^review-surface.*\.json$/.test(base)||/^review[-_]?(feedback|bridge)/i.test(base)){reds.push({rel,why:'缝的标志物文件',text:base});return}
  if(!TEXT.has(path.extname(file).toLowerCase()))return;let text;try{text=fs.readFileSync(file,'utf8')}catch{return}
  text.split('\n').forEach((line,i)=>{const hit=list=>list.find(([p])=>p.test(line));
    const red=hit(MARKERS);if(red&&!allowed(rel,line)){reds.push({rel,line:i+1,why:red[1],text:line.trim().slice(0,160)});return}
    const soft=hit(ADVISORY);if(soft)notes.push({rel,line:i+1,why:soft[1]});});
}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(SKIP.has(e.name))continue;const full=path.join(dir,e.name);if(e.isDirectory())walk(full);else if(e.isFile())scanFile(full)}}
walk(root);
if(notes.length){console.log(`NOTE 软提示 ${notes.length} 处（非缝的证据，不计入红）：`);for(const n of notes)console.log(`  ${n.rel}:${n.line}  [${n.why}]`)}
if(reds.length){console.error('FAIL 本 Skill 的人的决定应留在对话里（CP0 是人的决定，不是机器的状态），但扫描到缝的标志物：');for(const r of reds){console.error(`  ${r.rel}${r.line?`:${r.line}`:''}  [${r.why}]`);if(r.text)console.error(`      ${r.text}`)}console.error(`\n共 ${reds.length} 处。若这是有意接缝，先改 SKILL.md 的「CP0 人工硬门槛」并说明 CP0 的真相源为什么不会变成两份。`);process.exit(1)}
console.log(`PASS no review seam (scanned the whole Skill tree; no bridge, no surface contract, no feedback file, no self-hosted server; advisory ${notes.length})`);

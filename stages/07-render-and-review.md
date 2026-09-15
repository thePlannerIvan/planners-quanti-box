# Stage 7：统一生成、轻量校验与一次视觉审阅

## 目标

从已审 report spec 和 judgment ledger 一次生成 Markdown 与单文件离线 HTML。工程/引用使用一个官方校验器；视觉使用一次确定性 smoke test 和最多一次目检。

## 固定命令

```text
node scripts/validate_run.mjs RUN_DIRECTORY --stage design
node scripts/validate_run.mjs RUN_DIRECTORY --stage preflight
node scripts/render_run.mjs RUN_DIRECTORY
node scripts/validate_run.mjs RUN_DIRECTORY --stage final
node scripts/visual_smoke.mjs RUN_DIRECTORY
```

- `render_run.mjs` 是唯一报告生成入口，同时生成 `analysis-report.html` 和 `analysis-report.md`。
- 不为项目临时写 HTML/Markdown 生成器。
- `validate_run.mjs` 是唯一官方证据/合同校验入口；不重写替代校验器，不多轮用 render 当调试器。
- 渲染前必须一次 preflight 报出全部 schema、metric contract、judgment、finding 和引用问题。

## 官方校验的边界

`validate_run.mjs` 一次检查：

- profile / execution brief / results / findings / judgment / report spec 是否使用官方 schema；
- 报告的数据与方法章节是否写明本次方案的确认范围；
- report → judgment → finding → result → metric contract 引用闭环；
- Standard/Deep results 是否绑定规范化 dataset manifest；
- chart `data_ref` 的 series 不能携带标量 metric binding，series 数值指纹必须与 HTML 渲染值指纹逐图一致；
- HTML 指纹、空图、占位符、NaN、外部依赖与页眉水印。

它不重读完整数据，不证明公式适配、分类正确、用户理解方法、洞察深刻或图表最佳；这些属于专项 Gate、Forward Test 和人工审阅。

## 确定性视觉 smoke test

`visual_smoke.mjs` 默认产生桌面、390px 和打印三个视图，并检查：

- 横向溢出、空图、图表折叠、console error；
- 首屏 h1 / hero、导航、页眉水印和占位符；
- 每张图是否有“怎么看”指引，是否出现四位以上浮点尾数；
- 桌面、窄屏和打印样式的基本可用性。

smoke 不判断美学、信息密度或图表是否真正解释数据关系。

## 最多一次视觉审阅

smoke 通过后，对桌面全页做一次人工或视觉模型审阅，只重点检查：

1. 首屏 20 秒内能否复述数据改变了什么判断；
2. 一张主图是否直接表达关系和基准；
3. 一张最复杂图的标签、刻度、分母与不确定性是否可读；
4. “怎么看”是否真的能把视线引到支持标题的图形证据，而不是复述结论；
5. 从主图随机选两个标签，核对图中值、图下数据表和 `analysis-results.json`；标题宣称差异、排序或翻转时，marks 必须实际出现对应关系；
6. 整体是否仍保持非衬线、精确网格和咨询式直接标注，而不是卡片墙或默认网页图。

只在 smoke/审阅发现异常、使用新图表类型或修改共用模板后再次截图。不做 7–9 张图的逐张多轮 AI 审阅。

## 完成与打开

- 实测一个结论跳转和一种图表导出。
- 从 hero/section 随机抽一条判断，人工回到 finding、metric、dataset、transformation 和 source。
- 完成后直接打开 `analysis-report.html`。若 GUI 需要权限，按环境规则申请，不只提供路径。
- 最终对外发布或将探索性判断升级为组织承诺仍由用户批准。

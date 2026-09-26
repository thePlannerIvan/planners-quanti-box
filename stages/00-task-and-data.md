# Stage 0：数据全景与决策语境

## 这一步在做什么

先读取用户请求、brief、文件结构、字段和少量真实样本，建立数据记录了什么、如何产生、能支持什么证据，以及用户真正要做什么决定。此时不计算正式业务结论。

## 数据全景

- 一行代表谁或什么？是否重复测量、聚合或一对多连接？
- 原始指标、类别、时间、ID、文本和派生字段分别是什么？
- 数据如何采集、抽样、搜索、导出或聚合？代表总体、便利样本还是榜单/上限样本？
- 事件时间、抓取时间和报告时间是否混淆？
- 同名指标是否同口径？分母、单位、预估值和实际值如何区分？
- 缺失、重复、异常、编码和连接将如何改变可回答范围？

## 决策语境

先从用户要求、brief 和项目文件中恢复，不把可以自行发现的内容变成询问表：

- `decision_owner`：谁使用结论。
- `decision_to_make`：要继续、停止、选择或调整什么。
- `current_strategy_or_hypothesis`：当前做法或事先判断。
- `constraints`：不可忽略的时间、预算、渠道、组织、法规或样本限制。
- `success_criteria`：什么变化才有业务意义。
- `context_status`：`confirmed` / `partial` / `unknown`。
- `context_gaps`：哪些未知会改变方法、口径或行动边界。

只询问会实质改变分析设计或建议的缺口。背景不足时可以后续做样本内描述，但不得强行升级为策略建议。

## 工作方式

小表先用 `qsv headers/count/stats/frequency`；Excel 先检查 sheet 与 metadata；JSON 用 `jq` 缩减。需要稳定盘点时运行 `scripts/inspect_data.mjs`，保存原文件 SHA-256 和字节数。调研数据按需读取 `references/survey-quality-gate.md`。

## Evidence Viability Gate

完整读取 `references/relation-discovery.md`，把数据对原决策问题的支持记为 `viable / conditional / fatal`。至少检查：

- 必需结果变量是否存在且有变异；
- 必需分组或时间维度是否有足够取值；
- 观察单位与决策对象是否一致；
- 跨表连接键、粒度、时间和分母是否兼容；
- 采样/搜索/榜单机制是否使原比较失效。

`fatal` 时不默认进入完整 QuantiBox 链。在 CP0 明确推荐停止、所需新数据与可选独立任务；不得用频次分析或文本分类偷换原问题。

## 不要做什么

- 不根据文件名猜代表性。
- 不在看到高低值后直接选方法或写策略。
- 不创建 `analysis-results.json`、正式 finding、judgment 或 HTML。
- 不虚构用户当前策略或成功标准。

## 产物与完成标准

- Standard/Deep 保存 `data-profile.json` 和 `relation-map.json`；Quick 保存 profile，并把决策语境直接进入唯一 `execution-brief.json`。
- **材料没有被整份读入时必须说出来**：规范化那一步会在 `source-index.json` 里给每个输入记覆盖状态；只取一张 Sheet、只抽样、或明确排除的输入，要写成 `partial` / `sampled` / `excluded` 并说明实际读到哪、为什么、会让哪些判断不成立。**没有这个声明，读者只能假定全量。**
- 观察单位、范围、时间、指标、数据生成机制和主要风险已清楚。
- 决策对象、当前策略/假设、约束、成功标准与缺口均有明确状态。
- Validator 只能证明文件和字段存在，不能证明业务语境已被正确理解。

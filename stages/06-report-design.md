# Stage 6：报告与图表设计

## 这一步在做什么

把已审核 judgments 编辑成决策者能快速理解的阅读路径，并为每个关系选择最小有效图表。本阶段不重新发明结论，也不在此时才开始发现数据关系。

## 首屏合同

首屏必须让读者能复述“数据改变了哪个判断”：

- 一条已审核 governing judgment，默认不超过两句。
- 1–3 条 evidence bullets，每条只承担一个事实。
- 一个 `action_status`；不强制 action 存在。
- 0–4 个必要 KPI。
- 1–3 个证据入口。
- “数据来源”和关键边界必须存在，但用小字号和低视觉层级展示。

首屏不塞入方法、次要 finding、指标清单和全部限制。

## 正文编辑

- 一个章节引用一条已审核 `judgment_id`；优先“一项判断 + 一张主图 + 一句边界”。
- 事实、可支持解释、候选解释、行动和限制分开；限制贴近它约束的判断。
- 主报告优先控制在 10 条 judgments/findings、6 张核心图内；其余进 appendix。
- 没有进入 judgment ledger 的探索结果不能通过页面编辑升级为主结论。

## 图表选择

完整读取 `references/chart-selection.md`。每张主图必须用 `view_id` 对应 `analytical-views.json` 中的保留视图。未呈现的 keep / appendix 视图必须登记 `omission_reason`。Chart spec 写清关系、比较基准、重点对象、单位、分母、时间、数据来源、刻度和注释。

每张图必须写一个短 `reading_guide`，不是重复标题，而是按“先看哪里 → 比较什么 → 哪个视觉信号支持结论”解释读图路径：

- `focus`：先看哪个高亮、基准、区间或异常点；
- `comparison`：在什么共同尺度上比较哪些对象；
- `signal`：长度、位置、斜率、颜色或区间如何支持标题中的判断。

三句都要短；不能写“由图可见”“趋势明显”之类空话，也不能引入图中看不到的原因判断。

- 排名：有序条形或点图；普通项灰色，重点项蓝色。
- 两端比较：dumbbell 或 slope。
- 与基准偏离：diverging bar 或 dot + reference line。
- 时间：有 Y 轴刻度、网格、关键点和期间标记的折线。
- 分布：直方、箱线、区间或 strip；不用一根均值柱代替。
- 关联：散点与必要参考线；不连接无序点。
- 构成：`stacked-bar / normalized-stacked-bar`，类别过多时改用 matrix。
- 联合分布：`heatmap`，单元格同时显示值与分母口径。
- 偏态与尾部：`histogram / ecdf`；组间中心和区间用 `box / interval / strip`，不用一根中位数柱代替分布。
- 多组时序：`small-multiple-line`；二维决策地图用 `bubble / quadrant`，必须给出两轴口径和规模含义。

## 数字与引用

- 数字只在 `analysis-results.json` 的 result registry 存一份。report spec 的显示 metric 只引用 scalar `result_id`，图表 `data_ref` 只引用 series result ID，不得内嵌第二份数字。
- 百分比 metric 明确 `format: percent` 与 `input_scale: fraction|percent`。
- 标题、正文和 KPI 复用 report metric token，而每个 token 绑定具体 scalar result。图表 `result_refs` 声明支持图表判断的具体结果，`data_ref` 绑定唯一 series。series point 禁止出现 `metric / x_metric / y_metric / size_metric / start_metric / end_metric / low_metric / mid_metric / high_metric`。
- 章节只保存 `finding_refs`；finding 的标题、正文、类型和来源从正式 ledger 渲染，report spec 不复制第二份。
- Hero 和每个主章节引用存在的 judgment ID；报告不得自造 judgment。

## 产物与完成标准

- 产物：`report-spec.json`。不为每个项目临时编写 HTML 生成脚本，不手工维护第二份 Markdown。
- 每个保留内容都改变理解、判断、行动或不确定性；图表有明确阅读任务。
- 阅读预算、metric / judgment 引用、单位、图表字段和结论 target 合法。
- Validator 不能证明判断真正有效或图是最佳表达。

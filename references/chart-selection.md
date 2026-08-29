# 咨询式图表选择与表达

图表的任务是让比较关系一眼成立，不是展示“这里有数据”。优先使用共同尺度上的位置与长度，减少装饰和无意义交互。

## 从关系选图

| 阅读任务 | 首选 | 必须表达 | 避免 |
|---|---|---|---|
| 排名/差距 | 有序水平条、dot plot | 排序、直接标签、重点项 | 彩虹色、圆角糖果柱 |
| 与目标/均值偏离 | diverging bar、dot + reference | 基准线、正负方向、差值 | 只报绝对值 |
| 两端变化 | dumbbell、slope | 起点、终点、变化量 | 两张分离柱图 |
| 时间趋势 | 折线、小倍数 | Y 刻度、关键点、部分期间 | 无刻度折线、过度平滑 |
| 分布 | 直方、箱线、interval、strip | 中位/区间、n、异常 | 单根均值柱 |
| 关联 | 散点、hexbin | 两轴、基准/趋势、样本 | 用折线连接无序点 |
| 构成 | 100%堆叠、小倍数 | 分母、排序、直接标签 | 类别过多的饼图 |
| 漏斗/队列 | 阶段表、cohort heatmap | 事件定义、分母、截尾 | 把非顺序互动硬画漏斗 |
| 联合构成 | heatmap / matrix、100% 堆叠 | 行列定义、单元格分母 | 拆成多张无法对照的柱图 |
| 二维决策 | bubble / quadrant | 两轴口径、气泡规模、基准线 | 任意切象限、把相关当因果 |
| 多组路径 | small-multiple line / slope | 共同刻度、起止点、部分期间 | 用过多颜色和图例迫使读者对照 |

选图必须在关系被计算与审查后发生。图表复杂度不等于分析深度；数据只有单变量时，明确说明关系不足，不用装饰性图表补偿。

## 咨询式视觉语法

- 默认使用炭灰数据和浅灰辅助线；每张图最多一个主高亮蓝，正负语义才使用绿/红。
- 标题写判断，副标题写口径；图中直接标重点，来源、时间、n 和边界放在图下小字。
- 删除不帮助比较的外框、阴影、图例和点标记。网格线只保留用于估读的主刻度。
- 重点来自业务问题，不自动把最大值涂亮。
- 条形从 0 开始；折线截断需清楚刻度；百分比显示合理的 0/100 或业务基准。
- 小样本与不确定性使用区间、淡化、纹理或明确文字，不只靠颜色。

## 读图指引

图表不是独立装饰。读者只截取一张图时，也应知道从哪里看出标题结论。每张核心图在标题下提供三段极短提示：

1. 先看哪里：指出高亮点、基准线、区间、异常点或关键分组；
2. 比较什么：指出共同坐标、同一分母或同一时间窗口中的比较对象；
3. 如何得出结论：说明长度、位置、斜率、密度或区间的视觉差异支持什么判断。

例如：“先看 3 月高亮点 → 与前后月份在同一纵轴比较 → 只有 3 月抬升，说明均值对单点敏感。”不要写成图表教程，也不要用指引补充图中不存在的因果解释。

## Chart spec 最小内容

每张核心图包含：`view_id`、`type`、结论型 `title`、`reading_guide`、支持判断的具体 `result_refs`、指向 series result 的 `data_ref`、`unit/format`、`source`、`denominator`；按需增加 `benchmark`、`highlight`、`annotation`、`x_label`、`y_label` 和 `partial_periods`。

`result_refs` 指向具体 scalar/series 结果；`data_ref` 必须指向一个 series result。每个点直接保存自己的数值字段，例如 bar 用 `value`，scatter 用 `x/y`，dumbbell 用 `start/end`。禁止给所有点重复填写同一个 `metric`。

## 外部参考的角色

- Financial Times Visual Vocabulary（https://github.com/Financial-Times/chart-doctor）：关系到图形的选择与编辑思维。
- Observable Plot（https://github.com/observablehq/plot）/ Vega-Lite（https://github.com/vega/vega-lite）：分层 marks、scales、reference 和 annotation 的规格思想。
- AntV Chart Visualization Skills（https://github.com/antvis/chart-visualization-skills）：扩充图表类型与检索路由。

这些参考提供方法与图形语法，不替代 QuantiBox 的证据边界和离线渲染要求。

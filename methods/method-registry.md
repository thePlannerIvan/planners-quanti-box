# Method Registry

方法由决策问题、观察单位、结果变量、时间/对比结构、样本机制和测量质量共同决定。成熟度不是重要性，而是当前 Skill 的稳定执行程度。

## 成熟度

- **Supported**：有稳定执行路径、输入条件、失败诊断和回归 Eval。
- **Guided**：有可用判断框架，但需项目代码；代码、诊断与结果必须写入本次 run，不能暗示为通用自动能力。
- **Research**：只用于方法评估和补数设计，不对外声称可稳定执行。

| 方法族 | 成熟度 | 适用信号 | 主要边界 | Playbook |
|---|---|---|---|---|
| 描述与比较 | Supported | 横截面、分组、规模与分布 | 分母不一致、长尾、小样本 | `playbooks/descriptive-comparative.md` |
| 内容表现 | Supported | 内容、达人、互动字段 | 互动不等于转化，投流混杂 | `playbooks/content-performance.md` |
| 分类与分层 | Guided | 标签需规则或模型生成 | 必须两轮真实复核；否则 exploratory | `playbooks/segmentation-classification.md` |
| 时间序列 | Guided | 连续时间、周期、节点 | 短序列、缺口、口径变更 | `playbooks/time-series.md` |
| 统计推断 | Guided | 概率样本需推及总体 | 非概率抽样、聚类、多重比较 | `playbooks/statistical-inference.md` |
| 驱动诊断 | Guided | outcome 有变异且有候选维度 | 共线、代理变量、事后筛选 | `playbooks/driver-diagnostics.md` |
| 队列与漏斗 | Guided | 对象跨阶段或时间 | 事件定义、截尾、非线性旅程 | `playbooks/cohort-funnel.md` |
| 实验与因果 | Guided | 有干预、对照或可信准实验 | 识别假设失败即停止因果措辞 | `playbooks/experimentation-causal.md` |
| 预测与情景 | Guided | 未来容量或资源决策 | 数据太短、结构突变、区间缺失 | `playbooks/forecasting-scenario.md` |

## 选择与安装

- 推荐一个主方法；辅方法最多一个，且必须改变决定或解决独立缺口。
- 展示为什么选、为什么不选相邻方法，以及能/不能得到什么信息。
- 条件不满足时回到用户说明降级或换法，不静默改方法。
- 升级为 Supported 前必须具备输入 schema、确定性或可复核实现、失败诊断、合成 Eval 和至少一次干净 Forward Test。

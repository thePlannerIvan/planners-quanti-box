# Decision Recipe Registry

Recipe 按业务决定编排 Core Methods，不是新算法。当前均为 **Guided**：必须按本次数据条件设计执行，不代表已有一键稳定实现。

| Recipe | 决策问题 | 必要数据 | 编排与边界 |
|---|---|---|---|
| Brand Funnel | 主要在哪一段流失 | 同一目标人群、可比阶段口径 | 漏斗 + 分群 + 区间；只能定位哪里流失，不证明原因或真实旅程线性 |
| Brand Tracking | 指标是否真正改变 | 可比口径、时间和样本设计 | 时序 + 推断/敏感性；无识别设计不写 campaign effect |
| TAM / SAM / SOM | 市场上限、可服务范围和可实现份额 | 人群/企业数、价格/频次、能力约束 | 双路径情景区间；假设必须显式，不取假精确均值 |
| RFM | 哪些客户群值得优先维护或观察 | 客户 ID、交易时间、频次和金额 | 分布式分层 + 稳定性；不自动等于需求、利润或响应 |
| Penetration × Frequency | 增长来自买家数还是频次 | 买家、时间窗口和购买次数 | 分解 + 队列；结论仍需结构验证 |

Profit Pool、Experience Curve、Benchmarking、Brand Switching、Share of Wallet、Shopper Path 以及定价、Conjoint、MaxDiff、TURF、Kano、CLV、MMM 等均为 Research，只有满足输入与识别条件后才能按 Guided 项目执行。

允许没有匹配 Recipe；此时直接选择 Core Method。Recipe 升级也必须满足 Method Registry 的 Supported 条件。

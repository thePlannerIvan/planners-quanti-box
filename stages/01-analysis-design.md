# Stage 1：Recipe / 方法建议与 CP0

## 这一步在做什么

根据数据全景和决策语境，由 Agent 把宽泛请求转成可回答问题，推荐最适合的 Decision Recipe、主方法和必要辅方法。用户确认的是“怎样分析”，不是提前确认结论或被要求自行选方法。

## 先读取

1. `methods/decision-recipe-registry.md`
2. `methods/method-registry.md`
4. 只打开候选主 Playbook 和必要 Quality Gate，不先加载全部方法。

## 判断链

```text
Decision to make
→ Answerable question
→ Evidence Viability
→ Relation Map
→ Data structure and Quality Gates
→ Candidate Decision Recipe
→ Core methods
→ Metric / denominator / comparison
→ Expected decision information
→ Boundaries and context gaps
```

方法建议需说明：

- Recipe 为何对应当前决策；无合适 Recipe 时明确说明。
- 主方法为何匹配观察单位、时间、结果变量和样本机制。
- 相邻方法为何暂不选。
- 哪些 Quality Gates 必须先通过。
- 用户最终会获得哪些决策信息、图表或不确定性缩减。
- 当前数据不能提供什么，以及哪个未知语境会改变结论或行动。
- 为每个正式 metric 声明观察单位、字段、聚合/公式、分母、时间、允许比较和禁止用途，形成 metric contracts。

## 给用户的确认界面

用紧凑自然语言展示：

1. **数据结构与证据能力**：观察单位、样本范围、关键维度/指标和主要风险。
2. **决策语境**：当前理解的决策、策略/假设、约束、成功标准；未确认项明示。
3. **证据可用性**：`viable / conditional / fatal`，以及是否建议停止或降级问题。
4. **推荐 Recipe 和方法**：一个主方法、必要辅方法及理由。
5. **关系设计**：计划检查的 3–6 个关系、需要的维度与证据边界，而不是预定图表。
6. **大致步骤**：3–6 个真正的分析动作。
5. **预计获得**：能够回答的决策信息和交付形式。
6. **不能回答/边界**：样本、测量、因果、外推和所需新数据。
7. **需要确认**：请用户批准或修改问题、口径、Recipe、方法和边界。

然后停止。没有用户回复不得继续。

## 确认与交接

用户明确确认或修改后：

- 把**确认范围**写成一句话，放进报告的数据与方法章节：批准了什么、没批准什么、哪些方法细节由执行者自行设计。不落确认记录文件，不做哈希绑定。
- 不得代为宣布用户批准，也不得把"没有反对"当成批准；用户要求修改时重新展示方案并再次确认。
- 将唯一权威设计保存为 `execution-brief.json`，其中包含 tier、决策语境、Evidence Viability、方法、metric contracts、允许/禁止操作与计划关系。不要再创建独立 decision-context 或 analysis-brief。
- 运行 `node scripts/validate_run.mjs RUN_DIRECTORY --stage design`。

## 完成标准

- 用户知道数据是什么、当前决策如何被理解、为何采用该方法、会得到什么，并明确批准。
- 确认范围已写成一句话放进报告（批准了什么、没批准什么）；不落确认记录文件，也不声称机器能证明批准发生过。
- `fatal` 时已默认停止；只有用户明确批准一个重新定义的独立问题才可继续。
- Validator 不能证明推荐真的最合适或用户真正理解了取舍。

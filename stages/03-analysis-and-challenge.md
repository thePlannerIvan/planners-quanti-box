# Stage 3：分析与挑战

## 主要结果

从已确认 execution brief 和规范化数据包产生可复算 results，并在同一分析循环中完成敏感性、反证和分类质量检查，最终形成唯一 `findings-ledger.json`。

## 工作流

1. 只读取 `analysis-results.input` 所绑定的数据；Standard/Deep 不得回读原始文件。
2. 先生成候选 analytical views，再只计算会回答已确认决定或改变方法选择的关系。
3. 每个具体 scalar 或 series 保存为唯一 result ID，并注明其 metric `contract_id`。
4. 对关键结果检查分母、缺失、异常、替代口径、分组敏感性和反例；检查与计算同时发生，不事后补一份形式化 robustness 文件。
5. 分类任务记录逐类抽样、错分、两轮复核、仲裁和修正前后变化。缺任一环节，相关 finding 最多为 `conditional`，judgment 必须为 `exploratory`。
6. finding 只引用 result ID；`failed` finding 保留审计但不得进入 judgment。

## 产物

- `analysis-results.json`：按 `contracts/analysis-results.schema.json`。
- `findings-ledger.json`：按 `contracts/findings-ledger.schema.json`。
- Standard / Deep：`analytical-views.json`；Quick 可省略。

完成时能够从每个 finding 回到具体数值、metric contract、execution brief 和输入快照。

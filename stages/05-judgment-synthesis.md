# Stage 5：判断合成

## 这一步在做什么

将通过稳健性审查的 findings 放回 CP0 确认的决策语境，形成业务判断、反证说明和行动边界。这一阶段不设计 HTML，不把事实压缩成“高地、错位、公式”类标签。

## 先读取

本 Stage 已包含完整主任务。只有需要复杂反证案例时再读 `references/judgment-synthesis.md`；失效关系由 results/manifest 哈希和统一 Validator 处理，不在本阶段重复读取 lineage 说明。

## 工作流

1. 按 `decision_question` 对 final findings 分组，不按字段或图表类型分组。
2. 分开直接事实、可支持解释和候选解释。
3. 说明这组事实相对当前策略或事先假设改变了什么。
4. 分类 `direct` / `test-first` / `data-needed` / `no-action`。
5. 填写反证、替代解释、限制和 Why-so 链。
6. 编写可反驳、有主语与决策含义的判断句。
7. 用 Plain-language review 逐句删除数据包装词和越界机制。

## `judgment-ledger.json`

按 `contracts/judgment-ledger.schema.json` 产生，每条至少包含：

- `judgment_id`、`title`、`decision_question`。
- `fact_refs`，且只能引用正式 findings ledger。
- `interpretation`、`decision_change`。
- `action_status`；只有在证据允许时才填 `action`。
- `counterevidence`、`claim_status`。分类闭环未完成时使用 `exploratory`。

## 判断语义门槛

每条主判断必须同时通过：

- **Decision fit**：回答用户的已确认决定。
- **Evidence fit**：事实、解释和行动不超出证据级别。
- **Plain language**：不知道字段名也能理解。
- **Decision consequence**：明确改变决定、降低不确定性或说明暂不改变。
- **Traceability**：可返回 finding、metric、dataset、transformation 和 source。

Validator 只检查字段、引用和部分风险词；判断价值需用 Eval 和人工盲评。

## 完成标准

- 所有进入主报告的 judgment 有唯一 ID 且通过五项语义门槛。
- 无证据或语境不足的行动已降级，不强行给建议。
- 判断标题不是数据层标签、对仗口号或“从数据到数据”的复述。

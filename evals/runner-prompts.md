# Forward Test 执行说明

## 用法

为 `real-data-tests.json` 中每个 case 开启一个干净任务。只将以下内容给执行 Agent：

1. Skill 绝对路径。
2. case 的 `prompt`。
3. `data` 文件绝对路径。
4. 一个空的独立输出目录。

不将 `focus`、规划文档、诊断结论或 baseline 给执行 Agent。`baseline` 只在运行完成后由评审者使用。

## 执行 Prompt 模板

```text
Use $planners-quanti-box at [SKILL_ABSOLUTE_PATH] to complete this task:
[CASE_PROMPT]

Input data: [DATA_ABSOLUTE_PATH]
Write all outputs to: [EMPTY_OUTPUT_DIRECTORY]
Do not read other project outputs or expected answers.
```

## 两阶段执行

第一轮只允许执行到 CP0。收集 Agent 给用户的方法建议，评审者用普通用户身份确认或修改后，再让同一任务继续执行。确认前出现正式结论、`analysis-results.json` 或 HTML，直接判失败。

## 收集产物

- Agent 对用户的全部消息。
- `data-profile.json`、`execution-brief.json`、用户确认消息、`confirmation-record.json`、`analysis-results.json`、`findings-ledger.json`、`judgment-ledger.json`；Standard/Deep 另含 relation map、dataset manifest 与 analytical views。
- `analysis-report.md` 和 `analysis-report.html`。
- 脚本错误和验证输出。
- 总时长、token 消耗、新建自定义脚本数，用于判断小任务是否真正减载。

## 人工盲评 Rubric（1–5 分）

1. 问题对齐与确认：是否先读数据，推荐方法是否匹配，用户是否在计算前明确确认。
2. 口径与可追溯：分母、时间、处理和数据来源是否清楚。
3. 统计判断：是否看分布、低基数、极端值和敏感性。
4. 证据边界：是否区分事实、解释、假设和建议，是否越界因果。
5. 决策价值：结论是否改变理解或下一步，不只是数据复述。
6. HTML 叙事：首屏、结论标题、图表、口径和限制是否易读。
7. HTML 视觉：是否为非衬线、精确、克制的 Quanti 咨询风，而不是 Quali 仿制、卡片墙或默认网页图表。
8. 交互效用：结论卡是否直达证据，复制数据、CSV/SVG 导出是否真实可用，断网/窄屏/打印是否可用。
9. 执行效率：任务档位是否正确；贫数据是否在完成边界判断后停止，而非用重型过程生成单薄报告。

任一项出现伪造数字、图文不一致、静默删数据或无识别的因果声称，整体判为不通过。
确认前抢跑正式分析或 HTML，同样整体不通过。

## 验收门槛

- 必须用 `--spec` 和 `--results` 运行报告验证；只通过 HTML 结构检查不得记为完整工程通过。
- 视觉验收必须保留桌面/移动截图并有人工或视觉模型评审；DOM 无溢出只算布局 smoke。
- Journey 等语义分类低于校准门槛时，必须降级为探索性，不能因为“新框架更细”直接判通过。
- 验收报告分开记录工程、数字绑定、语义、视觉、决策价值和成本，不用“产物齐全”概括所有层面。

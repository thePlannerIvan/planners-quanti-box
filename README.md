# Planners Quanti Box

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-2563eb)](LICENSE)

把 CSV、TSV、Excel、JSON 或结构化表格转为可复算、可回到业务语境的定量决策判断。Skill 会先评估数据与识别设计，提出精确分析方案并等待用户确认，再生成可追溯的离线 HTML 与 Markdown 报告。

> 作者：阿祖不看 TVC（小红书同名） · [demyth.info](https://demyth.info) · [Lawyif@163.com](mailto:Lawyif@163.com)

## 它解决什么

```text
数据与决策语境 → Evidence Viability → execution brief → 用户确认
→ 规范化数据包 → analysis results → findings / judgment ledgers
→ 预检 → 离线 HTML + Markdown 报告
```

支持描述比较、时序、分群、驱动、漏斗、推断、实验与情景分析；不会在缺乏识别设计时把相关、便利样本或排名包装成因果或总体结论。

## 适用与不适用

适合：已有结构化数据，需要将数值结果变成可审计业务判断的分析任务。

不适合：以原话语义、文化表达或关系事件为证据核心的任务（请用 [Planners Quali Box](https://github.com/thePlannerIvan/planners-quali-box)）；没有支持条件时也不承诺正式预测或因果结论。

## 安装

```bash
npx skills add https://github.com/thePlannerIvan/planners-quanti-box --skill planners-quanti-box
```

或克隆到本地 Skill 目录：

```bash
git clone https://github.com/thePlannerIvan/planners-quanti-box.git ~/.codex/skills/planners-quanti-box
# 或
git clone https://github.com/thePlannerIvan/planners-quanti-box.git ~/.claude/skills/planners-quanti-box
```

## 使用

```text
使用 $planners-quanti-box，检查这份业务数据，
说明推荐方法、拟检查关系、预期信息和边界；先等我确认，再完成正式分析和报告。
```

CP0 是硬门槛：只有用户明确批准与当前数据快照绑定的 `execution-brief`，Skill 才进入正式计算。结果、发现、判断和报告分别保存在独立权威接口中，避免报告阶段补造结论。

## 开发与验证

```bash
node scripts/test_contracts.mjs
node scripts/test_report_pipeline.mjs
```

## 授权、署名与商业支持

- 以 [AGPL-3.0-only](LICENSE) 发布；
- 请保留 [NOTICE](NOTICE) 中的项目来源；
- 修改版须标明 fork 或改动，且不得暗示作者背书，详见 [TRADEMARK.md](TRADEMARK.md)；
- 闭源授权、私有部署、团队工作流定制、培训和咨询见 [COMMERCIAL.md](COMMERCIAL.md)。

## English summary

Planners Quanti Box is a quantitative decision-analysis Skill for structured data. It requires explicit approval of a data-bound execution brief, keeps calculations, findings and judgments separately traceable, and renders an offline single-file HTML report.

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

## 公共模组（缺了会自动装）

本 Skill 依赖若干**公共模组**（独立发布的条目，不是本仓库的一部分）：

- [`planners-review-core`](https://github.com/thePlannerIvan/planners-review-core) —— 审阅面契约、桥与本地宿主
- [`planners-source-index`](https://github.com/thePlannerIvan/planners-source-index) —— 来源索引契约与唯一校验器
- [`planners-fact-check`](https://github.com/thePlannerIvan/planners-fact-check) —— 事实核查契约与校验器
- [`planners-report-kit`](https://github.com/thePlannerIvan/planners-report-kit) —— 报告装配与校验（仅带报告出口的 Skill 需要）

某个模组不在本地时，本 Skill 的适配器会**自动从 GitHub 装它**，不需要手动准备。适配器找的地方按顺序：

1. `$PLANNERS_MODULES_HOME/<模组名>`
2. 本 Skill 的兄弟目录 `<skills-root>/<模组名>`（发布后的主路径）
3. monorepo 里 `02-skills-library/<分类>/<模组名>`
4. **用户级安装根**：`$PLANNERS_MODULES_INSTALL_DIR` → `$PLANNERS_MODULES_HOME`（仅当它已含该模组，或那目录还不存在）→ 默认 `~/.planners-modules/<模组名>`

前三条都没有时才自动安装（顺序不变，**本地永远优先、不会无条件联网**）；装到第 4 条那个**库外**用户级目录，**绝不写进** `02-skills-library` 工作树、`~/.codex|~/.claude|~/.gemini` 的技能目录、或任何系统目录。安装过程**不静默**：会打印缺哪个、找过哪些路径、从哪个 URL 装、装到哪、用的是 `git clone --depth 1` 还是 `npx skills add`、以及装到的 **commit**。装完先在暂存目录里验证（`SKILL.md` + 该模组声明的契约/校验器锚点文件都在），再用 rename 原子就位；**任何失败都会清掉暂存、不留半成品**，并给出可复制的手动安装命令。

要它**只报不装**（CI／离线／审计）：

```bash
PLANNERS_NO_AUTO_INSTALL=1 <你的命令>
```

| 环境变量 | 作用 |
|---|---|
| `PLANNERS_MODULES_HOME` | 指定已有模组所在目录（解析第 1 条，也兼作安装根） |
| `PLANNERS_MODULES_INSTALL_DIR` | 只指定**自动安装**的落点（优先级高于上面那条） |
| `PLANNERS_MODULES_REF` | 要钉的 tag 或分支（不设 = 装默认分支 HEAD） |
| `PLANNERS_NO_AUTO_INSTALL=1` | 只报不装；缺依赖时如实失败并打印手动命令 |

装的是**默认分支 HEAD**，日志里**永远打 commit**；HEAD 恰好被某个 tag 指着时，tag 也一并打出来。想钉版本就设 `PLANNERS_MODULES_REF`：

```bash
PLANNERS_MODULES_REF=v1.0.0 <你的命令>     # 钉在 tag 上
PLANNERS_MODULES_REF=main   <你的命令>     # 钉在某个分支上
```

钉了不存在的 ref 会**如实失败**（不会悄悄退回 HEAD），错误里带正确的可复制命令。

### 两条命令别搞混：谁装 Skill，谁抓依赖

**用户装一个 Skill** —— 用 Skills CLI，它会把条目放进各 agent 的技能目录：

```bash
npx skills add https://github.com/thePlannerIvan/<Skill 名> --skill <Skill 名>
```

**Skill 自己抓一个公共模组（内部依赖）** —— 用 `git clone`，落在库外的单一安装根：

```bash
git clone --depth 1 https://github.com/thePlannerIvan/<模组名>.git \
  "$HOME/.planners-modules/<模组名>"
# 想钉版本：加 --branch v1.0.0
```

**内部依赖为什么不走 `npx skills add`**：它没有 `--dir` 之类的落点参数，只会写进 `~/.claude/skills`、`~/.codex/skills` 这类 **runtime 技能目录**（那是发布器的领地，写进去等于多一份漂移副本）；而且它下载的目录**不带 `.git`**，拿不到 commit、也就没法追溯装的是哪一版。**门面命令归用户，内部依赖归 clone** —— 上面自动安装走的就是这条。

> 自动安装器自己的不变量测试（安装根优先级、禁地断言、候选顺序、幂等、失败清理、只报不装）：
> `node --test scripts/lib/planners-modules-install.test.mjs`



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

## 目录结构

```text
planners-quanti-box/
├── SKILL.md
├── agents/openai.yaml
├── assets/report-shell.html
├── contracts/           # 数据画像、执行简报、结果、发现与判断账本契约
├── evals/               # 自带测试、语言配对评估与真实数据测试清单
├── methods/             # 方法注册表、决策配方与经验注册表
├── playbooks/           # 描述比较、时序、分群、驱动、漏斗、推断、实验、情景
├── references/          # 图表选择、证据与因果、判断合成、关系发现、问卷质量门
├── scripts/             # 数据检视与规范化、报告装配与渲染、契约校验
└── stages/              # 00–07 分阶段工作流
```

## 授权、署名与商业支持

- 以 [AGPL-3.0-only](LICENSE) 发布；
- 请保留 [NOTICE](NOTICE) 中的项目来源；
- 修改版须标明 fork 或改动，且不得暗示作者背书，详见 [TRADEMARK.md](TRADEMARK.md)；
- 闭源授权、私有部署、团队工作流定制、培训和咨询见 [COMMERCIAL.md](COMMERCIAL.md)。

## English summary

Planners Quanti Box is a quantitative decision-analysis Skill for structured data. It requires explicit approval of a data-bound execution brief, keeps calculations, findings and judgments separately traceable, and renders an offline single-file HTML report.

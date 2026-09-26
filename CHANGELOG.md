# Changelog

## 2026-09-26 — 0.5.0（报告装配交给公共件）

- `scripts/render_report.mjs` 的装配段改为调用 `planners-report-kit`（报告内容可能很大，走临时文件而不是命令行参数）；**图表渲染仍留在本 Skill**（399 行内联 SVG 逻辑不该被抽走）。
- 水印文字改成 `{{WATERMARK}}`，值来自公共件的唯一来源。
- `validate_run.mjs` 的「离线 HTML」检查改为调用公共校验器；`evals/evals.json` 的水印断言不再写死字面量，改成「与公共件 `attribution.json` 一致」。**断言一个常量就是把错误永久化** —— 0.2.0 的「阿祖不看红绿灯」正是这么被自洽通过的。


## 2026-09-26 — 0.4.0（补上 file 级来源账目）

**起因**：这一家只有**表级**账目（`dataset-manifest`：行数、观察单位、表哈希），**完全没有 per-file 的覆盖状态**。于是「没读到的部分」在这里是空的 —— 只取了一张 Sheet、只抽样一般，下游都会当成全量。

- **新增 `source-index.json`**（公共件 `planners-source-index` 的 `source-index/2.0.0`），由 `normalize_data.mjs` 与规范化表和 manifest 一起产出：每个输入的**原文件哈希与字节数**、`audit_layer{mode:"normalized_table"}` 绑到规范化表、`coverage.status` + `counts.rows`、`anchors[]` 给出它在表里的行区间。
- **两条账目分层**：manifest 管表（行数 / 观察单位），来源索引管**文件**（哈希 / 字节 / 覆盖 / 锚点）。不合并 —— 粒度不同，并进 `sources[]` 会让它混两种粒度。
- **`validate_run.mjs` 新增两件事**：跑公共校验器验 `source-index.json`；做**一跳校验** —— 来源索引认领的表必须就是 manifest 登记的表，反过来每张表都要有来源认领。
- **覆盖状态终于可声明**：`--coverage-status partial|sampled|excluded|unread` 配 `--coverage-scope` / `--coverage-reason` / `--impact`。
- **双绑定**：`derived_from_sha256` 绑**原文件哈希**，`snapshot_sha256` 绑 **CP0 已确认快照** —— 两个都在，正是这家最强的那一处。

**证据**：`/tmp/quanti-smoke` 与 `/tmp/quanti-full` —— 正常产出 0 警告通过公共校验器；一跳校验正确夹具 3 PASS，把 `audit_layer.path` 改成不存在的表后 3 FAIL。四个自带测试（`validate_skill` / `test_contracts` / `test_report_pipeline` / `test_chart_types`）全部通过。

## 2026-09-13 — 0.3.0（删除 CP0 证据机器）

起因：同一次实跑里，执行代理写下的 `confirmation-record.json` 把一段**自己写的说明**放进了 `user_confirmation.verbatim`（"用户原话"）字段——而机器对这个字段的检查只有 `verbatim.trim().length > 0`。代理做得极其诚实，但**恰恰是这份诚实证明了这道检查是空的**：一句真话、一段转述、一段编造，在机器眼里完全等价。而且不能怪代理——在"用户授权代理决策"的编排场景里，真实的 verbatim 根本产生不出来。

结论：**CP0 这个动作要留（把方案摊给用户、等一句确认），"证明它发生过"的机器要删。** 机器验不了的东西，留在那里只会逼模型写一份看起来像证据的东西。

- **删掉 `contracts/confirmation-record.schema.json` 与 `evals/fixtures/smoke-confirmation.json`。**
- **删掉全部哈希绑定**：`validate_run.mjs` 的四条 CP0 检查、`render_report.mjs` 的 `quanti-confirmation-sha256` 指纹与 schema 校验、`render_run.mjs` / `test_chart_types.mjs` / `test_report_pipeline.mjs` 的 `--confirmation` 参数、`validate_skill.mjs` 的必需文件项。
- **阶段名 `cp0` 改为 `design`**：`--stage cp0` 全线替换为 `--stage design`（`SKILL.md`、`stages/02`、`stages/07`）。它现在只校验 `execution-brief.json` 与 `data-profile.json` 的 schema。
- **替代物是一句话，不是一份文件**：`SKILL.md` 与 `stages/01` 要求在报告的数据与方法章节写明**确认范围**——批准了什么、没批准什么、哪些方法细节由执行者自行设计。
- 测试相应改写：`test_contracts.mjs` 从"批准哈希绑定正确/错误"改为"design 阶段要求 profile + brief，缺 brief 报错"；`test_report_pipeline.mjs` 的 profile 快照改为从 results fixture 取，保持原有的数据快照绑定校验有效。

四个测试（`validate_skill` / `test_contracts` / `test_report_pipeline` / `test_chart_types`）全部通过。

## 2026-09-13 — 0.2.0（水印更正与断言收敛）

起因：一次跨 4 个 Skill 的端到端实跑（项目在 `01-projects/某运动品牌世界杯项目/`）中发现，同一个交付链条上游的两个分析 Skill 印着不同的作者水印——本 Skill 写的是「阿祖不看**红绿灯**」，Quali Box 写的是「阿祖不看 TVC」。

根因不是漏改一处，而是**校验器和渲染器同时硬编码了那个错字符串**：`scripts/validate_run.mjs` 断言 `阿祖不看红绿灯`，`scripts/render_report.mjs` 渲染同一个错串，于是每跑一次就自洽通过一次。一个断言了错误常量的检查，会把错误永久化。

- **水印更正为「阿祖不看 TVC · demyth.info」**，共 4 处：`SKILL.md`、`scripts/render_report.mjs`、`scripts/validate_run.mjs`、`evals/evals.json`。
- **删掉 `validate_run.mjs` 里的水印断言**。水印是身份装饰，不是不变量；机器校验它的唯一效果是让写错的常量被反复盖章。渲染器保留水印输出，校验器不再管它。

## 0.1.0 — 初始版本

- Standard / Deep 分档、四个权威接口（execution-brief / analysis-results / findings-ledger / judgment-ledger）与 `report-spec` 分离。
- 统一渲染器与唯一校验器；离线单文件 HTML、CV 指纹绑定与 chart series 形状校验。

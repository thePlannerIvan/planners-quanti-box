# Stage 2：分析数据集构建

## 这一步在做什么

按已确认的 Brief 完成类型修复、去重、连接、排除标记和派生指标，但不覆盖原始值。

进入本阶段前必须运行 `node scripts/validate_run.mjs RUN_DIRECTORY --stage design`，确认方案已展示、用户已明确批准、`execution-brief.json` 与 `data-profile.json` 通过 schema。缺失、未获批准、快照不一致或存在未获批准的 fatal 绕行时回到 Stage 1，不得继续。

## 输入及其作用

- 原始数据：唯一事实源。
- Analysis Brief：决定需要哪些数据和派生口径。
- Confirmation record：证明用户批准了当前方法、问题和边界。
- Data profile：指出缺失、重复、类型和连接风险。

## 核心认知动作

转换与校验。

## 判断框架

- 一致性：同义值、日期、布尔和单位是否统一。
- 完整性：缺失是未收集、不适用、零还是解析失败。
- 唯一性：重复是真重复、重发、多次行为还是聚合粒度不同。
- 可比性：期间、分组、样本和口径是否真能比。
- 可追溯性：每个派生列能否说明原始列、公式、输入快照和输出版本。
- 异常值：先区分数据错误和真实极端；真实极端默认保留并做敏感性。

## 不要做什么

- 不覆盖原文件，不静默删行，不将空值无条件改成 0。
- 不因为异常值影响结论就删除它。
- 不在未确认字段上硬凑 KPI。

## 工作方式与人机介入

重复、转换和导出优先用 `qsv`；复杂且需要复用时写项目脚本。只有处理决定会实质改变样本或结论时才请用户决定，并展示两种处理对行数和主指标的影响。

对同一原始数据只完整解析一次。单文件运行 `node scripts/normalize_data.mjs INPUT --output RUN_DIRECTORY/normalized-dataset.jsonl`；多文件直接依次传入，不为拼表临时写规范化脚本。若存在跨文件实体重复，增加 `--entity-key FIELD --canonical-policy first|group-entity|keep-all`，生成 `duplicate_entity`、`canonical_sample` 和 manifest 中的重复摘要。

`canonical-policy` 必须由分析单位决定，而不是为了得到更好看的结果：跨来源总体分析通常使用 `first`；来源内曝光分析通常使用 `group-entity`；只有研究问题本来就在计数重复曝光时才用 `keep-all`。合并总体图只能读取 `canonical_sample=true`，或在图表分母中明确声明加权规则。

每个正式派生指标都必须匹配 `execution-brief.json` 中的 metric contract。新的相除、跨表连接、跨组比较或定义变更必须返回 CP0，不在执行中静默新增。

Standard / Deep 产出 `dataset-manifest.json`，它登记一个或多个类型化规范表的相对路径、哈希、行数和观察单位，并用 `source_snapshot_sha256` 绑定 CP0 profile。使用 `normalize_data.mjs` 时传入 `--source-snapshot PROFILE_SHA256`。Stage 3 只能读取 manifest 中位于 run directory 内且哈希匹配的表；Quick 可直接绑定原数据快照，不强制造规范化副本。

`normalize_data.mjs` **同时产出 `source-index.json`**（公共件 `planners-source-index` 的 `source-index/2.0.0`）：这是**文件级**账目 —— 每个输入的原文件哈希与字节数、覆盖状态、以及它在规范化表里的行区间。它与 manifest 的**表级**账目（行数、观察单位）各管一层，`validate_run.mjs` 校验两者的一跳对应。

**输入没有整份读入时**（只取一张 Sheet、只抽样、或明确排除），必须声明：`--coverage-status partial|sampled` 配 `--coverage-scope`（实际读到哪）与 `--impact`（会让哪些判断不成立）。**这是「没读到的部分」在这一家唯一的落点** —— 过去它完全没有这个字段，下游会把部分覆盖当成全量。

## 产物与完成标准

- 产物：`normalized-dataset.*`、可选数据字典、`transformation-log.md`。
- 语义完成：关键指标能追回原始列和处理原则。
- 机器检查：行列变化、键唯一性、跨文件重复、canonical sample、公式、连接膨胀和缺失量。
- 不能由 Validator 证明：排除标准的业务正当性。

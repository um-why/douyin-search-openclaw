# douyin-search-claw 深度审查与优化后档

| 项 | 内容 |
| --- | --- |
| 审查日期 | 2026-11-03 |
| 技能版本 | 1.5.2 |
| 范围 | 本仓库 JS Skill（OpenClaw / Agent CLI）+ 对照后端 `D:\Git\guaikei\server`（REST + MCP） |
| 用法 | 逐条处理后将 `[ ]` 改为 `[x]`，备注可写 PR / 提交 / 责任人 |
| 建议顺序 | P0 → P1 → P2 → P3；Agent 可用性与契约稳定性优先于「加功能」 |

> 本文是**本地跟进后档**，不是用户面向 README。对外能力说明仍以 `SKILL.md` / `readme.md` 为准。

---

## 0. 结论摘要（先看这个）

本 Skill 已经具备较好的「给 AI 用」基础：统一 JSON 信封、退出码语义、意图路由树、硬性禁止条款、Schema 资产、与 guaikei REST 异步任务对齐。

当前最大短板不是「功能少」，而是：

1. **双通道漂移**：后端已有 MCP（`mcp/douyin/*`），本仓库是 JS CLI Skill；校验/轮询/错误语义/能力集合不完全一致（尤其热榜仅 CLI 有）。
2. **Agent 摩擦过大**：必须 `cd`、轮询最长约 22 分钟、stdout 结果体积极大、枚举全是魔法数字——弱模型与短上下文 Agent 极易误用。（P1-1 分层披露已在 1.5.0 落地，仍需继续降摩擦。）
3. **产品契约与后端静默纠错不一致**：Skill/MCP 对非法枚举 fail-fast；REST Create 路径仍会把非法 `sort/time/...` 悄悄改成默认值。
4. **校验边角与契约脆弱**：抽链「」污染已修（P1-16）；裸域名当关键词仍可穿透；包月/余额仍强依赖 errmsg 中文（M2–M3）。
5. **工程卫生**：无测试、无 `.gitignore`（`logs/` 易误提交）、无 bin 入口、日志无限增长与 PII 落盘等。

**宏观优化主线**：把本 Skill 从「给人读的长说明书 + 五个脚本」升级为「契约优先、分层披露、模型无关、与 MCP 同源」的 Agent Tool 面。

---

## 1. 架构与定位

```
用户自然语言
    ↓
AI Agent（Cursor / Codex / OpenClaw / Workbuddy / 国产 IDE Agent）
    ↓
路径 A: 读 SKILL.md → 在本机 `node src/douyin/*-cli.js`（本仓库）
路径 B: 直连 guaikei MCP tools（server/mcp/douyin/*，无热榜）
    ↓
guaikei REST 异步任务（Create → 轮询 info / 或 MCP 内聚轮询）
    ↓
上游采集 Worker
```

本仓库价值：零依赖、可离线分发到「只认本地 Skill / 脚本」的 Agent 生态；与 MCP 并存时必须**同源契约**，否则普罗大众会在不同入口得到不同行为。

---

## 2. 问题全清单

### 2.1 P0 — 正确性 / 安全 / 计费 / 契约断裂

> 已完成并从清单移除：P0-1 包月双上限文档、P0-2 余额/日限稳定码、P0-6 去掉微信手机号（见 §8）。

- [ ] **P0-3 REST 静默纠错 vs Skill/MCP fail-fast 双标准**（方案已记，**未实施**；待选 A / B / 折中）  
  - 位置：  
    - REST：`guaikei/server/app/{douyin,xiaohongshu,kuaishou,tiktok,wechat}/*` 各 `Create*Task`（及微信 handler 内联）对非法 `sort/time/duration/content` **静默改写为 0**，`limit` 越界 **clamp/默认**（如抖音 `general.go` 62–79）  
    - Skill：本仓及小红书/快手/TikTok/微信 Skill 显式非法 → `INVALID_ARGS` fail-fast  
    - MCP：`guaikei/server/mcp/{douyin,xiaohongshu,kuaishou,tiktok}` 先 `AssertChoice`/`AssertIntegerRange`，再调同一 `Create*Task`；微信无 MCP  
    - 采集端：`claw-task-dispatch` 信任库内任务字段，做上游协议映射/翻页/回写；**不**做用户态枚举策略校验  
  - 影响：绕过 Skill/MCP 直打 REST 时「非法参数仍成功」；实际落库已是默认筛选，排障与去重窗口易歪；与文档「显式非法不改写」在前端契约上不一致  
  - **分层共识（对照现状，基本符合；灰区只在 REST 枚举静默改写）**  
    1. **Skill / MCP = 前端**：参数契约校验与处理（缺省填默认；显式非法 fail-fast）— **已对齐**  
    2. **Go API = 后端**：逻辑校验（鉴权/套餐/余额/日限/频控/关键词长度）+ 去重 + 落库 + 入队 — **逻辑层已对齐**；筛选枚举静默改写属「前端式容错」泄漏到 API  
    3. **采集端 = 业务**：按库内参数执行上游采集与结果正确性 — **已对齐**  
  - **方案 A — API 非法枚举直接拒（严后端）**  
    - 做法：Skill/MCP 不变；`Create*Task` 对非法筛选枚举（及建议对非法 limit）返回错误、不落库不入队；采集端不变  
    - `sort_type=9`：REST 立即失败，调用方明确知错  
    - 利：三层职责清；Skill/MCP/REST 语义一致；排障与去重可信  
    - 弊：旧脏 REST 客户端可能开始报错，需回归管理端/历史对接；改动面在多平台 `Create*Task`  
    - 适合：公开 API 也视为正式契约，宁可不做也不假装做成  
  - **方案 B — 仅 REST 兼容改写并写明（宽 REST）**  
    - 做法：Skill/MCP 继续 fail-fast；REST 保留静默改写；文档/OpenAPI 标明「仅 REST 兼容，非法筛选会改成默认，不保证按非法值执行」；可选响应带回实际落库的 `sort/time/limit`  
    - `sort_type=9`：REST 成功但按 0 采  
    - 利：旧客户端零破坏；前端入口仍干净；可先只改文档止血  
    - 弊：双标准仍在；无 `normalized` 字段时仍难排障；去重仍可能脏参归一误复用  
    - 适合：Skill/MCP 是主产品面，REST 仍要养不规范老客户  
  - **折中（可选）**：默认/新版/`strict=1` 走 A；无 strict 的老 REST 限时走 B，且响应带回实际参数；Skill/MCP 永远严格  
  - A/B 共同点：API 的鉴权/计费/频控/长度等**逻辑校验都保留**；差别只在「筛选枚举这类契约字段」是拒还是默默修好  
  - 状态：2026-11-09 **仅记录方案，不实施**；选定后再改 `guaikei`（及必要时文档）

- [ ] **P0-4 任务入队失败导致永久卡住（后端 H1）**（方案已强化记录，**未实施**）  
  - 位置：  
    - 后端：各平台 `Create*Task`（抖音/小红书/快手/TikTok/微信等）在 DB 写入 `status=1` 后调用 `app.AddTask` **忽略返回值**（例：`app/douyin/general.go` 约 125–140）；对照 `guaikei/server/TODO.md` **H1**、商品侧 **XP2-1**  
    - Skill：`pollTaskResult` 遇持续「处理中」直至 `TIMEOUT`，message 仅为「任务仍在处理中, 请稍后重试」（`src/utils/request.js`）；SKILL §8 对 TIMEOUT 有同参复用说明但偏弱  
    - MCP：同一 Create 路径，入队失败时同样对客户端表现为「已创建」  
    - 采集端：队列无任务则永远领不到；与 Skill 空等无直接关系  
  - 失败链：DB 已 `status=1` → Redis 入队失败被吞 → Create 仍 `errcode 0` → Get 一直「处理中」→ Skill/MCP 空等至 TIMEOUT（约十几～二十分钟）→ Agent 易「假失败」改参重打或同参再空等  
  - 影响：体验极差；与去重/限流叠加时排障更难；**仅改 Skill 文案无法区分「真在采」与「从未入队」**  
  - **分层原则**：主修在 API（逻辑/状态机）；Skill/MCP 只消费明确错误码并强化「真 pending」的 TIMEOUT 话术；采集端不负责补救 Create 谎报成功  
  - **层 1 — 后端主修复（关闭 P0-4 的必要条件）**  
    1. 所有 Create 路径检查 `AddTask` 返回值  
    2. 入队失败：**禁止返回 succ**；并 **标失败**（DB 非永久 `status=1`，带失败原因）和/或 **回滚**刚插入行；Create 返回可区分业务码（建议稳定语义如入队失败，避免与插入失败等含糊码混用）  
    3. 告警：带平台 / task_id / Redis 错误  
    4. 补偿（辅）：`*TaskLoadAll` 等对「DB=处理中但队列缺失」可再入队；连续失败或超 SLA → 标失败，避免永久 pending  
    5. Get/查询：已失败态须返回明确失败，**不得再返回「处理中」**  
  - **层 2 — Skill / MCP（后端有信号后才完整）**  
    1. 映射入队失败 / 任务已死 → 稳定 `error_code`（如 `QUEUE_FAILED`），策略写清（勿当 TIMEOUT 狂轮询）  
    2. Get 到失败态 → 立即 fail，禁止当 pending  
    3. 强化「真处理中」的 TIMEOUT：`message`/`metadata` 写明——同参再调是**续等不是重做**；最多 1 次；写明复用窗口；**禁止改参**；可选 `reuse_window_hint` / `retry_after_ms`  
    4. §8 / 硬性禁止条款与契约对齐  
  - **层 3 — 文档 / 契约**  
    - 区分：正常慢任务（TIMEOUT + 同参续等）vs 入队失败/任务已死（明确错误，禁止续等）  
    - Skill 与 MCP 共用错误语义  
  - **验收（实施时）**  
    | 场景 | 期望 |  
    | --- | --- |  
    | Redis 入队失败 | Create 非 succ；DB 非永久处理中；有日志/告警 |  
    | Create 已失败 | Skill/MCP 不进入长轮询 |  
    | Get 已失败态 | 非「处理中」，立即错误退出 |  
    | 真 pending → TIMEOUT | 明确同参续等 ≤1，禁止改参重做 |  
  - **明确非关闭条件**：只改 Skill TIMEOUT 文案 / 只写「同参续等」→ **不算**关闭本项  
  - 状态：2026-11-09 **仅记录强化方向，不实施**

- [ ] **P0-5 Token / 敏感查询串出现在日志或 URL 的风险外溢**  
  - 对照：`guaikei/server/TODO.md` M7 等；Qwen 复核 **M5**  
  - 影响：  
    1. Skill 用户 TOKEN 若被后端 access log 明文记录，泄露面扩大  
    2. 轮询 `/info` 把 keyword/url 放进 GET query（`search.js` 等），商业敏感词更易进代理/网关/访问日志  
  - 方向：后端脱敏；Create 后以任务 ID 查询、少重传全参数（技能侧无法单方改）；本仓库继续避免把 TOKEN 写入 `logs/`

### 2.2 P1 — Agent 可用性（「更容易、更准确」的核心）

> 已完成并从清单移除：P1-1 SKILL 分层披露（1.5.0）；P1-16 抽链「」等停止符；P1-10 方向 A 双壳文档 + 方向 B `--json-args`（均记在 1.5.1，B 不升版本）。C（解析失败提示/`run.cmd` 等）仍可选。

- [ ] **P1-2 必须 `cd` 到技能目录**  
  - 位置：SKILL §1、§9；Qwen 复核确认：绝对路径调用其实能跑，但日志仍写到技能目录 `logs/`，多轮 shell 的 `cd` 易丢  
  - 影响：Cursor/Codex 工作目录常是用户仓库根；`Cannot find module` 是最高频失败之一  
  - 方向：  
    1. `package.json` 增加 `"bin"` + 安装后全局/本地命令（中期可 npm/`npx`）；  
    2. 或 CLI 顶部用 `__dirname` 固定相对路径（已是），再提供 `run.cmd`/`run.sh` 包装；  
    3. SKILL 示例改为「绝对路径调用」：`node "<SKILL_ROOT>/src/douyin/hot-cli.js"`；  
    4. 增加启动自检：找不到 `package.json` name 时 stderr 给出应 cd 的路径；  
    5. 可选 `--out` / 环境变量指定日志目录，弱化对 cwd 的依赖

- [ ] **P1-3 轮询过长 vs Agent 默认超时**  
  - 现状：QUERY 20 次、间隔 2→60s，叠加单次 20s，文档写最长约 22 分钟  
  - 对照：MCP helper `RetryIntervalMax = 5s`（与 JS 60s 已漂移）；Qwen 复核建议 `--timeout-budget` / 两段式  
  - 影响：Cursor/Codex 工具调用常 60–120s 级超时；Agent 会杀进程再重发 → 与「禁止并发/重复」冲突，并可能打满后端「1 分钟内 >3 任务」限流  
  - 方向：  
    - 默认 `limit` 场景给出「预期耗时」字段（`metadata.eta_ms` / `retry_after_ms`）；  
    - 支持「创建与查询分离」：`--async` 只创建并返回凭据，后续同参/凭据再取；或 `--timeout-budget` 缩短轮询预算；  
    - 文档明确：TIMEOUT 后**同参再调**是续等不是重做；  
    - 与 MCP 对齐退避上限

- [ ] **P1-4 结果 JSON 撑爆上下文**  
  - 现状：封面/播放 URL 等长字段；SKILL 已要求「只摘关键字段」，但 Agent 仍常把 stdout 整段塞进上下文  
  - 方向：增加 `--fields slim|full` 或环境变量 `GUAIKEI_OUTPUT=slim`（默认 slim：desc/author/互动/url/time）；full 才落盘完整；stdout 默认 slim

- [ ] **P1-5 枚举魔法数字对弱模型不友好**  
  - 现状：`--sort 1`、`--time 180`；中美模型都更容易说错成 `--sort likes`  
  - 方向：同时接受字符串别名：`likes|latest|综合`、`1d|7d|180d`；Schema/帮助双写；内部仍归一为数字以兼容后端

- [ ] **P1-6 `results` 类型三态（数组 / post+user 对象 / 单详情对象）**  
  - 影响：弱模型写后处理脚本时易假设「永远是数组」  
  - 方向：信封增加 `results_kind: "list"|"post_bundle"|"detail"|"hot"`；或统一为 `{ items, user? }` 并做一次大版本说明

- [ ] **P1-7 热榜能力在 MCP 缺失**  
  - 位置：JS 有 `hot-cli`；`mcp/douyin/register.go` 未注册 hot  
  - 影响：同一产品两条通道能力不一致；走 MCP 的 Agent 无法「今天热搜」  
  - 方向：MCP 补 `douyin_hot`；或 Skill 文档声明「热榜仅 CLI」

- [ ] **P1-8 意图路由「视频」消歧仍依赖长文档**  
  - 影响：用户说「看看这个视频」时，search/post/detail/comment 四选一错误率高  
  - 方向：提供极短「链接形态 → 命令」卡（`/user/`→post；`/video|note/`+评论→comment；+播放/文案→detail）；缺信号必须追问——写入 frontmatter `description` 前 200 字内

- [ ] **P1-9 需求挖掘流程摩擦**  
  - 现状：必须先征得 ≥50 条同意，再读 `demand-mining.md`  
  - 影响：多一轮对话；部分 Agent 会跳过征得直接 `--limit 50`（违反硬性条款）或根本不读参考文档  
  - 方向：`comment-cli` 增加 `--mode demand`：自动建议 limit、成功后在信封 `message`/`metadata.next_steps` 嵌入四段输出提纲（仍不替模型「编造」）

- [ ] **P1-17 「关键词不能是链接」校验不完整**（Qwen 复核 **M2**，已复现）  
  - 位置：`src/validate/keyword.js` 仅拦 `http(s)://` 与 `www.`  
  - 实测：`douyin.com/user/MS4wLjABxxx` 可通过校验直达 TOKEN 阶段  
  - 影响：用户/Agent 把主页链接当关键词 → 语义不明结果或后端错，而非本地 `INVALID_KEYWORD`  
  - 方向：拦截 `douyin.com/`、`v.douyin.com`、`iesdouyin.com`（及常见跨平台域名片段）；与 §路由「有链接走 post/detail」一致

- [ ] **P1-18 包月/余额分流强依赖 errmsg 中文**（Qwen 复核 **M3**）  
  - 位置：`src/utils/backendCodes.js` 用正则匹配文案区分 `PLAN_LIMIT` / `INSUFFICIENT_BALANCE`（因同数字多义，1.4.3/1.5.0 刻意 errmsg 优先）  
  - 影响：后端改一字即可错映射；Agent 按错误表「降 limit / 去充值」会反着做  
  - 方向：与后端约定专用稳定数字码（如包月超限 vs 余额不足分码），Skill 按码映射、errmsg 仅兜底；码表版本化进 `references/`；过渡期保留现正则

### 2.3 P1 — 双通道一致性（Skill ↔ MCP ↔ REST）

- [ ] **P1-11 轮询退避不一致**  
  - JS：`min(2s * 2^n, 60s)`；MCP helper：`RetryIntervalMax = 5s`  
  - 方向：抽共享常量文档；两端同算法

- [ ] **P1-12 关键词长度计量**  
  - JS：`String.length`；MCP：`utf8.RuneCountInString`；后端 Create：`for range`（rune）  
  - 影响：含 emoji / 罕见字时边界不一致  
  - 方向：JS 改为按 Unicode 码点（`[...str].length` 或 `Intl.Segmenter`）与后端对齐

- [ ] **P1-13 详情空结果判定不一致**  
  - JS `detail.js`：`isEmptyDetail` → 当 empty；结构异常多返回 null 而非 `API_SCHEMA_CHANGED`  
  - MCP detail：有更明确的 empty / 字段补全  
  - 方向：对齐 schema 变更错误码与 empty 条件

- [ ] **P1-14 Create 复用窗口文档 vs 代码**  
  - 搜索 Create 复用约 9 分钟；查询完成态窗口 post/detail 约 30 分钟等  
  - Skill 写「搜索约 9 分钟、作品/详情/评论约 20 分钟」——需与 `Get*Result` 的 `created_at` 窗口逐项核对并改文档或改代码

- [ ] **P1-15 信封字段漂移**  
  - MCP `ToolEnvelope` 无 `metadata.skill_version` 等；JS 有完整 metadata  
  - 方向：定义「对外信封 v1」单页规范，MCP/JS 共用字段最小集

### 2.4 P2 — 工程与代码质量（本仓库）

> 已完成并从清单移除：P2-3 aweme 抽取、P2-4/P2-5 成功路径 flush+先落盘。P2-12 热榜不落盘属已接受不对称，不再单列。

- [ ] **P2-1 无自动化测试**  
  - 应覆盖：`parseArgs`、`parseDecimalInteger`、`parseDouyinUser/Aweme`、`normalizeKeyword`/`isKeywordValid`、信封构建、`classifyPollError`、抽链 fixture（含「」边角）  
  - 方向：`node:test` 或 jest；URL/分享文案 fixture 从现网样例脱敏沉淀；可选 mock HTTP 覆盖 0/1/14/15/401

- [x] **P2-2 无 `.gitignore`**  
  - 备注：已补 `logs/`、`.env*`、`node_modules/`、OS 垃圾等

- [ ] **P2-6 `BASE_URL` 写死生产域名**  
  - 本地联调困难  
  - 方向：`GUAIKEI_API_HOST` 可覆盖（默认 `www.guaikei.com`）；文档注明当前不支持自定义 `HTTPS_PROXY`/企业 TLS 拦截（Qwen **L5**）

- [ ] **P2-7 无健康检查 / 版本命令**  
  - 方向：`node src/douyin/search-cli.js --version` 与 `doctor`（检查 node 版本、TOKEN 格式、HTTPS 连通、不发起计费任务）；利于市场「首装失败率」

- [ ] **P2-8 Schema 与运行时未做 CI 校验**  
  - `assets/*.schema.json` 与真实输出可能再漂移；代码从不加载 schema（Qwen **L6**）  
  - 方向：fixture / golden JSON + ajv；readme 写清「schema 供下游对接校验，非技能运行时自检」

- [ ] **P2-9 五套 CLI 大量重复样板**  
  - 方向：薄封装 `runCommand({ name, schema, validate, create, get, shapeResult })` 降重复、保证错误信封一致

- [ ] **P2-10 命名三处不一致（目录 / frontmatter / package）**  
  - `douyin-search-claw`（仓/目录）vs `douyin-search-keyword`（SKILL `name`）vs package/仓库 URL 历史名（含 openclaw 旧名）  
  - 影响：agentskills 建议 name 与目录一致；严格客户端 warning；搜索稀释（Qwen 文档不一致 #8）  
  - 方向：统一 slug 并改齐三处（或发布说明「历史别名」）

- [ ] **P2-11 无 LICENSE 文件**  
  - frontmatter 写 MIT，根目录无 LICENSE  
  - 方向：补 LICENSE

- [x] **P2-17 日志落盘无治理：无限增长 + 明文 PII**（Qwen 复核 **M4**）  
  - 备注：默认不落盘；`--save` 或 `GUAIKEI_ENABLE_LOG=1` 写入 `%TEMP%/douyin-guaikei/logs/`；已补 `.gitignore`；轮转/脱敏另议

- [ ] **P2-18 `classifyPollError` 把 errcode=1 一律当处理中**（Qwen 复核 **M6**）  
  - 位置：`src/utils/request.js`  
  - 影响：若后端复用 1 表达其它含义，会空轮询至 TIMEOUT（约 22 分钟）  
  - 方向：与 P1-18 一并约定显式 pending 码；过渡期可同时校验 errmsg「处理中」类文案

- [ ] **P2-19 信封 `metadata.total` 仅热榜有**（Qwen **L4**）  
  - 影响：其它命令 Agent 需自数 `results.length`  
  - 方向：list 类成功统一写 `total`（与 hot 对齐）

- [ ] **P2-20 frontmatter 非标准字段 / metadata 形态**（Qwen 文档不一致 #9）  
  - 现状：仍含 `version`/`enabled`/`runtime`/`env_desc`/`tags`/`examples` 等；`metadata` 值为对象/数组，而 agentskills 要求 metadata 为字符串 map  
  - 已做：删除重复的 `keywords` / `category`，`tags` 精简为能力向短表  
  - 影响：飞书 aily / 扣子 / 部分严格客户端可能拒收或告警  
  - 方向：出「标准 6 字段裁剪版」frontmatter 或发布脚本；OpenClaw 私有段保留在兼容形态说明里

- [ ] **P2-21 文档小不一致（低危）**（Qwen #4/#5/#7）  
  - readme 日志文件名表未写实际 `${pid}_` 前缀  
  - options 评论节漏列 iesdouyin（代码/详情节已支持）  
  - 示例 `runtime_version: "22.x"` 与真实完整版本号示意差异（可接受）  
  - 备注：`contract.md` timestamp 已与 `time.js` / schema / readme 对齐为 `YYYY/M/D HH:mm:ss`（月日不补零）；原横杠示例已清  
  - 方向：其余文档小不一致改齐；不改行为

### 2.5 P2 — 产品 / 合规 / 运营

- [ ] **P2-13 「普罗大众」开通路径过重**  
  - 必须官网开通 TOKEN + 配环境变量；非开发用户在 Cursor 里配 env 失败率高  
  - 方向：官网一键复制「Cursor 用户级 env」说明；可选 `guaikei login` 设备码；Skill 内 `AUTH_REQUIRED` 话术带短链深链

- [ ] **P2-14 计费不透明**  
  - Agent 无法预估「这次要花多少」  
  - 进展：取数成功/empty 已透传顶层 `cost`（estimate，对齐后端 M22）；Create 前预估 / doctor 探测仍缺
  - 方向：Create 响应或 doctor 返回预估；勿再改成 metadata

- [ ] **P2-15 合规话术偏技术向**  
  - 方向：用户确认外发数据的一句话模板，供 Agent 在首次调用前复述

- [ ] **P2-16 多账号批量**  
  - 文档写「一次一个」；运营场景常要批量  
  - 方向：暂不自动并发（会触限流）；提供「队列文件」顺序执行示例，间隔 ≥2s

### 2.6 P3 — 体验与增长（可排期）

- [ ] **P3-1 中英双 SKILL**  
  - 海外模型（GPT/Claude/Gemini/Grok）对全中文长文档指令遵循不稳定  
  - 方向：`SKILL.md` 保持中英关键指令双语；或 `SKILL.zh.md` + `SKILL.en.md`，frontmatter description 英中各一段

- [ ] **P3-2 输出报表模板**  
  - 选题表 / 竞品对比 / 舆情周报 markdown 模板放 `references/templates/`，成功后 `next_steps` 指向

- [ ] **P3-3 与 OpenClaw 以外生态清单**  
  - Cursor Rules / Codex skills / Claude Code hooks / MCP 安装一页通

- [ ] **P3-4 可观测性**  
  - 可选匿名 `skill_name`+version+error_code 上报（需明示开关，默认关）

---

## 3. 优化方向（专业宏观视角）

### 3.1 契约优先（Contract-First）

把「Agent 可依赖的行为」收成一份 **Tool Contract v1**（建议新文件 `references/contract.md`）：

| 契约项 | 要求 |
| --- | --- |
| 输入 | JSON Schema + 字符串枚举别名 |
| 输出 | 统一信封 + `results_kind` + 默认 slim |
| 错误 | 稳定字符串 `error_code`，禁止裸数字 |
| 时间 | 北京时间格式固定；`execution_time` / `retry_after_ms` |
| 副作用 | 只读；落盘路径写入 metadata |
| 重试 | 矩阵：AUTH/PLAN/BALANCE 禁重试；TIMEOUT 同参续等 1 次；NETWORK 最多 1 次 |

JS Skill、MCP、未来其它语言客户端都只实现这份契约。后端 REST 的静默纠错逐步废除。

### 3.2 分层披露（Progressive Disclosure）——专治长 SKILL

面向不同模型上下文与服从能力：

```
L0 frontmatter description（≤500 字，触发与禁用平台）
L1 SKILL 正文「执行卡」（≤80 行：前置、路由表、命令一行例、错误五条）
L2 references/options.md、demand-mining.md、contract.md
L3 assets/*.schema.json（机器校验）
```

**原则**：强模型（Claude Opus / GPT-5 级 / Gemini 长上下文）可深读 L2；弱模型与快模型只保证吃透 L0–L1。

### 3.3 降低动作空间（Action Space）

Agent 犯错多来自「可选项太多」。短期不做更多命令，优先：

1. 默认 slim 输出  
2. 字符串枚举  
3. `doctor` / `--version`  
4. 绝对路径示例  
5. 错误码人类可读  

中期再考虑「工作流级」工具：`douyin_research_topic`（内部串 search→detail），但要极克制，避免黑盒不可控。

### 3.4 与 guaikei 后端协同（不要只改 Skill）

Skill 再完美也掩盖不了：入队失败、Cron 错位、支付幂等、Token 软删仍可用等（见后端 `TODO.md`）。对「普罗大众」体感影响最大的后端项：

1. Create 入队失败处理（H1）  
2. 包月/余额错误信息产品化  
3. MCP 补热榜 + 与 JS 轮询对齐  
4. REST 与 MCP 校验策略统一  

建议在 guaikei 侧开「Skill/MCP 契约」里程碑，与本后档交叉引用。

### 3.5 分发形态：Skill 与 MCP 双轮驱动

| 受众 | 推荐入口 |
| --- | --- |
| OpenClaw / 本地脚本型 Agent | 本 JS Skill |
| Cursor / Claude Desktop / 通用 MCP 客户端 | guaikei MCP |
| 企业内网 | MCP + 私有 Host 环境变量 |

二者必须共享：错误码、slim 字段、路由消歧文案、套餐限制说明。

---

## 4. 多模型 × 多 Agent 适配策略

### 4.1 模型能力差异 → 文档与工具设计含义

| 模型族 | 典型特点 | 对本 Skill 的含义 |
| --- | --- | --- |
| **Claude**（Anthropic） | 长文档服从好、工具调用谨慎 | 可保留较完整 SKILL；仍应用 L1 执行卡减少噪声；硬性禁止条款有效 |
| **GPT**（OpenAI） | 工具调用强、易「自作聪明」改参数重试 | §8/§9 必须短而硬；TIMEOUT/AUTH 矩阵放 L0；避免示例里出现过大 limit |
| **Gemini** | 长上下文强，偶发跳步 | 决策树用编号列表；关键约束重复一次在 description |
| **Grok** | 风格随意、指令遵循波动 | L1 用短句命令式；少用比喻与营销语气 |
| **DeepSeek** | 代码/推理强，中文好；工具格式偶发不稳 | 示例命令可直接复制；提供 `--json-args`；错误码用英文蛇形 + 中文 message |
| **GLM**（智谱） | 中文场景强；复杂英文 schema 偶发弱 | SKILL 主中文；Schema description 中英双语；枚举给中文别名 |
| **Kimi**（月之暗面） | 长上下文、中文综合好 | 适合读 references；仍要防止整份 JSON 回灌；强化 slim |

### 4.2 Agent 产品差异

| Agent | 偏好 | 适配动作 |
| --- | --- | --- |
| **Cursor** | 仓库内 Skill / Rules；终端 cwd=项目根 | 绝对路径示例；可选 `.cursor/skills` 安装说明；`doctor` |
| **Codex** | 短指令 + 可执行命令 | L1 执行卡；明确 exit code |
| **OpenClaw** | frontmatter metadata、primaryEnv | 保持 `metadata.openclaw`；校验 bins/env |
| **Workbuddy 等国产** | 常中文 UI、Windows、弱 MCP | 中文错误话术；PowerShell 示例；TOKEN 配置截图级说明放官网 |
| **Claude Code / MCP 优先** | 原生 MCP | 引导装 guaikei MCP；Skill 作 fallback |

### 4.3 「更容易」清单（按性价比排序）

1. 默认 slim 输出 + `results_kind`  
2. SKILL 压缩为 L1 执行卡 + 外置细节  
3. 绝对路径 / bin 入口，消灭 `cd` 刚需  
4. 错误码映射（14/15/2/…）+ 禁重试表  
5. 字符串枚举别名  
6. `--json-args`，避开 shell 引号
7. `doctor` 命令  
8. 中英 description  
9. TIMEOUT 续等与 ETA 字段  
10. MCP 热榜对齐  

### 4.4 「更准确」清单

1. frontmatter `description` 内嵌「禁用：小红书/快手/B站/微博」与链接形态路由（已有雏形，再压短）  
2. 缺参必追问模板保留，但移到 L1 六条以内  
3. 需求挖掘：信封内 `next_steps`，减少「忘记读 md」  
4. Schema `additionalProperties: false` 已有 → 工具调用侧尽量走 schema（MCP 已较好；纯 Skill 靠文档）  
5. 对「最火/最新/近一周」等口语 → 参数映射表保留在 L1（高频 8 行足够）  
6. 禁止 Agent 把 empty 说成成功——在 error_code 旁加 `user_hint` 字段可进一步降低胡说率  

---

## 5. 建议落地路线图

### Phase A（1–2 周，高杠杆）

1. 本仓库：修 P1-16/P1-17（抽链「」+ 裸域名关键词）；`.gitignore`、LICENSE、slim 默认输出、`results_kind`  
2. 本仓库：绝对路径示例 + `doctor` + 关键词 rune 长度；日志 `--no-save`/轮转（P2-17）  
3. 后端：专用数字码替代 errmsg 分流（P1-18）；评估 Create fail-fast（P0-3）  
4. 更新本后档勾选  
（已完成可不再排：错误码映射大部、L1 执行卡、aweme 解耦、成功 flush/先落盘）

### Phase B（2–4 周）

1. 字符串枚举别名 + `--json-args`  
2. 抽公共 CLI runner；补 `node:test`  
3. MCP 补 hot；轮询参数与 JS 对齐  
4. 信封 metadata 增加 `log_path` / `retry_after_ms`

### Phase C（持续）

1. 合同测试：MCP vs JS golden  
2. 套餐/计费可探测 API  
3. 模板化分析产出  
4. 与后端 Critical/High 安全项联动（支付、Token、入队）

---

## 6. 已确认相对稳健（对照用，勿当缺陷重复开单）

- 统一 stdout 信封 + stderr 日志分离  
- AUTH 与业务错误退出码分层（3 vs 1/2）  
- 显式非法筛选项 fail-fast（Skill 侧）  
- 分享文案抽链、query 剥离  
- 十进制整数解析拒绝 `1e4`/`0x10`  
- 需求挖掘步骤文档化  
- 零 npm 运行时依赖，利于 Agent 环境  
- OpenClaw metadata（emoji、primaryEnv、bins）齐全  
- 与后端异步任务模型匹配（Create + poll）  

---

## 7. 进度跟踪

| 优先级 | 开放条目约数 | 说明 |
| --- | ---: | --- |
| P0 | 3 | 已完成项已移出清单（P0-1/2/6） |
| P1 | 15 | P1-10A/B、P1-16 已移出；余 P1-17/18 等 |
| P2 | 17 | 含 Qwen 新增 P2-17–21；P2-3/4/5 已移出；P2-12 接受不对称已删 |
| P3 | 4 | — |
| **合计** | **39** | 已完成历史见 §8，不再占开放清单 |

---

## 8. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-11-23 | frontmatter：删 `keywords`/`category`，精简 `tags`；版本 1.5.2 |
| 2026-11-14 | 信封顶层可选 `cost`（透传 REST 取数花费估算）；不升版本；热榜除外 |
| 2026-11-14 | P2-17：默认不落盘；`--save` / `GUAIKEI_ENABLE_LOG=1` → TEMP `douyin-guaikei/logs/`；已同步 wx/xhs/ks/tt；不升版本 |
| 2026-11-14 | P1-10 方向 B：`--json-args` + `parseCliArgs`；不升版本；已同步 xhs/ks/tt/wx（他仓 changelog 记入当前版本、不升号）；C 未做 || 2026-11-14 | P1-10 方向 A：SKILL 双壳例 + faq 引号/绝对路径排障；版本 1.5.1；已同步 xhs 1.2.3 / ks 1.1.3 / tt 1.1.3 / wx 1.1.2 |
| 2026-11-10 | P1-16：抽链停止符/尾 scrub 补「」『』等；不升版本 |
| 2026-11-10 | 清理已完成项出开放清单；收录桌面《douyin-search-claw-深度分析报告》中属实项：P1-16/17/18、P2-17–21，并增强 P0-5/P1-2/P1-3/P2-6/8/10 |
| 2026-11-10 | P2-4/P2-5：统一 writeJson flush；成功先落盘再 stdout 再 exit；不升版本（已移出开放清单） |
| 2026-11-10 | P2-3：抽 `validate/aweme.js`；detail 与 comment 解耦；不升版本（已移出开放清单） |
| 2026-11-10 | P1-10：记入 Windows 引号差异原因与 A/B/C；方向 A 已于 1.5.1 落地 |
| 2026-11-10 | P1-1：SKILL 执行卡重构；references 下沉 + 入口总表；参数详表对调 readme；版本 1.5.0（已移出开放清单） |
| 2026-11-09 | P0-4：强化记录后端 H1 主修 + Skill/MCP 错误码与 TIMEOUT 话术 + 验收；明确「只改文案不算关闭」；**未实施** |
| 2026-11-09 | P0-3：记入分层共识与方案 A（API 拒非法枚举）/ B（仅 REST 兼容改写）/ 折中；**未实施**，待选型 |
| 2026-11-10 | P0-2：`18→DAILY_LIMIT`；errmsg 优先映射收口；版本 1.5.0（已移出开放清单） |
| 2026-11-07 | 1.4.3 文档并入获客剧本 `customer-acquisition.md`；与痛点同时出现先追问 |
| 2026-11-07 | 新增用户搜索 `user-search-cli.js`；版本 1.4.3；fans/type 不暴露 |
| 2026-11-04 | P0-6：移除 SKILL/readme 中微信手机号，仅保留官网；不升版本 |
| 2026-11-04 | P0-1 A+B：`14→PLAN_LIMIT`；文档双上限；版本 1.4.2 |
| 2026-11-03 | 初版：对照 guaikei server REST/MCP/TODO 与本仓库 1.4.1 全量审查 |

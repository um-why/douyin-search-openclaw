# douyin-search-claw 深度审查与优化后档

| 项 | 内容 |
| --- | --- |
| 审查日期 | 2026-11-03 |
| 技能版本 | 1.4.2 |
| 范围 | 本仓库 JS Skill（OpenClaw / Agent CLI）+ 对照后端 `D:\Git\guaikei\server`（REST + MCP） |
| 用法 | 逐条处理后将 `[ ]` 改为 `[x]`，备注可写 PR / 提交 / 责任人 |
| 建议顺序 | P0 → P1 → P2 → P3；Agent 可用性与契约稳定性优先于「加功能」 |

> 本文是**本地跟进后档**，不是用户面向 README。对外能力说明仍以 `SKILL.md` / `readme.md` 为准。

---

## 0. 结论摘要（先看这个）

本 Skill 已经具备较好的「给 AI 用」基础：统一 JSON 信封、退出码语义、意图路由树、硬性禁止条款、Schema 资产、与 guaikei REST 异步任务对齐。

当前最大短板不是「功能少」，而是：

1. **双通道漂移**：后端已有 MCP（`mcp/douyin/*`），本仓库是 JS CLI Skill；校验/轮询/错误语义/能力集合不完全一致（尤其热榜仅 CLI 有）。
2. **Agent 摩擦过大**：必须 `cd`、轮询最长约 22 分钟、stdout 结果体积极大、枚举全是魔法数字、`SKILL.md` 过长——弱模型与短上下文 Agent 极易误用。
3. **产品契约与后端静默纠错不一致**：Skill/MCP 对非法枚举 fail-fast；REST Create 路径仍会把非法 `sort/time/...` 悄悄改成默认值。
4. **商业规则未写进 Skill**：包月双上限与 `PLAN_LIMIT`（errcode 14）已在 1.4.2 落地；余额预检 15、短时并发 2 等仍待 P0-2。
5. **工程卫生**：无测试、无 `.gitignore`（`logs/` 易误提交）、无 bin 入口、detail 复用 comment 校验模块等。

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

- [x] **P0-1 包月 Token 上限与文档冲突**  
  - 位置：`guaikei/server/app/douyin/general.go`（`token.Type == 0` 时 `Limit > 30` → errcode 14）；Skill 文档写 1–10000  
  - 影响：Agent 按文档设 `--limit 100` 对包月用户必失败；用户觉得「技能坏了」  
  - 方向：Skill 在 AUTH 后或错误映射中识别 14；SKILL.md / options 写明套餐差异；或 Create 前增加「能力探测」轻量接口  
  - 备注：2026-11-04 已按 A+B 落地（`backendCodes.js` 映射 `14→PLAN_LIMIT`；SKILL/readme/options/changelog 写明双上限；版本 1.4.2）。能力探测 API 仍属后续

- [ ] **P0-2 余额/日限额错误未映射为稳定 error_code**  
  - 位置：后端 errcode 15（余额预检）、`CheckDayMoney` 等；Skill `request.js` 把非 0/401/403 的数字码原样抛出  
  - 影响：Agent 看到 `"15"` 不知含义，可能改参数或重试导致反复扣预检/骚扰  
  - 方向：建立 `BACKEND_CODE_MAP`：`2→RATE_LIMITED`、`15→INSUFFICIENT_BALANCE` 等；SKILL §8 补应对表（禁止乱重试）。**`14→PLAN_LIMIT` 已在 P0-1 / 1.4.2 完成**

- [ ] **P0-3 REST 静默纠错 vs Skill fail-fast 双标准**  
  - 位置：`CreateGeneralSearchTask` 非法 sort/time/duration/content/limit 被改写；Skill/MCP 显式非法直接失败  
  - 影响：绕过 Skill 直打 API、或旧客户端，与文档「显式非法不改写」承诺不一致；排障困难  
  - 方向：后端 Create 与 MCP/Skill 对齐为 fail-fast（或增加 `strict=1`）；至少管理端与公开 API 行为一致

- [ ] **P0-4 任务入队失败导致永久卡住（后端 H1）**  
  - 位置：各 `Create*Task` 忽略 `AddTask` 错误；Skill 侧会一直轮询到 TIMEOUT  
  - 影响：用户空等约 22 分钟；体验极差且可能产生「假失败」重试  
  - 方向：后端入队失败回滚/标失败；Skill 对「创建成功但长期 pending」在 message 中提示可同参续等（已有部分说明，需强化）

- [ ] **P0-5 Token 出现在日志/Query 的后端风险外溢**  
  - 对照：`guaikei/server/TODO.md` M7 等  
  - 影响：Skill 用户 TOKEN 若被后端 access log 明文记录，泄露面扩大  
  - 方向：后端脱敏（本仓库侧避免把 TOKEN 写入 `logs/` ——当前未写 TOKEN，保持）

- [ ] **P0-6 微信手机号写在 SKILL/readme 元数据**  
  - 位置：`SKILL.md` `env_desc`、readme 支持区  
  - 影响：公开仓库/技能市场爬取导致骚扰与隐私问题  
  - 方向：仅留官网链接；私聊渠道放到登录后控制台

### 2.2 P1 — Agent 可用性（「更容易、更准确」的核心）

- [ ] **P1-1 `SKILL.md` 过长，弱模型跟不全**  
  - 现状：约 300+ 行，含表格、决策树、错误表、合规、FAQ  
  - 影响：GLM / 小参数 DeepSeek / 短上下文 Agent 容易只读到前半段，漏掉「先 cd」「AUTH 不重试」「results 形态因命令而异」  
  - 方向：分层披露（见 §3.1）：frontmatter + 一页「执行卡」；细节沉到 `references/`，用「何时读」触发

- [ ] **P1-2 必须 `cd` 到技能目录**  
  - 位置：SKILL §1、§9  
  - 影响：Cursor/Codex 工作目录常是用户仓库根；`Cannot find module` 是最高频失败之一  
  - 方向：  
    1. `package.json` 增加 `"bin"` + 安装后全局/本地命令；  
    2. 或 CLI 顶部用 `__dirname` 固定相对路径（已是），再提供 `run.cmd`/`run.sh` 包装；  
    3. SKILL 示例改为「绝对路径调用」：`node "<SKILL_ROOT>/src/douyin/hot-cli.js"`；  
    4. 增加启动自检：找不到 `package.json` name 时 stderr 给出应 cd 的路径

- [ ] **P1-3 轮询过长 vs Agent 默认超时**  
  - 现状：QUERY 20 次、间隔 2→60s，叠加单次 20s，文档写最长约 22 分钟  
  - 对照：MCP helper `RetryIntervalMax = 5s`（与 JS 60s 已漂移）  
  - 影响：Cursor/Codex 工具调用常 60–120s 级超时；Agent 会杀进程再重发 → 与「禁止并发/重复」冲突，并可能打满后端「1 分钟内 >3 任务」限流  
  - 方向：  
    - 默认 `limit` 场景给出「预期耗时」字段（`metadata.eta_ms` / `retry_after_ms`）；  
    - 支持「创建与查询分离」或返回 `task_hint` 让 Agent 同参续等；  
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

- [ ] **P1-10 Windows / PowerShell / cmd 引号差异**  
  - 影响：国产 Agent 在 Windows 上拼命令失败率高  
  - 方向：SKILL 示例默认给出 PowerShell 与 cmd 两行；或提供 `node ... --json-args '{"keyword":"AI"}'` 避免 shell 转义

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

- [ ] **P2-1 无自动化测试**  
  - 应覆盖：`parseArgs`、`parseDecimalInteger`、`parseDouyinUser/Aweme`、`normalizeKeyword`、信封构建、`classifyPollError`  
  - 方向：`node:test` 或 jest；URL/分享文案 fixture 从现网样例脱敏沉淀

- [ ] **P2-2 无 `.gitignore`**  
  - `logs/`、`.env`、OS 垃圾文件易误入 git  
  - 方向：补齐；`logs/.gitkeep` 可选

- [ ] **P2-3 `detail-cli` 复用 `validate/comment`**  
  - 耦合；后续 comment 校验变更可能误伤 detail  
  - 方向：抽 `validate/aweme.js` 共用

- [ ] **P2-4 成功路径 stdout 未与错误路径同样 flush**  
  - `printSuccessEnvelope` 用 `console.log`；错误用 `writeJsonAndExit` 回调 flush  
  - 影响：极端管道场景成功输出截断  
  - 方向：成功也走统一 write+flush；写日志后再 exit

- [ ] **P2-5 成功后先打 stderr 再写日志，进程崩溃丢盘**  
  - 方向：先落盘再打 success；或 `metadata.log_path` 写入信封

- [ ] **P2-6 `BASE_URL` 写死生产域名**  
  - 本地联调困难  
  - 方向：`GUAIKEI_API_HOST` 可覆盖（默认 `www.guaikei.com`）

- [ ] **P2-7 无健康检查 / 版本命令**  
  - 方向：`node src/douyin/search-cli.js --version` 与 `doctor`（检查 node 版本、TOKEN 格式、HTTPS 连通、不发起计费任务）

- [ ] **P2-8 Schema 与运行时未做 CI 校验**  
  - `assets/*.schema.json` 与真实输出可能再漂移（changelog 已修过一次）  
  - 方向：fixture 跑 CLI mock 或录制 golden JSON 做 ajv 校验

- [ ] **P2-9 五套 CLI 大量重复样板**  
  - 方向：薄封装 `runCommand({ name, schema, validate, create, get, shapeResult })` 降重复、保证错误信封一致

- [ ] **P2-10 package 仓库 URL 与本地目录名不一致**  
  - `douyin-search-openclaw` vs `douyin-search-claw`  
  - 方向：统一命名，避免 Agent 搜错仓库

- [ ] **P2-11 无 LICENSE 文件**  
  - frontmatter 写 MIT，根目录无 LICENSE  
  - 方向：补 LICENSE

- [ ] **P2-12 热榜不落盘但搜索等落盘，行为不对称**  
  - 可接受；若 Agent 依赖「从 logs 复盘」需在文档标明热榜例外（已有）——保持即可

### 2.5 P2 — 产品 / 合规 / 运营

- [ ] **P2-13 「普罗大众」开通路径过重**  
  - 必须官网开通 TOKEN + 配环境变量；非开发用户在 Cursor 里配 env 失败率高  
  - 方向：官网一键复制「Cursor 用户级 env」说明；可选 `guaikei login` 设备码；Skill 内 `AUTH_REQUIRED` 话术带短链深链

- [ ] **P2-14 计费不透明**  
  - Agent 无法预估「这次要花多少」  
  - 方向：Create 响应或 doctor 返回 `estimate`；信封 metadata 带 `billable_units`

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
6. `--json-args` 或 stdin JSON，避开 shell 引号  
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

1. 本仓库：`.gitignore`、LICENSE、错误码映射、slim 默认输出、`results_kind`、L1 执行卡重构 SKILL  
2. 本仓库：绝对路径示例 + `doctor` + 关键词 rune 长度  
3. 后端：errcode 文案/码表与 Skill 对齐；评估 Create fail-fast  
4. 更新本后档勾选

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

| 优先级 | 条目约数 | 已完成 |
| --- | ---: | ---: |
| P0 | 6 | 1 |
| P1 | 15 | 0 |
| P2 | 16 | 0 |
| P3 | 4 | 0 |
| **合计** | **41** | **1** |

---

## 8. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-11-04 | P0-1 A+B：`14→PLAN_LIMIT`；文档双上限；版本 1.4.2 |
| 2026-11-03 | 初版：对照 guaikei server REST/MCP/TODO 与本仓库 1.4.1 全量审查 |

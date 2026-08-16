---
name: douyin-search-keyword
description: 抖音公开数据智能获取工具。支持抖音关键词搜索、抖音博主作品抓取、抖音视频评论分析、抖音实时热榜查询。当用户需要搜抖音视频、查抖音热榜、看抖音评论、抓博主作品、做抖音竞品分析、短视频选题调研、舆情监控、热点追踪、爆款挖掘、抖音运营数据分析时使用。触发词：抖音搜索、抖音热榜、抖音评论、抖音作品、抖音竞品分析、抖音数据分析、短视频运营、抖音舆情监控、抖音热点。
license: MIT
metadata:
  enabled: true
  type: command
  runtime: "nodejs@16.14.0+"
  version: 1.2.1
  requires:
    bins:
      - "node"
    env:
      - "GUAIKEI_API_TOKEN"
  env_desc:
    GUAIKEI_API_TOKEN: "抖音数据 API 访问令牌。未配置时无法调用接口；可通过 https://www.guaikei.com 开通，或联系开发者(wx 13395823479)获取支持。"
  category:
    - "Data&APIs"
    - "内容创作"
    - "数据分析"
    - "商业运营"
    - "办公效率"
  tags:
    - "抖音"
    - "douyin"
    - "抖音搜索"
    - "抖音热榜"
    - "抖音评论"
    - "抖音作品"
    - "抖音竞品分析"
    - "抖音数据分析"
    - "短视频运营"
    - "短视频"
    - "舆情监控"
    - "热点追踪"
    - "爆款挖掘"
    - "竞品分析"
    - "营销分析"
    - "search"
    - "数据挖掘"
    - "content-analysis"
    - "competitor-analysis"
    - "marketing"
    - "trend-tracking"
  schemas:
    - name: "搜索入参"
      file: "assets/search_cli_req.schema.json"
    - name: "搜索出参"
      file: "assets/search_cli_resp.schema.json"
    - name: "作品入参"
      file: "assets/post_cli_req.schema.json"
    - name: "作品出参"
      file: "assets/post_cli_resp.schema.json"
    - name: "热榜出参"
      file: "assets/hot_cli_resp.schema.json"
    - name: "评论入参"
      file: "assets/comment_cli_req.schema.json"
    - name: "评论出参"
      file: "assets/comment_cli_resp.schema.json"
  examples:
    - "搜抖音里'AI 教程'最火的视频: node src/douyin/search-cli.js --keyword 'AI 教程' --sort 1"
    - "看最近一周抖音上'AI 模型'最新的 20 条内容: node src/douyin/search-cli.js --keyword 'AI 模型' --sort 2 --time 7 --limit 20"
    - "查抖音今天有什么热点/热搜榜: node src/douyin/hot-cli.js"
    - "抓这个抖音博主最近 30 条作品: node src/douyin/post-cli.js --url 'https://www.douyin.com/user/MS4wLjABxxx' --limit 30"
    - "看这条抖音视频的 40 条评论: node src/douyin/comment-cli.js --url 'https://www.douyin.com/video/xxx' --limit 40"
---

# 🚀 抖音关键词搜索、竞品分析、舆情监控与热榜跟踪工具 (Douyin Search & Analytics)

## 1. 🛠️ 技能概述

抖音公开数据获取与智能分析工具。支持**关键词搜索排序**、**抖人作品抓取**、**视频评论分析**、**实时热榜获取**，适用于短视频选题、竞品监控、舆情分析、热点追踪，助力爆款内容策划与流量运营。

> **🔥核心优势**
>
> - **安全**：无需登录抖音账号，无风控 / 封号风险
> - **强大**：单次最多可获取 1W 条数据，内置批量与多维筛选
> - **全面**：出参覆盖作者、互动、标签、链接等可用数据及有价值数据都会返回
> - **轻量**：无需部署服务，Node.js 一键运行，仅依赖内置模块
> - **友好**：stdout 纯 JSON、日志走 stderr，便于 AI 稳定解析与二次分析

## 2. ✅ 什么时候应该调用这个技能

🎯 在以下场景优先调用：

- 用户明确要查 **抖音** 的公开内容（视频 / 图文 / 作者 / 评论 / 热榜）。
- 用户要做 **关键词搜索**、**爆款选题调研**、**竞品监控**、**评论洞察**、**博主作品追踪**、**热点追流**。
- 用户提供了抖音关键词、视频链接、博主主页链接，希望拿到结构化数据。
- 用户后续还要基于结果做总结、对比、筛选、报告生成。

### 🚫 不要在这些场景误调用

- 用户只是想写文案、改标题、生成脚本，但**并未要求查询抖音公开数据**。
- 用户查询的平台**不是抖音**（如小红书、B站、微博、公众号）——请路由到对应技能。
- 用户要求获取**私密 / 登录态 / 隐藏**数据或非公开信息。
- 用户既没给关键词，也没给可识别的抖音链接，且目标仍不明确——先追问。

> 意图不明确时先追问，不要盲目执行命令。

## 3. 🚧 能力边界

本技能当前覆盖 4 类能力：

1. 🔍 **关键词搜索**：按关键词搜抖音公开视频 / 图文，支持排序、时间、时长、类型筛选。
2. 🦸 **博主作品**：按主页 URL 或 sec_uid 获取作者公开作品列表。
3. 💬 **评论分析**：按视频 / 图文 URL 或 aweme_id 获取评论数据。
4. 📡 **实时热榜**：获取抖音热搜榜单。

🛑 本技能不需要、不负责：

- 登录抖音账号、发布 / 点赞 / 评论 / 关注等写操作
- 获取私密或非公开数据
- 代替用户做营销策略判断

它的职责是**先把数据拿回来**，再交给上层流程去分析、整理或生成结论。

## 4. 🔀 调用路由规则

> **Note:** 请先通过 [抖音数据获取技能官网](https://www.guaikei.com) 开通 TOKEN，配置环境变量 `GUAIKEI_API_TOKEN` 后才能正常运行。

根据用户输入的关键信号，路由到对应脚本：

| 用户输入 / 意图             | 调用脚本                    | 必填输入             | 典型结果                            |
| --------------------------- | --------------------------- | -------------------- | ----------------------------------- |
| 搜某个关键词的抖音内容      | `src/douyin/search-cli.js`  | `keyword`            | 视频/图文列表、作者、互动、跳转链接 |
| 看抖音今天有什么热点 / 热搜 | `src/douyin/hot-cli.js`     | 无                   | 热榜词条、热度、搜索量              |
| 看某个博主最近发了什么      | `src/douyin/post-cli.js`    | 主页 URL 或 sec_uid  | 博主公开作品列表                    |
| 看某条视频 / 图文的评论     | `src/douyin/comment-cli.js` | 视频 URL 或 aweme_id | 评论内容、评论者、互动              |

### 🧭 路由细则（消歧义，很重要）

- **热搜 / 热点 / 榜单 / 今天什么火** → `hot-cli.js`
- **搜索 / 搜一下 / 找 + 关键词**（无"评论"词）→ `search-cli.js`
- **评论 / 留言 / 弹幕** → `comment-cli.js`（必须出现"评论"类词才归此类）
- **作品 / 视频(指博主内容) / 主页 / 账号 / 博主** → `post-cli.js`

> ⚠️ 单独出现"视频"二字时，**不要默认归到 post-cli**：
>
> - 同时有"关键词"且无"评论" → 视为 `search`（用户想搜某个视频）。
> - 明确"这个视频的评论 / 留言" → `comment`。
> - 仅当"作品 / 主页 / 账号 / 博主"出现时才用 `post`。

## 5. 🧺 输入收集规则

执行前先收集足够输入，避免无效调用。

### 5.1 🔍 关键词搜索（search-cli）

至少要确认：`keyword`（2-50 字符）。可选：

- `sort`：0 综合 / 1 最多点赞 / 2 最新发布
- `time`：0 全部 / 1 一天内 / 7 七天内 / 180 半年内
- `duration`：0 不限 / 1 1分钟内 / 2 1-5分钟 / 3 5分钟以上
- `content`：0 不限 / 1 视频 / 2 图文
- `limit`：1-10000，默认 10

### 5.2 📡 博主作品（post-cli）

至少要确认：`url`（主页 URL 或 sec_uid）。可选：`limit`（1-10000，默认 10）。
适用链接：`https://www.douyin.com/user/MS4wLjABxxx`、`https://v.douyin.com/xxx`、或直接使用 sec_uid。

### 5.3 💬 评论分析（comment-cli）

至少要确认：`url`（视频 / 图文 URL 或 aweme_id）。可选：`limit`（1-10000，默认 10）。
适用链接：`https://www.douyin.com/video/xxx`、`https://www.douyin.com/note/xxx`、或直接使用 aweme_id。

## 6. 📜 执行原则

### 6.1 ❓ 缺少必要输入时

- 没有关键词：先追问关键词。
- 没有链接：先追问视频 / 主页链接或 ID。
- 链接类型不明确：先确认这是视频还是博主主页。
- 没有 `GUAIKEI_API_TOKEN`：提醒用户先配置环境变量，再执行（退出码 3 = auth_required）。

### 6.2 📤 输出原则

执行完成后，优先返回：本次目标、关键参数、结构化 JSON 结果，必要时再补一小段摘要。
适合衔接的后续动作：选题汇总、高赞对比、评论观点聚类、竞品内容风格总结、博主发文节奏分析、报告与表格生成。

### 6.3 🩹 失败处理原则

出现以下情况，应明确向用户说明原因，**不要编造数据，不要把空结果当成成功结论**：

- token 未配置或无效（退出码 3）
- 链接不合法或类型错误
- 搜索结果为空（退出码 0，正常空结果）
- 接口返回业务异常（退出码 1）
- 网络 / 超时问题（退出码 1）

## 7. 💡 推荐调用方式（可直接复制）

### 7.1 🔎 关键词搜索

```bash
node src/douyin/search-cli.js --keyword "AI 教程"
node src/douyin/search-cli.js --keyword "露营装备" --sort 1 --time 7 --limit 20
```

### 7.2 📡 实时热榜

```bash
node src/douyin/hot-cli.js
```

### 7.3 🦸 博主作品

```bash
node src/douyin/post-cli.js --url "https://www.douyin.com/user/MS4wLjABxxx" --limit 50
```

### 7.4 💬 评论分析

```bash
node src/douyin/comment-cli.js --url "https://www.douyin.com/video/xxx" --limit 100
```

## 8. 🤖 对 AI / Agent 更友好的触发方式（提升识别准确率）

优先采用以下自然语言触发，减少误路由：

- "帮我搜一下抖音里'AI 教程'最火的视频"
- "看最近一周抖音上'露营装备'最新的内容"
- "抖音今天有什么热点 / 热搜榜"
- "看看这个抖音博主最近 50 条作品都在发什么"
- "分析这条抖音视频评论区的主要观点"

若用户表达笼统（如"帮我做抖音竞品分析"），优先拆成两步：① 确认关键词 / 竞品链接 / 博主主页；② 再调用对应脚本拿回数据。

## 9. 🔧 自然语言指令映射

> **统一调用约定（重要）**
>
> - 必须在**技能根目录**执行。
> - 只输出纯 JSON 到 stdout，日志与 banner 走 stderr，便于稳定解析。
> - 退出码约定：`0`=成功（含 empty），`1`=运行错误，`3`=auth_required（缺/错 token）。
>
> 详细选项参数说明， 可参阅 [完整选项说明](references/options.md)
>
> LLM理解技能的详细选项，可参阅技能 `assets` 目录中文件，其遵循 JSON Schema draft-07 版本规范。
>
> - 抖音关键词搜索，[入参规范](assets/search_cli_req.schema.json)
> - 抖音关键词搜索，[出参规范](assets/search_cli_resp.schema.json)
> - 抖音抖人作品获取，[入参规范](assets/post_cli_req.schema.json)
> - 抖音抖人作品获取，[出参规范](assets/post_cli_resp.schema.json)
> - 抖音评论获取，[入参规范](assets/comment_cli_req.schema.json)
> - 抖音评论获取，[出参规范](assets/comment_cli_resp.schema.json)
> - 抖音热榜获取，[出参规范](assets/hot_cli_resp.schema.json)

## 10. 🧠 AI 意图识别规则

### 10.1 识别优先级（从上到下）

1. **热搜 / 热点 / 榜单 / 今天什么火** → `hot-cli.js`
2. **搜索 / 搜一下 / 找 + 关键词** → `search-cli.js`
3. **评论 / 留言 / 弹幕** → `comment-cli.js`（必须出现"评论"类词才归此类）
4. **作品 / 视频(指博主内容) / 主页 / 账号 / 博主** → `post-cli.js`

> ⚠️ 歧义提示：单独出现"视频"二字时，**不要默认归到 post-cli**。
>
> - 若同时有"关键词"且无"评论" → 视为 `search`（用户想搜某个视频）。
> - 若明确"这个视频的评论/留言" → `comment`。
> - 仅当"作品/主页/账号/博主"出现时才用 `post`。

### 10.2 参数推断规则

**排序（sort，与 time 正交）**

- 提到"综合 / 默认" → `sort=0`
- 提到"点赞最多 / 最火 / 爆款" → `sort=1`
- 提到"最新 / 最近发布 / 刚发" → `sort=2`

**时间窗（time）**

- 提到"全部 / 不限制" → `time=0`
- 提到"一天 / 24小时" → `time=1`
- 提到"一周 / 7天" → `time=7`
- 提到"半年" → `time=180`

**时长**

- 提到"1分钟以下 / 短于1分钟" → `duration=1`
- 提到"1到5分钟 / 1-5分钟" → `duration=2`
- 提到"5分钟以上" → `duration=3`
- 提到"不限时长" → `duration=0`

**内容类型**

- 提到"不限 / 默认" → `content=0`
- 提到"视频" → `content=1`
- 提到"图文" → `content=2`

**数量（limit）**

- 提到"条数 / 数量 / N条 / 前N条" → `limit=N`

### 10.3 默认值

- sort: 0（综合）｜time: 0（全部）｜duration: 0（不限）｜limit: 10

## 11. 📦 环境与依赖

- 运行环境：Node.js 16.14.0+
- 系统兼容：Windows / Linux / macOS
- 必需环境变量：`GUAIKEI_API_TOKEN`
- 官方入口：<https://www.guaikei.com>
- 完整选项说明：见 `references/options.md`
- 更新记录：见 `references/changelog.md`

## 12. 🛡️ 合规与使用限制

- 仅处理抖音**公开数据**，不支持私密 / 隐藏 / 登录态数据。
- 数据仅限个人 / 团队内部分析使用，禁止违规分发。
- 本技能依赖第三方 API 服务（guaikei.com），使用前请确认数据外发与授权范围。

## 13. 🎧 支持信息

- 官网：[抖音数据获取技能官网](https://www.guaikei.com)（自助开通 TOKEN / 查阅帮助）
- 微信：`13395823479`（备注：抖音技能）获取支持

## 14. ❓ 常见问题

- **没结果**：放宽关键词、减少限定（如 `--time 0`），或换成更贴近用户表达的词。
- **结果太多**：补场景、人群、品牌、时间范围或账号名。
- **调用失败**：先确认 `GUAIKEI_API_TOKEN` 已配置且有效（退出码 3 即 token 问题）。
- **担心账号安全**：这是只读能力，不登录、不发帖、不点赞、不评论。
- **想继续分析**：把最相关的 1-3 条结果发回来，继续缩小范围。

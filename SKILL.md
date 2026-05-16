---
name: douyin-search-keyword
description: 抖音公开数据智能分析工具。支持关键词搜索排序、抖人作品抓取、实时热榜获取，适用于短视频营销、竞品分析和热点监控，助力爆款内容策划与流量追踪。
version: 1.1.3
license: MIT
metadata:
  openclaw:
    enabled: true
    type: command
    runtime: "nodejs@16.14.0+"
    requires:
      bins:
        - "node"
      env:
        - "GUAIKEI_API_TOKEN"
    category:
      - "Data&APIs"
      - "内容创作"
    tags:
      - "douyin"
      - "抖音"
      - "search"
      - "搜索"
      - "数据挖掘"
      - "content-analysis"
      - "营销分析"
      - "数据分析"
      - "competitor-analysis"
      - "竞品分析"
      - "热点追踪"
      - "marketing"
      - "trend-tracking"
      - "workflow"
      - "insight"
      - "automation"
    parameters:
      search-cli:
        keyword: {type: string, required: true, minLength: 2, maxLength: 50, alias: "k"}
        sort: {type: number, enum: [0, 1, 2], default: 0, desc: "0=综合/1=最多点赞/2=最新", alias: "s"}
        time: {type: number, enum: [0, 1, 7, 180], default: 0, desc: "0=全部/1=1天/7=7天/180=半年", alias: "t"}
        limit: {type: number, min:1, max:200, default:10, alias: "l"}
        output: {type: string, enum: ["json", "markdown"], default: "json", alias: "o"}
      post-cli:
        url: {type: string, required: true, desc: "创作者主页URL/sec_uid", alias: "u"}
        limit: {type: number, min:1, max:200, default:10, alias: "l"}
    examples:
      - name: 搜索"AI 教程"获取10条综合排序的抖音内容
        command: 'node src/douyin/search-cli.js --keyword "AI 教程"'
        description: 快速获取关键词相关视频数据，助力内容创作灵感
      - name: 搜索"AI"获取最多点赞的10条抖音内容
        command: 'node src/douyin/search-cli.js --keyword "AI" --sort 1'
        description: 挖掘爆款视频特征，优化内容策略
      - name: 获取近7天"AI 模型"的抖音内容
        command: 'node src/douyin/search-cli.js --keyword "AI 模型" --time 7'
        description: 追踪近期热点趋势，把握内容窗口期
      - name: 获取半年内最新20条"AI 教程"的抖音内容
        command: 'node src/douyin/search-cli.js --keyword "AI 教程" --sort 2 --time 180 --limit 20'
        description: 监控长期内容趋势，制定内容规划
      - name: 获取抖人 MS4wLjABxxx 已发布的作品
        command: 'node src/douyin/post-cli.js --url "https://www.douyin.com/user/MS4wLjABxxx"'
        description: 获取抖人已发布的作品，助力竞品分析
      - name: 获取抖音实时热搜榜单
        command: "node src/douyin/hot-cli.js"
        description: 实时掌握平台热点，快速响应热门话题
---

# 🚀 抖音关键词搜索、竞品分析与热榜监控工具 (Douyin Search & Analytics)

> **💡一句话价值**：一键抓取抖音公开视频/作者/热榜数据，帮你做爆款选题、竞品分析、热点追踪。
>
> **🔥核心优势**
>
> - 轻量: 无需部署服务，Node.js 一键运行
> - 灵活: 支持多维度筛选、批量操作、多格式导出
> - 实用: 日志自动归档，适配营销报告 / 内容策划场景
> - 安全: 无需登录你的抖音账号，不担心风控风险 / 封号问题

## 1. ✅ 我能帮你解决什么（10 秒判断）

- 🔍 按关键词搜抖音视频（点赞/最新排序）：找爆款选题、分析高赞视频规律
- 🦸 竞品监控：批量抓取对标账号所有公开作品数据，分析内容策略
- 📡 热点追流：实时获取抖音热榜，抢占流量风口
- 📊 数据导出：自动生成JSON日志，方便二次使用

## 2. 🚀 最快上手（复制就能跑，30 秒出结果）

> **Note:** 请先通过微信 <13395823479> 申请 API TOKEN，配置环境变量 `GUAIKEI_API_TOKEN` 后才能正常运行。

### 2.1 🔎 抖音关键词搜索（最简单）

```bash
node src/douyin/search-cli.js AI
```

### 2.2 🔎 按点赞排序找爆款（最常用）

```bash
node src/douyin/search-cli.js --keyword "AI" --sort 1
```

### 2.3 🦸 抓取抖音抖人全部作品

```bash
node src/douyin/post-cli.js --url "https://www.douyin.com/user/MS4wLjABxxx"
```

### 2.4 📡 获取抖音实时热榜

```bash
node src/douyin/hot-cli.js
```

## 3. 📌 适用场景（我该不该用？）

- 你需要做短视频选题 → 关键词搜索 + 点赞排序
- 你需要模仿爆款文案 → 查看高赞视频详情
- 你需要监控竞品账号 → 批量抓取对方作品
- 你需要快速追热点 → 实时获取抖音热榜
- 你需要做营销报告 → 导出结构化数据

## 4. 🔧 参数详解表

### 🔎 抖音关键词搜索

| 参数        | 缩写 | 作用       | 可选值                                      | 必填 |
| :---------- | :--: | :--------- | :------------------------------------------ | :--: |
| `--keyword` | `-k` | 搜索关键词 | 2-50 个汉字                                 |  是  |
| `--sort`    | `-s` | 排序方式   | 0 = 综合 / 1 = 点赞 / 2 = 最新              |  否  |
| `--time`    | `-t` | 时间范围   | 0 = 全部 / 1 = 1 天 / 7 = 7 天 / 180 = 半年 |  否  |
| `--limit`   | `-l` | 获取数量   | 1-200 条                                    |  否  |
| `--output`  | `-o` | 输出格式   | json / markdown                             |  否  |

### 🦸 抖音抖人作品获取

| 参数      | 缩写 | 类型   | 说明                       |
| :-------- | :--- | :----- | :------------------------- |
| `--url`   | `-u` | 字符串 | 必填，抖人主页URL或sec_uid |
| `--limit` | `-l` | 1-200  | 获取作品数量 (默认10)      |

> **💡"抖人主页URL"说明**
>
> - PC端 ( 格式：<https://www.douyin.com/user/MS4wLjABxxx> )
> - 移动端 ( 格式：<https://v.douyin.com/xxx> )
> - 本技能关键词搜索返回的author_sec_uid字段

## 5. ⚠️ 重要限制（不踩坑）

- 仅抓取抖音公开数据，不支持私密 / 隐藏内容
- 需要配置 GUAIKEI_API_TOKEN 才能正常运行
- 数据仅限个人 / 团队内部使用，禁止违规分发

## 6. ❓ 常见问题（秒解决）

> **💡Q：运行报错，提示无权限？**
>
> A：先配置环境变量：`set GUAIKEI_API_TOKEN=你的TOKEN`
>
> - 私有TOKEN申请后请留意使用安全，避免泄露给他人
>
> **💡Q：搜索结果为空？**
>
> A：换常用关键词，或把 `--time` 改为 0（全部时间）
>
> **💡Q：输出文件在哪里？**
>
> A：自动保存在技能目录的 `logs` 文件夹下
>
> - 搜索任务日志: 默认保存为「时间戳_关键词_排序_时间_search.json」
> - 抖人作品获取日志: 默认保存为「时间戳_(抖人author_sec_uid)_post.json」
>
> **💡Q：支持 Windows/Mac/Linux 吗？**
>
> A：全平台支持，仅需安装 Node.js 环境

## 7. 📞 帮助与支持

TOKEN 申请 / 使用问题：微信 13395823479（备注抖音技能）

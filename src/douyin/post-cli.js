#!/usr/bin/env node

const constants = require("../config/constants");
const key = require("../utils/key");
const log = require("../utils/log");
const post = require("../api/post");
const utils = require("../utils/utils");
const validator = require("../validate/post");

function printHelp() {
  console.log(`
用法: node src/douyin/post-cli.js <url> [选项]

选项:
--limit -l \t<数量> \t搜索数量 (默认 10, 最大 200)
--help -h \t显示帮助信息

示例1: node src/douyin/post-cli.js https://www.douyin.com/user/MS4wLjABxxx
示例2: node src/douyin/post-cli.js "https://v.douyin.com/xxx" --limit 20
示例2: node src/douyin/post-cli.js MS4wLjABxxx --limit 100

注意:
  - 该脚本仅支持获取抖音抖人的作品, 不支持获取抖音视频或图文内容
  - 请确保环境变量 GUAIKEI_API_TOKEN 已配置
`);
}

function parseArgs(args) {
  const result = {
    url: "",
    limit: 10,
    helpRequested: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--url" || arg === "-u") {
      result.url = args[i + 1] || "";
      i++;
    } else if (arg === "--limit" || arg === "-l") {
      result.limit = Number(args[i + 1]) || 10;
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      result.helpRequested = true;
    } else if (!arg.startsWith("--") && !result.url) {
      result.url = arg;
    }
  }

  return result;
}

async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }
  const parsedArgs = parseArgs(args);
  if (parsedArgs.helpRequested) {
    return;
  }
  let { url, limit } = parsedArgs;
  if (!url) {
    utils.printError("url is required");
    printHelp();
    return;
  }

  utils.printBanner();
  utils.printInfo(`原始URL: ${url}`);
  url = validator.douyinUserUrl(url);
  utils.printInfo(`规范后的URL: ${url}`);
  limit = validator.optionFormat(limit);

  const token = key.skillKey(process.env.GUAIKEI_API_TOKEN);
  let postTask = null;
  try {
    const status = await post.createPostTask(token, url, limit);
    if (!status || status.errcode !== 0) {
      throw new Error(
        `获取作品任务创建时, 遇到未知错误, 请反馈给开发者 ${status} - ${Date.now()}`,
      );
    }
    utils.printSuccess(`获取作品任务创建成功, 正在获取作品中...`);

    postTask = await post.getPostTask(token, url, limit);
  } catch (error) {
    utils.printError(`获取作品失败: ${error.message}`);
    const errorOutput = {
      status: "error",
      url: url,
      message: error.message,
      error_code: error.code || "UNKNOWN",
      limit: limit,
      timestamp: new Date().toLocaleString(),
      results: [],
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    return;
  }

  if (!postTask || !Array.isArray(postTask) || postTask.length === 0) {
    utils.printError(`获取作品任务没有返回结果, 请稍后重试或联系开发者`);
    const emptyOutput = {
      status: "empty",
      url: url,
      message: "没有找到匹配的作品",
      error_code: "NO_MATCH",
      limit: limit,
      timestamp: new Date().toLocaleString(),
      results: [],
    };
    console.log(JSON.stringify(emptyOutput, null, 2));
    return;
  }

  // 输出作品结果
  const finalOutput = {
    status: "success",
    url: url,
    message: "获取作品任务完成",
    limit: limit,
    total: postTask.length,
    timestamp: new Date().toLocaleString(),
    openclaw_metadata: {
      skill_version: constants.VERSION,
      runtime_version: process.versions.node,
      execution_time: Date.now() - startTime,
    },
    results: postTask,
  };
  console.log(JSON.stringify(finalOutput, null, 2));
  utils.printSuccess(`获取作品任务完成, 共 ${postTask.length} 条作品`);

  url = url.replace(/[^a-zA-Z0-9_-]/g, "");
  url = url.replace("httpswwwdouyincomuser", "");
  url = url.replace("httpsvdouyincom", "");
  await log.taskWrite(
    `${startTime}_${url}_post.json`,
    JSON.stringify(finalOutput, null, 2),
  );
}

main().catch((error) => {
  utils.printError(error);
  process.exit(1);
});

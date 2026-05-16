#!/usr/bin/env node

const constants = require("../config/constants");
const key = require("../utils/key");
const log = require("../utils/log");
const search = require("../api/search");
const utils = require("../utils/utils");
const validator = require("../validate/keyword");

function parseArgs(args) {
  const result = {
    keyword: "",
    sort: 0,
    time: 0,
    limit: 10,
    output: "json",
    helpRequested: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--keyword" || arg === "-k") {
      result.keyword = args[i + 1] || "";
      i++;
    } else if (arg === "--sort" || arg === "-s") {
      result.sort = Number(args[i + 1]) || 0;
      i++;
    } else if (arg === "--time" || arg === "-t") {
      result.time = Number(args[i + 1]) || 0;
      i++;
    } else if (arg === "--limit" || arg === "-l") {
      result.limit = Number(args[i + 1]) || 10;
      i++;
    } else if (arg === "--output" || arg === "-o") {
      result.output = args[i + 1] || "json";
      i++;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      result.helpRequested = true;
    } else if (!arg.startsWith("--") && !result.keyword) {
      result.keyword = arg;
    }
  }

  return result;
}

function printHelp() {
  console.log(`
用法: node src/douyin/search-cli.js <关键词> [选项]

选项:
  --keyword \t<关键词> \t搜索关键词
  --sort \t<排序> \t排序依据, 0: 综合排序(默认), 1: 最多点赞, 2: 最新发布
  --time \t<时间> \t发布时间, 0: 全部(默认), 1: 一天内, 7: 七天内, 180: 半年内
  --limit \t<数量> \t搜索数量 (默认 10, 最大 200)
  --output \t<格式> \t输出格式, json, markdown (默认 json)
  --help \t显示帮助信息

示例1: node src/douyin/search-cli.js AI
示例2: node src/douyin/search-cli.js "AI 模型"
示例3: node src/douyin/search-cli.js --keyword AI --sort 0 --time 0 --limit 10 --output json
示例4: node src/douyin/search-cli.js --keyword "AI 模型" --sort 1 --time 180 --limit 20 --output markdown

注意: 
  - 关键词建议 2-50 个汉字，避免特殊符号
  - 请确保环境变量 GUAIKEI_API_TOKEN 已配置
  - 所有参数都会自动清洗和验证
`);
}

/**
 * 主函数 - 搜索任务入口
 * @description 解析命令行参数，执行搜索任务，输出结果并保存日志
 */
async function main() {
  const startTime = Date.now();
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printHelp();
    return;
  }

  const parsedArgs = parseArgs(args);
  let { keyword, sort, time, limit, output, helpRequested } = parsedArgs;

  if (helpRequested) return;
  if (!keyword) {
    utils.printError(`未提供关键词`);
    printHelp();
    return;
  }

  utils.printBanner();
  utils.printInfo(`原始关键词: ${keyword}`);
  keyword = validator.cleanKeyword(keyword);
  const isRight = validator.isKeywordValid(keyword);
  if (!isRight) {
    return;
  }
  utils.printInfo(`清洗后关键词: ${keyword}`);
  [sort, time, limit, output] = validator.optionFormat(
    sort,
    time,
    limit,
    output,
  );
  utils.printInfo(
    `排序: ${sort}, 时间: ${time}, 数量: ${limit}, 输出格式: ${output}`,
  );

  const token = key.skillKey(process.env.GUAIKEI_API_TOKEN);
  let searchTask = null;
  try {
    const status = await search.createSearchTask(
      token,
      keyword,
      sort,
      time,
      limit,
    );
    if (!status || status.errcode !== 0) {
      throw new Error(
        `搜索任务创建失败时, 遇到未知错误, 请反馈给开发者 ${status} - ${Date.now()}`,
      );
    }
    utils.printSuccess(`搜索任务创建成功, 正在搜索中...`);

    searchTask = await search.getSearchTask(token, keyword, sort, time, limit);
  } catch (error) {
    utils.printError(`搜索失败: ${error.message}`);
    const errorOutput = {
      status: "error",
      keyword: keyword,
      message: error.message,
      error_code: error.code || "UNKNOWN",
      sort: sort,
      time: time,
      limit: limit,
      output_format: output,
      timestamp: new Date().toLocaleString(),
      results: [],
    };
    console.log(JSON.stringify(errorOutput, null, 2));
    return;
  }

  if (!searchTask || !Array.isArray(searchTask) || searchTask.length === 0) {
    utils.printError(`搜索任务没有返回结果, 请稍后重试或联系开发者`);
    const emptyOutput = {
      status: "empty",
      keyword: keyword,
      message: "没有找到匹配的视频或图文内容",
      error_code: "NO_MATCH",
      sort: sort,
      time: time,
      limit: limit,
      output_format: output,
      timestamp: new Date().toLocaleString(),
      results: [],
    };
    console.log(JSON.stringify(emptyOutput, null, 2));
    return;
  }

  // 输出搜索结果
  const finalOutput = {
    status: "success",
    keyword: keyword,
    message: "搜索任务完成",
    sort: sort,
    time: time,
    limit: limit,
    output_format: output,
    total: searchTask.length,
    timestamp: new Date().toLocaleString(),
    openclaw_metadata: {
      skill_version: constants.VERSION,
      runtime_version: process.versions.node,
      execution_time: Date.now() - startTime,
    },
    results: searchTask,
  };
  if (output === "markdown") {
    const message = validator.formatMessage(keyword, searchTask);
    utils.printInfo(message);
    utils.printSuccess(`搜索任务完成, 共返回 ${finalOutput.total} 条结果`);
  } else {
    console.log(JSON.stringify(finalOutput, null, 2));
    utils.printSuccess(`搜索任务完成, 共返回 ${finalOutput.total} 条结果`);
  }

  await log.taskWrite(
    `${startTime}_${keyword}_${sort}_${time}_search.json`,
    JSON.stringify(finalOutput, null, 2),
  );
}

main().catch((error) => {
  utils.printError(error);
  process.exit(1);
});

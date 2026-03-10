/* global hexo */

"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const rp = require("request-promise-native");
const deasync = require("deasync");

hexo.extend.filter.register("before_generate", function () {
  const { log, config } = hexo;
  const postsDir = path.join(hexo.base_dir, "source/_posts");

  const mastodonConfig = config["mastodon-comments-helper"] || {};
  
  // 判断是否开启
  if (!mastodonConfig["enable"]) {
    return;
  }

  // 校验核心配置
  if (!mastodonConfig["MASTODON_DOMAIN"] || !mastodonConfig["MASTODON_TOKEN"]) {
    log.error("[Mastodon Comments Helper] 请配置 mastodon-comments-helper.MASTODON_DOMAIN 和 mastodon-comments-helper.MASTODON_TOKEN");
    return;
  }

  // 封装同步POST请求函数
  function syncPostRequest(apiUrl, requestOptions) {
    let requestDone = false;
    let responseData = null;
    let requestError = null;

    // 构建 rp 的请求配置
    const rpOptions = {
      method: "POST",
      url: apiUrl,
      headers: requestOptions.headers || {},
      body: requestOptions.json || {},
      json: true,
      timeout: requestOptions.timeout || 10000,
      rejectUnauthorized: false,
    };

    // 添加上游配置的代理
    if (mastodonConfig["REQUEST_PROXY"]) {
      rpOptions.proxy = mastodonConfig["REQUEST_PROXY"];
      log.info(`[Mastodon Comments Helper] 当前请求已使用代理访问: ${mastodonConfig["REQUEST_PROXY"]}`);
    }

    // 发起异步请求，通过闭包存储结果/错误
    rp(rpOptions)
      .then(res => {
        responseData = res;
        requestDone = true;
      })
      .catch(err => {
        // 统一错误格式，兼容原代码的错误处理逻辑
        if (err.statusCode) {
          requestError = new Error(`API 请求失败，状态码: ${err.statusCode}, 响应内容: ${JSON.stringify(err.error || err.message)}`);
        } else {
          requestError = new Error(`请求异常: ${err.message}`);
        }
        requestDone = true;
      });

    // 阻塞线程直到请求完成
    deasync.loopWhile(() => !requestDone);

    // 有错误则抛出，无错误则返回响应数据
    if (requestError) throw requestError;
    return responseData;
  }

  // 遍历所有文章文件
  const files = fs.readdirSync(postsDir).filter(file => file.endsWith(".md"));
  for (const file of files) {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    // 分割 Front-matter 和正文
    const [frontMatterBlock, ...contentRest] = content.split("---").slice(1);
    if (!frontMatterBlock) {
      log.warn(`[Mastodon Comments Helper] ${file} 无 Front-matter，跳过`);
      continue;
    }

    // 解析 Front-matter
    let frontMatter;
    try {
      frontMatter = yaml.load(frontMatterBlock);
    } catch (e) {
      log.error(`[Mastodon Comments Helper] 解析 ${file} Front-matter 失败:`, e);
      continue;
    }

    // 过滤无需处理的文章
    if (frontMatter.comments === false || frontMatter["toot-id"]) {
      continue;
    }

    const postTitle = frontMatter.title || "无标题文章";
    log.info(`[Mastodon Comments Helper] 为文章 "${postTitle}" 创建 Mastodon 嘟文...`);

    // 构建嘟文内容
    let tootContent = "";
    if (mastodonConfig["TOOT_TEMPLATE"]) {
      tootContent = mastodonConfig["TOOT_TEMPLATE"].replaceAll("{{postTitle}}", postTitle);
    } else {
      tootContent = `我发布了一篇文章《${postTitle}》，一起来评论吧~`;
    }

    try {
      // 同步调用 Mastodon API
      const apiUrl = `https://${mastodonConfig.MASTODON_DOMAIN}/api/v1/statuses`;
      const requestOptions = {
        json: {
          status: tootContent,
          visibility: "public"
        },
        headers: {
          "Authorization": `Bearer ${mastodonConfig.MASTODON_TOKEN}`,
          "Content-Type": "application/json"
        },
        timeout: 10000
      };

      // 调用封装的同步请求函数
      const responseData = syncPostRequest(apiUrl, requestOptions);

      // 处理响应
      const tootId = responseData.id;
      const tootURL = responseData.url;
      log.info(`[Mastodon Comments Helper] 成功创建嘟文，ID: ${tootId}`);

      // 插入 toot-id 到 date 上一行
      const frontMatterLines = frontMatterBlock.trim().split("\n");
      const newFrontMatterLines = [];
      let dateLineIndex = -1;
      for (let i = 0; i < frontMatterLines.length; i++) {
        const line = frontMatterLines[i].trim();
        if (line.startsWith("date:")) {
          dateLineIndex = i;
          break;
        }
      }

      if (dateLineIndex !== -1) {
        newFrontMatterLines.push(
          ...frontMatterLines.slice(0, dateLineIndex),
          `toot-id: "${tootId}"`,
          ...frontMatterLines.slice(dateLineIndex)
        );
      } else {
        newFrontMatterLines.push(...frontMatterLines, `toot-id: "${tootId}"`);
      }

      // 重新拼接并写入文件
      const newFrontMatter = newFrontMatterLines.join("\n").trim() + "\n";
      const newContent = `---\n${newFrontMatter}---${contentRest.join("---")}`;
      fs.writeFileSync(filePath, newContent, "utf8");
      log.info(`[Mastodon Comments Helper] 已将 toot-id 写入文件: ${file}`);
      if (tootURL) {
        log.info(`[Mastodon Comments Helper] 嘟文链接：${tootURL}`);
      }
    } catch (apiError) {
      log.error("[Mastodon Comments Helper] 创建嘟文失败:", apiError.message);
    }
  }
});

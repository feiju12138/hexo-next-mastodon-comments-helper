# Hexo NexT Mastodon Comments Helper

![Package Version](https://img.shields.io/github/package-json/v/feiju12138/hexo-next-mastodon-comments-helper?style=flat-square)

Auto add `toot-id` in post header.

## Install

```bash
npm install hexo-next-mastodon-comments-helper
```

## Configure

Set the value `enable` to `true`, add the Mastodon instance domain (`MASTODON_DOMAIN`), and add the Mastodon instance user token (`MASTODON_TOKEN`). You can config those in both **hexo** or **theme** `_config.yml`:

```yml next/_config.yml
# Mastodon Comments Helper
# For more information: https://github.com/feiju12138/mastodon-comments https://github.com/feiju12138/hexo-next-mastodon-comments https://github.com/feiju12138/hexo-next-mastodon-comments-helper
mastodon-comments-helper:
  enable: false
  MASTODON_DOMAIN: mastodon.social # Mastodon 实例域名
  MASTODON_TOKEN: xxx # Mastodon 实例中具有写入权限的用户令牌
  # TOOT_TEMPLATE: "我发布了一篇文章《{{postTitle}}》，一起来评论吧~" # 自定义嘟文模板
  # REQUEST_PROXY: http://127.0.0.1:7890 # HTTP请求代理
```

## Just do it!

Every time you run `hexo s` or `hexo g`, it will automatically add `toot-id` to the post header.

It will add `toot-id` before `date`.

```md source/_posts/Test.md
---
title: Hello World
toot-id: "116164221651686918"
date: 2016-01-02 15:04:05
---
```

If `date` does not exist, it will add `toot-id` at the end.

```md source/_posts/Test.md
---
title: Hello World
toot-id: "116164221651686918"
---
```

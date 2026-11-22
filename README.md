# VeneraX 漫画源订阅

整理两份公开上游订阅，并加入「漫蛙·新版站点」0.1.0。

| 分类 | 数量 | 地址 |
| --- | ---: | --- |
| 主订阅 · 列表和详情通过 | 73 | [index.json](https://raw.githubusercontent.com/Aezir/venera-sources/main/index.json) |
| 部分可用 · 列表通过 | 1 | [limited/index.json](https://raw.githubusercontent.com/Aezir/venera-sources/main/limited/index.json) |
| 本轮公开入口不可用 | 12 | [unavailable/index.json](https://raw.githubusercontent.com/Aezir/venera-sources/main/unavailable/index.json) |
| 未确认、需配置或代码复核 | 12 | [review.json](review.json) |

在 VeneraX 的「漫画源 → 来源库」添加主订阅地址。第三方条目链接到实测版本所在的上游固定提交。

## 核验条件

2026-11-22使用官方 VeneraX 3.0.1 和 Android 15 x86_64。在同一网络下使用独立测试用户，匿名调用各源的推荐或搜索入口，再尝试打开一个详情。两份上游有 135 个条目、115 份不同脚本和 97 个源键。其中 108 份脚本运行了原生测试。

主订阅表示列表与详情通过。第三方脚本的阅读图片未逐源验收。对未通过且可直接运行的候选做了低并发复测。本轮不可用可能来自临时网络、站点区域限制或源脚本问题。只返回空列表、需要登录或自建后端、以及待代码复核的条目另行标明。

[实测明细](RESULTS.md) · [机器可读记录](audit.json) · [独立漫蛙源](sources/manwa-web-v2-0.1.0.js)

## 上游

- [handahao666-boop/venera_comic_source](https://github.com/handahao666-boop/venera_comic_source/tree/a59bdea5b75b00f3770c2b831ef830aac05cc67e/)
- [kuiti/manga-source-index](https://github.com/kuiti/manga-source-index/tree/1850cfa5903a6c5105d57860ff6dc7f5607df00a/05-venera-sources/sources/)

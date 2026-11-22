class ManwaWebV2 extends ComicSource {
  name = "漫蛙·新版站点";
  key = "manwa_web_v2";
  version = "0.1.0";
  minAppVersion = "3.0.1";

  domain = "https://manwarr.cc";
  imageKeyRequest = null;
  openChaptersByComic = new Map();
  categoryTags = {
    all: "",
    adventure: "冒险",
    hotblooded: "热血",
    fantasy: "奇幻",
    comedy: "搞笑",
    action: "战斗",
  };

  siteUrl(path, query = {}) {
    const search = Object.entries(query)
      .map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(value))
      .join("&");
    return this.domain + path + (search ? "?" + search : "");
  }

  absoluteMediaUrl(url) {
    if (typeof url !== "string") return "";
    if (url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    return url.startsWith("/") ? this.domain + url : "";
  }

  checkResponse(res, path) {
    if (res.status !== 200) {
      throw new Error(path + " 返回 HTTP " + res.status);
    }
  }

  async html(path) {
    const res = await Network.get(this.siteUrl(path));
    this.checkResponse(res, path);
    return res.body;
  }

  async api(path, query, payload) {
    const url = this.siteUrl(path, query);
    const res = payload === undefined
      ? await Network.get(url)
      : await Network.post(url, { "Content-Type": "application/json" }, JSON.stringify(payload));
    this.checkResponse(res, path);
    const result = JSON.parse(res.body);
    if (result.code !== 200 || result.data == null) {
      throw new Error(path + " 返回 " + (result.msg || result.code || "无数据"));
    }
    return result.data;
  }

  comicsPage(data, pageSize) {
    if (!Array.isArray(data.list)) throw new Error("漫蛙返回的漫画列表格式已变化");
    const comics = data.list.flatMap((item) => {
      const id = item.url?.match(/^\/comic\/(\d+)\/?$/)?.[1] || String(item.id ?? "");
      if (!/^\d+$/.test(id) || !item.title) return [];
      const tags = Array.isArray(item.tags)
        ? item.tags
        : (item.tags || "").split(/[,，、|]/).map((tag) => tag.trim()).filter(Boolean);
      return [new Comic({
        id: id,
        title: item.title,
        cover: this.absoluteMediaUrl(item.pic || item.cover),
        subTitle: item.author || "",
        description: item.intro || item.description || "",
        tags: tags,
      })];
    });
    return { comics, maxPage: Math.max(1, Math.ceil((Number(data.total) || 0) / pageSize)) };
  }

  async loadRank(page, timeType) {
    const pageSize = 10;
    const data = await this.api("/api/rank", { page, pageSize, sort: 0, timeType });
    return this.comicsPage(data, pageSize);
  }

  explore = [{
    title: "漫蛙新版·热门推荐",
    type: "multiPageComicList",
    load: (page) => this.loadRank(page, 0),
  }];

  search = {
    load: async (keyword, _options, page) => {
      const pageSize = 20;
      const data = await this.api("/api/search", { type: "mh", page, pageSize, keyword });
      return this.comicsPage(data, pageSize);
    },
  };

  category = {
    title: "漫蛙新版分类",
    parts: [{
      name: "漫画类型",
      type: "fixed",
      categories: Object.entries(this.categoryTags).map(([slug, tag]) => ({
        label: tag || "全部",
        target: { page: "category", attributes: { category: "漫画类型", param: slug } },
      })),
    }],
    enableRankingPage: true,
  };

  categoryComics = {
    load: async (_category, param, _options, page) => {
      const slug = param || "all";
      if (!Object.prototype.hasOwnProperty.call(this.categoryTags, slug)) {
        throw new Error("该分类不在本源的支持列表中");
      }
      const path = slug === "all" ? "/api/cate/" : "/api/cate/" + slug;
      const pageSize = 36;
      const data = await this.api(path, {}, {
        page: { page, pageSize },
        category: "comic",
        sort: 0,
        comic: { status: -1, day: 0, tag: this.categoryTags[slug], level: 0, areaId: 0 },
      });
      return this.comicsPage(data, pageSize);
    },
    ranking: {
      options: ["0-总榜", "1-月榜", "2-周榜", "3-日榜"],
      load: (option, page) => this.loadRank(page, Number(option) || 0),
    },
  };

  async readDetails(id) {
    if (!/^\d+$/.test(id)) throw new Error("漫画编号无效");
    const doc = new HtmlDocument(await this.html("/comic/" + id));
    const title = doc.querySelector("#page-title")?.text?.trim();
    if (!title) throw new Error("漫画详情页缺少标题");
    const cover = doc.querySelector(".comic-cover")?.attributes || {};
    const tags = doc.querySelectorAll("#tagsContainer a").map((tag) => tag.text.trim());
    const authors = doc.querySelectorAll("#author-container a").map((author) => author.text.trim());
    const status = doc.querySelector("#status")?.text?.trim() || "";
    const chapters = new Map();
    for (const chapter of doc.querySelectorAll("a.chapter-item[data-locked='false']")) {
      const chapterId = chapter.attributes["data-id"];
      const chapterTitle = chapter.attributes["data-title"] || chapter.querySelector(".chapter-name")?.text;
      if (/^\d+$/.test(chapterId) && chapterTitle) chapters.set(chapterId, chapterTitle.trim());
    }
    this.openChaptersByComic.set(id, chapters);
    return new ComicDetails({
      title,
      cover: this.absoluteMediaUrl(cover["data-original-cover"] || cover["data-src"] || cover.src),
      description: doc.querySelector(".comic-desc")?.text?.trim() || "",
      subtitle: doc.querySelector("#newch")?.text?.trim() || "",
      updateTime: doc.querySelector("#updateTime")?.text?.trim() || "",
      tags: { 作者: authors, 分类: tags, 状态: status ? [status] : [] },
      chapters,
    });
  }

  async readChapter(id, chapterId) {
    if (!/^\d+$/.test(id) || !/^\d+$/.test(chapterId)) throw new Error("章节编号无效");
    if (!this.openChaptersByComic.has(id)) await this.readDetails(id);
    if (!this.openChaptersByComic.get(id).has(chapterId)) {
      throw new Error("该章节未标记为开放");
    }

    const chapter = await this.html("/comic/" + id + "/" + chapterId);
    const config = chapter.match(/window\.IMAGE_SOURCES\s*=\s*(\[[^\r\n]+\])\s*;/);
    const routes = config ? JSON.parse(config[1]) : [];
    const defaultRoute = routes.find((source) => source.type === "no" && /^https:\/\//.test(source.url));
    const path = "/api/comic/image/" + chapterId;
    const load = (page) => this.api(path, {
      page,
      page_size: 60,
      image_source: defaultRoute?.url || "",
    });
    const first = await load(1);
    const totalPages = Number(first.pagination?.total_pages) || 1;
    const images = [];
    const append = (data) => {
      if (!Array.isArray(data.images) || !data.images.length) throw new Error("本批章节图片为空");
      for (const image of data.images) {
        const url = this.absoluteMediaUrl(image.url);
        if (!url) throw new Error("章节包含无效图片地址");
        images.push(url);
      }
    };
    append(first);
    for (let page = 2; page <= totalPages; page++) append(await load(page));
    return { images };
  }

  browserImageKey() {
    if (!this.imageKeyRequest) {
      this.imageKeyRequest = this.html("/static/assets/js/base.js").then((script) => {
        // This is the free reader's public image format; the browser ships the same key.
        const match = script.match(/\bAES_KEY\s*[:=]\s*(['"])([^'"]+)\1/);
        const key = match && new Uint8Array(Convert.encodeUtf8(match[2])).slice(0, 32).buffer;
        if (!key || key.byteLength !== 32) throw new Error("公开阅读器的图片格式已变化");
        return key;
      }).catch((error) => {
        this.imageKeyRequest = null;
        throw error;
      });
    }
    return this.imageKeyRequest;
  }

  isImage(bytes) {
    return (bytes[0] === 0xff && bytes[1] === 0xd8)
      || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      || (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
      || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
  }

  imageConfig(url) {
    if (!/\/en_images\//.test(url)) return { url };
    return {
      url,
      onResponse: async (data) => {
        const bytes = new Uint8Array(data);
        if (this.isImage(bytes)) return data;
        if (bytes.length < 32 || bytes.length % 16 !== 0) throw new Error("图片数据格式无效");
        const key = await this.browserImageKey();
        const image = new Uint8Array(Convert.decryptAesCbc(
          bytes.slice(16).buffer,
          key,
          bytes.slice(0, 16).buffer,
        ));
        if (!this.isImage(image)) throw new Error("图片解码结果无效");
        const padding = image[image.length - 1];
        if (padding < 1 || padding > 16 || !image.slice(-padding).every((value) => value === padding)) {
          throw new Error("图片填充格式无效");
        }
        return image.slice(0, image.length - padding).buffer;
      },
    };
  }

  comic = {
    loadInfo: (id) => this.readDetails(id),
    loadEp: (id, chapterId) => this.readChapter(id, chapterId),
    onImageLoad: (url) => this.imageConfig(url),
    onThumbnailLoad: (url) => this.imageConfig(url),
    link: {
      domains: ["manwarr.cc"],
      linkToId: (url) => url.match(/^https:\/\/manwarr\.cc\/comic\/(\d+)(?:[/?#]|$)/i)?.[1] || null,
    },
  };
}

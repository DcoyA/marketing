const NAVER_BLOG_API = "https://openapi.naver.com/v1/search/blog.json";
const NAVER_SHOPPING_API = "https://openapi.naver.com/v1/search/shop.json";
const NAVER_WEBKR_API = "https://openapi.naver.com/v1/search/webkr.json";

const YT_SEARCH_API = "https://www.googleapis.com/youtube/v3/search";
const YT_CHANNELS_API = "https://www.googleapis.com/youtube/v3/channels";
const PSI_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function s(v) {
  return String(v || "").trim();
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function stripHtml(text = "") {
  return s(text)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr || []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeUrl(url = "") {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return s(url);
  }
}

function extractDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function extractUrlsFromText(text = "") {
  const matches = s(text).match(/https?:\/\/[^\s<>"')]+/g) || [];
  return uniqBy(
    matches.map((x) => x.replace(/[),.;]+$/g, "")).map(normalizeUrl),
    (x) => x
  );
}

function isInstagramProfileUrl(url = "") {
  const domain = extractDomain(url);
  if (!(domain === "instagram.com" || domain.endsWith(".instagram.com"))) return false;
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (!path || path === "/") return false;
    if (["/p/", "/reel/", "/reels/", "/stories/", "/explore/"].some((x) => path.startsWith(x))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isHomepageCandidateUrl(url = "") {
  const domain = extractDomain(url);
  if (!domain) return false;
  const blocked = [
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "blog.naver.com",
    "search.naver.com",
    "cafe.naver.com",
    "news.naver.com",
    "facebook.com",
    "x.com",
    "twitter.com",
    "tiktok.com",
  ];
  if (blocked.some((x) => domain.includes(x))) return false;
  return true;
}

function makeEmptyStatus() {
  return {
    fetchOk: false,
    parseOk: false,
    candidateFound: false,
    verified: false,
    total: 0,
    rawItems: 0,
    status: null,
    error: null,
    errorCount: 0,
  };
}

function buildStatus(rows) {
  const list = rows || [];
  const rawItems = list.reduce((acc, row) => {
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    return acc + items.length;
  }, 0);
  const total = list.reduce((acc, row) => acc + n(row?.data?.total), 0);
  const errors = list.map((row) => row?.error).filter(Boolean);

  return {
    fetchOk: list.length > 0 && list.every((x) => !!x.ok),
    parseOk: list.length > 0 && list.every((x) => x.data !== null),
    candidateFound: rawItems > 0,
    verified: false,
    total,
    rawItems,
    status: list.length ? list[list.length - 1].status : null,
    error: errors[0] || null,
    errorCount: errors.length,
  };
}

function buildYoutubeStatus(searchRows, channelRes, candidateCount) {
  const searchStatus = buildStatus(searchRows);
  const channelOk = !!channelRes?.ok;
  const channelParsed = channelRes?.data !== null && channelRes?.data !== undefined;
  const channelErr = channelRes?.error || channelRes?.data?.error?.message || null;

  return {
    fetchOk: searchStatus.fetchOk && channelOk,
    parseOk: searchStatus.parseOk && channelParsed,
    candidateFound: candidateCount > 0,
    verified: false,
    total: searchStatus.total,
    rawItems: searchStatus.rawItems,
    status: searchStatus.status || channelRes?.status || null,
    error: searchStatus.error || channelErr || null,
    errorCount: (searchStatus.errorCount || 0) + (channelErr ? 1 : 0),
  };
}

function makeBaseResponse(input) {
  return {
    ok: true,
    input,
    discovery: {
      assets: {
        homepage: null,
        instagram: null,
        youtube: null,
        naverStore: null,
        map: null,
      },
      assetDetails: {
        homepage: null,
        instagram: null,
        youtube: null,
        naverStore: null,
        map: null,
      },
      verified: {
        homepage: {
          found: false,
          verified: false,
          confidence: "low",
          source: null,
          reason: "stage 5: candidate only",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
        instagram: {
          found: false,
          verified: false,
          confidence: "low",
          source: null,
          reason: "stage 5: candidate only",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
        youtube: {
          found: false,
          verified: false,
          confidence: "low",
          source: null,
          reason: "stage 5: candidate only",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
        naverStore: {
          found: false,
          verified: false,
          confidence: "low",
          source: null,
          reason: "stage 5: candidate only",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
        map: {
          found: false,
          verified: false,
          confidence: "low",
          source: null,
          reason: "stage 5: not connected",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
      },
      pageSpeed: {
        ok: false,
        error: "stage 5: not run",
      },
      counts: {
        naverBlogItems: 0,
        naverShoppingItems: 0,
        naverWebHomepageItems: 0,
        naverWebInstagramItems: 0,
        youtubeItems: 0,
        regionHits: 0,
        assetCount: 0,
        verifiedAssetCount: 0,
      },
      sourceStatus: {
        naverBlog: makeEmptyStatus(),
        naverShopping: makeEmptyStatus(),
        naverWebHomepage: makeEmptyStatus(),
        naverWebInstagram: makeEmptyStatus(),
        youtube: makeEmptyStatus(),
        pageSpeed: makeEmptyStatus(),
      },
      rawCount: {
        naverBlogFetched: 0,
        naverShoppingFetched: 0,
        naverWebHomepageFetched: 0,
        naverWebInstagramFetched: 0,
        youtubeSearchFetched: 0,
        youtubeChannelFetched: 0,
        evidenceBuilt: 0,
        verifiedAssets: 0,
      },
    },
    diagnosis: {
      industryLabel: input.industry,
      confidence: "낮음",
      confidenceDescription: "현재는 NAVER + YouTube + PageSpeed 연결 여부만 확인하는 5단계 검증 모드입니다.",
      executiveSummary: "JSON 응답과 NAVER/YouTube/PageSpeed 결과 수집 여부를 점검하는 단계입니다.",
      scores: {
        overall: 0,
        searchVisibility: 0,
        contentPresence: 0,
        localExposure: 0,
        webQuality: 0,
      },
      wins: [],
      risks: [],
      nextActions: [],
      limits: [
        "현재는 NAVER Blog + Shopping + WebKR + YouTube + PageSpeed까지만 연결된 5단계 버전입니다.",
      ],
    },
    evidence: [],
    prescription: {
      stage: {
        code: "pagespeed-stage-5",
        title: "PageSpeed 연결 점검 단계",
        description: "JSON 반환과 NAVER/YouTube/PageSpeed 결과 수집만 우선 검증합니다.",
      },
      priorityChannels: ["NAVER Blog", "NAVER Shopping", "NAVER WebKR", "YouTube", "PageSpeed"],
      thirtyDayPlan: [],
      ninetyDayPlan: [],
    },
    debug: {
      stage: "pagespeed-stage-5",
      env: {
        naverClientId: false,
        naverClientSecret: false,
        youtubeApiKey: false,
        pageSpeedApiKey: false,
      },
      queries: {
        blog: [],
        shopping: [],
        homepage: [],
        instagram: [],
        youtube: [],
      },
      requestLog: [],
      candidates: {
        homepage: [],
        instagram: [],
        youtube: [],
      },
    },
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    text,
    data,
    error:
      data?.errorMessage ||
      data?.error?.message ||
      (!res.ok ? text.slice(0, 200) : null) ||
      null,
  };
}

async function runNaverBatch({ endpoint, queries, headers, sourceLabel, debug }) {
  const rows = [];
  for (const query of queries) {
    const url = `${endpoint}?query=${encodeURIComponent(query)}&display=10&start=1&sort=sim`;
    const result = await fetchJson(url, { headers });
    const items = Array.isArray(result?.data?.items) ? result.data.items : [];
    const total = n(result?.data?.total);

    debug.requestLog.push({
      source: sourceLabel,
      query,
      status: result.status,
      ok: result.ok,
      itemCount: items.length,
      total,
      error: result.error,
    });

    rows.push({ query, source: sourceLabel, ...result });
    if (result.status === 429) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return rows;
}

async function runYoutubeSearchBatch({ queries, apiKey, debug }) {
  const rows = [];
  for (const query of queries) {
    const url =
      `${YT_SEARCH_API}?part=snippet&type=channel&maxResults=8` +
      `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;

    const result = await fetchJson(url);
    const items = Array.isArray(result?.data?.items) ? result.data.items : [];

    debug.requestLog.push({
      source: "youtube-search",
      query,
      status: result.status,
      ok: result.ok,
      itemCount: items.length,
      total: items.length,
      error: result.error,
    });

    rows.push({ query, source: "youtube-search", ...result });
    await new Promise((r) => setTimeout(r, 180));
  }
  return rows;
}

async function fetchYoutubeChannels(channelIds, apiKey, debug) {
  const ids = uniqBy((channelIds || []).filter(Boolean), (x) => x);
  if (!ids.length) return { ok: true, status: 200, data: { items: [] }, error: null };

  const url =
    `${YT_CHANNELS_API}?part=snippet,statistics&id=${encodeURIComponent(ids.join(","))}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const result = await fetchJson(url);

  debug.requestLog.push({
    source: "youtube-channels",
    query: `${ids.length} channel ids`,
    status: result.status,
    ok: result.ok,
    itemCount: Array.isArray(result?.data?.items) ? result.data.items.length : 0,
    total: Array.isArray(result?.data?.items) ? result.data.items.length : 0,
    error: result.error,
  });

  return result;
}

async function fetchPageSpeed(url, apiKey, debug) {
  if (!url) {
    return { ok: false, status: null, data: null, error: "homepage missing" };
  }
  if (!apiKey) {
    return { ok: false, status: null, data: null, error: "PAGESPEED_API_KEY missing" };
  }

  const reqUrl =
    `${PSI_API}?url=${encodeURIComponent(url)}` +
    `&strategy=mobile&key=${encodeURIComponent(apiKey)}`;

  const result = await fetchJson(reqUrl);

  debug.requestLog.push({
    source: "pagespeed",
    query: extractDomain(url),
    status: result.status,
    ok: result.ok,
    itemCount: result?.data ? 1 : 0,
    total: result?.data ? 1 : 0,
    error: result.error,
  });

  return result;
}

function buildBlogEvidence(rows) {
  const all = [];
  for (const row of rows || []) {
    const query = s(row?.query);
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    for (const item of items) {
      all.push({
        type: "brand-mention",
        source: "naver-blog",
        title: stripHtml(item?.title),
        url: s(item?.link),
        snippet: stripHtml(item?.description),
        score: 38,
        meta: {
          query,
          blogName: s(item?.bloggername),
          postDate: s(item?.postdate),
        },
      });
    }
  }
  return uniqBy(all, (x) => x.url).slice(0, 8);
}

function buildShoppingEvidence(rows) {
  const all = [];
  for (const row of rows || []) {
    const query = s(row?.query);
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    for (const item of items) {
      all.push({
        type: "store-candidate",
        source: "naver-shopping",
        title: stripHtml(item?.title),
        url: s(item?.link),
        snippet: stripHtml(item?.mallName),
        score: 52,
        meta: {
          query,
          mallName: s(item?.mallName),
          brand: s(item?.brand),
          maker: s(item?.maker),
          price: s(item?.lprice),
          productId: s(item?.productId),
        },
      });
    }
  }
  return uniqBy(all, (x) => x.url).slice(0, 8);
}

function buildHomepageCandidates(rows, companyName) {
  const out = [];
  for (const row of rows || []) {
    const query = s(row?.query);
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    for (const item of items) {
      const title = stripHtml(item?.title);
      const snippet = stripHtml(item?.description);
      const rawLink = s(item?.link);
      const extracted = extractUrlsFromText(`${title} ${snippet}`);
      const urlPool = uniqBy([rawLink, ...extracted].filter(Boolean), (x) => x);

      for (const url of urlPool) {
        if (!isHomepageCandidateUrl(url)) continue;

        let score = 20;
        const joined = `${title} ${snippet} ${url}`;
        if (joined.includes(companyName)) score += 20;
        if (joined.includes("공식")) score += 10;
        if (joined.includes("홈페이지")) score += 10;

        out.push({
          title,
          url: normalizeUrl(url),
          source: "naver-webkr",
          confidence: score >= 50 ? "medium" : "low",
          snippet,
          score,
          meta: { query, domain: extractDomain(url) },
        });
      }
    }
  }
  return uniqBy(out.sort((a, b) => b.score - a.score), (x) => x.url).slice(0, 10);
}

function buildInstagramCandidates(rows, companyName) {
  const out = [];
  for (const row of rows || []) {
    const query = s(row?.query);
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    for (const item of items) {
      const title = stripHtml(item?.title);
      const snippet = stripHtml(item?.description);
      const rawLink = s(item?.link);
      const extracted = extractUrlsFromText(`${title} ${snippet}`);
      const urlPool = uniqBy([rawLink, ...extracted].filter(Boolean), (x) => x);

      for (const url of urlPool) {
        if (!isInstagramProfileUrl(url)) continue;

        let score = 20;
        const joined = `${title} ${snippet} ${url}`;
        if (joined.includes(companyName)) score += 20;
        if (joined.includes("공식")) score += 10;
        if (joined.toLowerCase().includes("instagram")) score += 5;

        out.push({
          title,
          url: normalizeUrl(url),
          source: "naver-webkr",
          confidence: score >= 50 ? "medium" : "low",
          snippet,
          score,
          meta: { query, domain: extractDomain(url) },
        });
      }
    }
  }
  return uniqBy(out.sort((a, b) => b.score - a.score), (x) => x.url).slice(0, 10);
}

function buildYoutubeCandidates(searchRows, channelsRes, companyName) {
  const company = s(companyName).toLowerCase();
  const channelMap = {};
  const channelItems = Array.isArray(channelsRes?.data?.items) ? channelsRes.data.items : [];

  for (const item of channelItems) {
    channelMap[s(item?.id)] = item;
  }

  const out = [];

  for (const row of searchRows || []) {
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    for (const item of items) {
      const channelId = s(item?.id?.channelId || item?.snippet?.channelId);
      if (!channelId) continue;

      const detail = channelMap[channelId] || {};
      const snippet = detail?.snippet || {};
      const stats = detail?.statistics || {};

      const title = stripHtml(snippet?.title || item?.snippet?.title);
      const desc = stripHtml(snippet?.description || item?.snippet?.description);
      const customUrl = s(snippet?.customUrl);
      const url = customUrl
        ? `https://www.youtube.com/@${customUrl.replace(/^@/, "")}`
        : `https://www.youtube.com/channel/${channelId}`;

      let score = 10;
      const joined = `${title} ${desc} ${customUrl}`.toLowerCase();
      if (joined.includes(company)) score += 25;
      if (joined.includes("official") || joined.includes("공식")) score += 10;

      const subs = n(stats?.subscriberCount);
      const videos = n(stats?.videoCount);
      const views = n(stats?.viewCount);

      if (subs >= 100000) score += 8;
      else if (subs >= 10000) score += 5;
      if (videos >= 20) score += 4;
      if (views >= 1000000) score += 4;

      out.push({
        title,
        url,
        source: "youtube",
        confidence: score >= 45 ? "medium" : "low",
        snippet: desc,
        score,
        meta: {
          subscribers: subs,
          videoCount: videos,
          viewCount: views,
          channelId,
          customUrl,
        },
      });
    }
  }

  return uniqBy(out.sort((a, b) => b.score - a.score), (x) => x.url).slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "pagespeed-stage-5",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed",
      allowedMethods: ["GET", "POST"],
    });
  }

  try {
    const body = req.body || {};
    const input = {
      companyName: s(body.companyName),
      industry: s(body.industry),
      region: s(body.region),
      email: s(body.email),
    };

    if (!input.companyName) {
      return res.status(400).json({
        ok: false,
        error: "companyName is required",
        input,
      });
    }

    const response = makeBaseResponse(input);

    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "";
    const PAGESPEED_API_KEY = process.env.PAGESPEED_API_KEY || "";

    response.debug.env.naverClientId = !!NAVER_CLIENT_ID;
    response.debug.env.naverClientSecret = !!NAVER_CLIENT_SECRET;
    response.debug.env.youtubeApiKey = !!YOUTUBE_API_KEY;
    response.debug.env.pageSpeedApiKey = !!PAGESPEED_API_KEY;

    const blogQueries = uniqBy(
      [input.companyName, [input.companyName, input.industry].filter(Boolean).join(" ")].filter(Boolean),
      (x) => x
    );
    const shoppingQueries = uniqBy(
      [input.companyName, `${input.companyName} 공식`].filter(Boolean),
      (x) => x
    );
    const homepageQueries = uniqBy(
      [`${input.companyName} 공식`, `${input.companyName} 홈페이지`].filter(Boolean),
      (x) => x
    );
    const instagramQueries = uniqBy(
      [`${input.companyName} 인스타그램`, `${input.companyName} 공식 인스타`].filter(Boolean),
      (x) => x
    );
    const youtubeQueries = uniqBy(
      [input.companyName, `${input.companyName} 공식`, `${input.companyName} official`].filter(Boolean),
      (x) => x
    );

    response.debug.queries.blog = blogQueries;
    response.debug.queries.shopping = shoppingQueries;
    response.debug.queries.homepage = homepageQueries;
    response.debug.queries.instagram = instagramQueries;
    response.debug.queries.youtube = youtubeQueries;

    const naverReady = !!NAVER_CLIENT_ID && !!NAVER_CLIENT_SECRET;
    const ytReady = !!YOUTUBE_API_KEY;

    if (!naverReady) {
      response.discovery.sourceStatus.naverBlog.error = "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverBlog.errorCount = 1;
      response.discovery.sourceStatus.naverShopping.error = "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverShopping.errorCount = 1;
      response.discovery.sourceStatus.naverWebHomepage.error = "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverWebHomepage.errorCount = 1;
      response.discovery.sourceStatus.naverWebInstagram.error = "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverWebInstagram.errorCount = 1;
    }

    if (!ytReady) {
      response.discovery.sourceStatus.youtube.error = "YOUTUBE_API_KEY missing";
      response.discovery.sourceStatus.youtube.errorCount = 1;
    }

    let blogRows = [];
    let shoppingRows = [];
    let homepageRows = [];
    let instagramRows = [];

    if (naverReady) {
      const headers = {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      };

      blogRows = await runNaverBatch({
        endpoint: NAVER_BLOG_API,
        queries: blogQueries,
        headers,
        sourceLabel: "naver-blog",
        debug: response.debug,
      });

      shoppingRows = await runNaverBatch({
        endpoint: NAVER_SHOPPING_API,
        queries: shoppingQueries,
        headers,
        sourceLabel: "naver-shopping",
        debug: response.debug,
      });

      homepageRows = await runNaverBatch({
        endpoint: NAVER_WEBKR_API,
        queries: homepageQueries,
        headers,
        sourceLabel: "naver-web-homepage",
        debug: response.debug,
      });

      instagramRows = await runNaverBatch({
        endpoint: NAVER_WEBKR_API,
        queries: instagramQueries,
        headers,
        sourceLabel: "naver-web-instagram",
        debug: response.debug,
      });

      response.discovery.sourceStatus.naverBlog = buildStatus(blogRows);
      response.discovery.sourceStatus.naverShopping = buildStatus(shoppingRows);
      response.discovery.sourceStatus.naverWebHomepage = buildStatus(homepageRows);
      response.discovery.sourceStatus.naverWebInstagram = buildStatus(instagramRows);
    }

    const blogEvidence = buildBlogEvidence(blogRows);
    const shoppingEvidence = buildShoppingEvidence(shoppingRows);
    const homepageCandidates = buildHomepageCandidates(homepageRows, input.companyName);
    const instagramCandidates = buildInstagramCandidates(instagramRows, input.companyName);

    response.debug.candidates.homepage = homepageCandidates.slice(0, 5);
    response.debug.candidates.instagram = instagramCandidates.slice(0, 5);

    let youtubeSearchRows = [];
    let youtubeChannelsRes = { ok: true, status: 200, data: { items: [] }, error: null };
    let youtubeCandidates = [];

    if (ytReady) {
      youtubeSearchRows = await runYoutubeSearchBatch({
        queries: youtubeQueries,
        apiKey: YOUTUBE_API_KEY,
        debug: response.debug,
      });

      const channelIds = uniqBy(
        youtubeSearchRows.flatMap((row) => {
          const items = Array.isArray(row?.data?.items) ? row.data.items : [];
          return items.map((it) => s(it?.id?.channelId || it?.snippet?.channelId)).filter(Boolean);
        }),
        (x) => x
      );

      youtubeChannelsRes = await fetchYoutubeChannels(channelIds, YOUTUBE_API_KEY, response.debug);
      youtubeCandidates = buildYoutubeCandidates(youtubeSearchRows, youtubeChannelsRes, input.companyName);

      response.discovery.sourceStatus.youtube = buildYoutubeStatus(
        youtubeSearchRows,
        youtubeChannelsRes,
        youtubeCandidates.length
      );
    }

    response.debug.candidates.youtube = youtubeCandidates.slice(0, 5);

    response.discovery.counts.naverBlogItems = blogEvidence.length;
    response.discovery.counts.naverShoppingItems = shoppingEvidence.length;
    response.discovery.counts.naverWebHomepageItems = homepageCandidates.length;
    response.discovery.counts.naverWebInstagramItems = instagramCandidates.length;
    response.discovery.counts.youtubeItems = youtubeCandidates.length;
    response.discovery.counts.regionHits = [...blogEvidence, ...shoppingEvidence].filter((x) =>
      s(x.title + " " + x.snippet).includes(input.region)
    ).length;

    response.discovery.rawCount.naverBlogFetched = blogEvidence.length;
    response.discovery.rawCount.naverShoppingFetched = shoppingEvidence.length;
    response.discovery.rawCount.naverWebHomepageFetched = homepageCandidates.length;
    response.discovery.rawCount.naverWebInstagramFetched = instagramCandidates.length;
    response.discovery.rawCount.youtubeSearchFetched = youtubeSearchRows.reduce((acc, row) => {
      const items = Array.isArray(row?.data?.items) ? row.data.items : [];
      return acc + items.length;
    }, 0);
    response.discovery.rawCount.youtubeChannelFetched = Array.isArray(youtubeChannelsRes?.data?.items)
      ? youtubeChannelsRes.data.items.length
      : 0;

    const selectedHomepage = homepageCandidates[0] || null;
    const selectedInstagram = instagramCandidates[0] || null;
    const selectedYoutube = youtubeCandidates[0] || null;

    if (selectedHomepage) {
      response.discovery.assets.homepage = selectedHomepage.url;
      response.discovery.assetDetails.homepage = {
        title: selectedHomepage.title,
        url: selectedHomepage.url,
        source: selectedHomepage.source,
        confidence: selectedHomepage.confidence,
        snippet: selectedHomepage.snippet,
        domain: selectedHomepage.meta.domain,
      };
      response.discovery.verified.homepage = {
        found: true,
        verified: false,
        confidence: selectedHomepage.confidence,
        source: selectedHomepage.source,
        reason: "stage 5 homepage candidate",
        score: selectedHomepage.score,
        candidateCount: homepageCandidates.length,
        url: selectedHomepage.url,
        title: selectedHomepage.title,
      };
    } else {
      response.discovery.verified.homepage.reason = "homepage candidate not found";
    }

    if (selectedInstagram) {
      response.discovery.assets.instagram = selectedInstagram.url;
      response.discovery.assetDetails.instagram = {
        title: selectedInstagram.title,
        url: selectedInstagram.url,
        source: selectedInstagram.source,
        confidence: selectedInstagram.confidence,
        snippet: selectedInstagram.snippet,
        domain: selectedInstagram.meta.domain,
      };
      response.discovery.verified.instagram = {
        found: true,
        verified: false,
        confidence: selectedInstagram.confidence,
        source: selectedInstagram.source,
        reason: "stage 5 instagram candidate",
        score: selectedInstagram.score,
        candidateCount: instagramCandidates.length,
        url: selectedInstagram.url,
        title: selectedInstagram.title,
      };
    } else {
      response.discovery.verified.instagram.reason = "instagram candidate not found";
    }

    if (selectedYoutube) {
      response.discovery.assets.youtube = selectedYoutube.url;
      response.discovery.assetDetails.youtube = {
        title: selectedYoutube.title,
        url: selectedYoutube.url,
        source: selectedYoutube.source,
        confidence: selectedYoutube.confidence,
        snippet: selectedYoutube.snippet,
        subscribers: selectedYoutube.meta.subscribers,
        videoCount: selectedYoutube.meta.videoCount,
        viewCount: selectedYoutube.meta.viewCount,
        channelId: selectedYoutube.meta.channelId,
        customUrl: selectedYoutube.meta.customUrl,
      };
      response.discovery.verified.youtube = {
        found: true,
        verified: false,
        confidence: selectedYoutube.confidence,
        source: selectedYoutube.source,
        reason: "stage 5 youtube candidate",
        score: selectedYoutube.score,
        candidateCount: youtubeCandidates.length,
        url: selectedYoutube.url,
        title: selectedYoutube.title,
      };
    } else {
      response.discovery.verified.youtube.reason = "youtube candidate not found";
    }

    const psiRes = await fetchPageSpeed(response.discovery.assets.homepage, PAGESPEED_API_KEY, response.debug);

    if (psiRes.ok && psiRes.data) {
      const categories = psiRes.data?.lighthouseResult?.categories || {};
      const audits = psiRes.data?.lighthouseResult?.audits || {};

      response.discovery.pageSpeed = {
        ok: true,
        performanceScore: Math.round(n(categories?.performance?.score) * 100),
        accessibilityScore: Math.round(n(categories?.accessibility?.score) * 100),
        bestPracticesScore: Math.round(n(categories?.["best-practices"]?.score) * 100),
        seoScore: Math.round(n(categories?.seo?.score) * 100),
        firstContentfulPaint: s(audits?.["first-contentful-paint"]?.displayValue),
        largestContentfulPaint: s(audits?.["largest-contentful-paint"]?.displayValue),
        speedIndex: s(audits?.["speed-index"]?.displayValue),
      };

      response.discovery.sourceStatus.pageSpeed = {
        fetchOk: true,
        parseOk: true,
        candidateFound: true,
        verified: false,
        total: 1,
        rawItems: 1,
        status: psiRes.status,
        error: null,
        errorCount: 0,
      };
    } else {
      response.discovery.pageSpeed = {
        ok: false,
        error: psiRes.error || "pagespeed failed",
      };
      response.discovery.sourceStatus.pageSpeed = {
        fetchOk: false,
        parseOk: false,
        candidateFound: !!response.discovery.assets.homepage,
        verified: false,
        total: 0,
        rawItems: 0,
        status: psiRes.status || null,
        error: psiRes.error || "pagespeed failed",
        errorCount: 1,
      };
    }

    response.discovery.counts.assetCount = [
      response.discovery.assets.homepage,
      response.discovery.assets.instagram,
      response.discovery.assets.youtube,
      response.discovery.assets.naverStore,
      response.discovery.assets.map,
    ].filter(Boolean).length;

    response.evidence = [...shoppingEvidence, ...blogEvidence].slice(0, 12);
    response.discovery.rawCount.evidenceBuilt = response.evidence.length;

    const hasBlog = response.discovery.sourceStatus.naverBlog.rawItems > 0;
    const hasShopping = response.discovery.sourceStatus.naverShopping.rawItems > 0;
    const hasHomepage = homepageCandidates.length > 0;
    const hasInstagram = instagramCandidates.length > 0;
    const hasYoutube = youtubeCandidates.length > 0;
    const hasPageSpeed = response.discovery.pageSpeed.ok;

    response.diagnosis.confidence =
      hasHomepage || hasInstagram || hasYoutube || hasPageSpeed || hasBlog || hasShopping
        ? "보통"
        : "낮음";

    response.diagnosis.confidenceDescription =
      hasPageSpeed
        ? "PageSpeed까지 포함해 NAVER/YouTube 결과가 수집되었습니다."
        : "JSON은 정상이나 homepage 후보가 없거나 PageSpeed 실행이 되지 않았습니다.";

    response.diagnosis.executiveSummary =
      hasPageSpeed
        ? `${input.companyName} 관련 NAVER/YouTube 후보와 PageSpeed 결과가 수집되었습니다.`
        : `${input.companyName} 관련 NAVER/YouTube 후보는 일부 수집되었으나 PageSpeed는 아직 실행되지 않았습니다.`;

    response.diagnosis.scores = {
      overall: hasPageSpeed ? 48 : hasYoutube ? 40 : 30,
      searchVisibility:
        (hasBlog ? 12 : 0) +
        (hasShopping ? 12 : 0) +
        (hasHomepage ? 12 : 0) +
        (hasInstagram ? 8 : 0) +
        (hasYoutube ? 12 : 0),
      contentPresence: hasYoutube ? 20 : 0,
      localExposure: response.discovery.counts.regionHits > 0 ? 12 : 0,
      webQuality: hasPageSpeed
        ? n(response.discovery.pageSpeed.performanceScore)
        : hasHomepage
          ? 10
          : 0,
    };

    response.diagnosis.wins = [];
    if (hasBlog) response.diagnosis.wins.push("NAVER Blog 검색 결과가 실제로 수집되고 있습니다.");
    if (hasShopping) response.diagnosis.wins.push("NAVER Shopping 검색 결과가 실제로 수집되고 있습니다.");
    if (hasHomepage) response.diagnosis.wins.push("NAVER WebKR에서 homepage 후보가 수집되고 있습니다.");
    if (hasInstagram) response.diagnosis.wins.push("NAVER WebKR에서 instagram 후보가 수집되고 있습니다.");
    if (hasYoutube) response.diagnosis.wins.push("YouTube 채널 후보가 수집되고 있습니다.");
    if (hasPageSpeed) response.diagnosis.wins.push("homepage 후보에 대해 PageSpeed가 실행되었습니다.");

    response.diagnosis.risks = [
      "현재 homepage/instagram/youtube는 후보 단계이며 아직 공식성 검증은 하지 않습니다.",
      "지도 자산과 고급 점수 엔진은 아직 연결되지 않았습니다.",
    ];

    response.diagnosis.nextActions = [
      "프론트에서 discovery.pageSpeed 값이 들어오는지 확인하세요.",
      "sourceStatus.pageSpeed.status, error 값을 확인하세요.",
      "homepage 후보가 잘못 잡히면 debug.candidates.homepage 상위 후보를 먼저 조정하세요.",
    ];

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "internal server error",
      stack:
        process.env.NODE_ENV !== "production"
          ? String(error?.stack || "")
          : undefined,
    });
  }
}

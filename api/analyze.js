const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || "",
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || "",
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || "",
  PAGESPEED_API_KEY: process.env.PAGESPEED_API_KEY || ""
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8"
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

const MARKETPLACE_HOST_HINTS = [
  "shopping.naver.com",
  "search.shopping.naver.com",
  "smartstore.naver.com",
  "adcr.naver.com",
  "cr.shopping.naver.com",
  "link.coupang.com",
  "coupang.com",
  "11st.co.kr",
  "gmarket.co.kr",
  "auction.co.kr",
  "wemakeprice.com",
  "tmon.co.kr",
  "lotteon.com",
  "store.kakao.com",
  "naver.com",
  "blog.naver.com",
  "m.blog.naver.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "facebook.com"
];

function setCommonHeaders(res) {
  Object.entries({ ...JSON_HEADERS, ...CORS_HEADERS }).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

function round(n, digits = 0) {
  const p = 10 ** digits;
  return Math.round((Number(n) || 0) * p) / p;
}

function unique(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function tryParseJson(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function decodeHtml(str = "") {
  return String(str)
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

function stripTags(str = "") {
  return decodeHtml(str);
}

function normalizeText(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/㈜|\(주\)|주식회사|corp\.?|corporation|co\.?,?\s?ltd\.?|inc\.?|limited/g, "")
    .replace(/[^a-z0-9가-힣]/g, "")
    .trim();
}

function isEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function scoreNameMatch(companyName, ...texts) {
  const target = normalizeText(companyName);
  if (!target) return 0;

  let score = 0;
  const normalizedTexts = texts.map((t) => normalizeText(t)).filter(Boolean);
  const joined = normalizedTexts.join(" ");

  if (joined.includes(target)) score += 50;

  normalizedTexts.forEach((text) => {
    if (text === target) score += 35;
    else if (text.includes(target) || target.includes(text)) score += 20;
  });

  return clamp(score, 0, 100);
}

function tokenIncludes(base = "", target = "") {
  const a = normalizeText(base);
  const b = normalizeText(target);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function getHostname(url = "") {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function getOrigin(url = "") {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return null;
  }
}

function looksLikeMarketplace(hostname = "") {
  const host = hostname.toLowerCase();
  return MARKETPLACE_HOST_HINTS.some((hint) => host === hint || host.endsWith(`.${hint}`));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return tryParseJson(req.body, {});
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      resolve(tryParseJson(data, {}));
    });
    req.on("error", () => resolve({}));
  });
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    const text = await res.text();
    const data = tryParseJson(text, null);

    return {
      ok: res.ok,
      status: res.status,
      text,
      data
    };
  } finally {
    clearTimeout(timer);
  }
}

function pickIndustryLabel(industry = "") {
  const s = String(industry || "").trim();
  const n = normalizeText(s);

  if (!s) return "일반";
  if (n.includes("이커머스") || n.includes("쇼핑몰") || n.includes("커머스") || n.includes("스토어")) return "이커머스 / 쇼핑몰";
  if (n.includes("병원") || n.includes("의원") || n.includes("치과") || n.includes("한의원")) return "병원 / 의료";
  if (n.includes("카페") || n.includes("식당") || n.includes("음식") || n.includes("외식") || n.includes("레스토랑")) return "외식 / 매장";
  if (n.includes("학원") || n.includes("교육") || n.includes("과외")) return "교육 / 학원";
  if (n.includes("부동산")) return "부동산";
  if (n.includes("뷰티") || n.includes("미용") || n.includes("에스테틱") || n.includes("네일")) return "뷰티";
  if (n.includes("b2b") || n.includes("제조") || n.includes("솔루션") || n.includes("saas") || n.includes("소프트웨어")) return "B2B / 솔루션";
  return s;
}

function buildBusinessProfile(input) {
  const n = normalizeText(input.industry);
  const industryLabel = pickIndustryLabel(input.industry);
  const hasRegion = !!String(input.region || "").trim();

  const isEcommerce =
    n.includes("이커머스") || n.includes("쇼핑몰") || n.includes("커머스") || n.includes("스토어");
  const isRestaurant =
    n.includes("카페") || n.includes("식당") || n.includes("음식") || n.includes("레스토랑") || n.includes("외식");
  const isMedical =
    n.includes("병원") || n.includes("의원") || n.includes("치과") || n.includes("한의원");
  const isEducation =
    n.includes("학원") || n.includes("교육") || n.includes("과외");
  const isRealEstate =
    n.includes("부동산");
  const isBeauty =
    n.includes("뷰티") || n.includes("미용") || n.includes("에스테틱") || n.includes("네일");
  const isB2B =
    n.includes("b2b") || n.includes("제조") || n.includes("솔루션") || n.includes("saas") || n.includes("소프트웨어");

  const localBusiness = hasRegion && (isRestaurant || isMedical || isEducation || isBeauty || isRealEstate);

  let type = "general";
  if (isEcommerce) type = "ecommerce";
  else if (isRestaurant) type = "restaurant";
  else if (isMedical) type = "medical";
  else if (isEducation) type = "education";
  else if (isRealEstate) type = "realestate";
  else if (isBeauty) type = "beauty";
  else if (isB2B) type = "b2b";

  return {
    type,
    industryLabel,
    localBusiness,
    hasRegion,
    flags: {
      isEcommerce,
      isRestaurant,
      isMedical,
      isEducation,
      isRealEstate,
      isBeauty,
      isB2B
    }
  };
}

function buildQueries(input) {
  const company = String(input.companyName || "").trim();
  const industry = String(input.industry || "").trim();
  const region = String(input.region || "").trim();

  return {
    blog: unique([
      company,
      `${company} 공식`,
      `${company} 후기`,
      region ? `${company} ${region}` : "",
      industry ? `${company} ${industry}` : ""
    ]).slice(0, 4),
    shopping: unique([
      company,
      `${company} 공식`,
      industry ? `${company} ${industry}` : "",
      `${company} 브랜드`
    ]).slice(0, 4),
    youtube: unique([
      company,
      `${company} official`,
      `${company} korea`
    ]).slice(0, 3)
  };
}

async function naverSearch(endpoint, query, extra = {}) {
  if (!ENV.NAVER_CLIENT_ID || !ENV.NAVER_CLIENT_SECRET || !query) {
    return {
      ok: false,
      total: 0,
      items: [],
      error: "NAVER credentials missing or empty query"
    };
  }

  const params = new URLSearchParams({
    query,
    display: String(extra.display || 5),
    start: String(extra.start || 1),
    sort: extra.sort || "sim"
  });

  const url = `https://openapi.naver.com/v1/search/${endpoint}.json?${params.toString()}`;

  const result = await fetchJson(url, {
    headers: {
      "X-Naver-Client-Id": ENV.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": ENV.NAVER_CLIENT_SECRET
    }
  });

  if (!result.ok) {
    return {
      ok: false,
      total: 0,
      items: [],
      status: result.status,
      error: result.text || "NAVER API failed"
    };
  }

  return {
    ok: true,
    total: Number(result.data?.total || 0),
    items: Array.isArray(result.data?.items) ? result.data.items : []
  };
}

function dedupeByKey(items = [], keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

async function searchNaverBlog(input) {
  const queries = buildQueries(input).blog;
  const jobs = queries.map((q) => naverSearch("blog", q, { display: 6, sort: "sim" }));
  const settled = await Promise.allSettled(jobs);

  let ok = false;
  let total = 0;
  const errors = [];
  const items = [];

  settled.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      const value = r.value;
      if (value.ok) ok = true;
      total += Number(value.total || 0);

      (value.items || []).forEach((item) => {
        items.push({
          source: "naver-blog",
          query: queries[idx],
          title: stripTags(item.title),
          url: item.link || null,
          snippet: stripTags(item.description),
          blogName: stripTags(item.bloggername),
          postDate: item.postdate || null
        });
      });

      if (!value.ok && value.error) errors.push(value.error);
    } else {
      errors.push(r.reason?.message || "NAVER blog search failed");
    }
  });

  return {
    ok,
    total,
    items: dedupeByKey(items, (x) => x.url || `${x.query}:${x.title}`).slice(0, 20),
    errors
  };
}

async function searchNaverShopping(input) {
  const queries = buildQueries(input).shopping;
  const jobs = queries.map((q) => naverSearch("shopping", q, { display: 10, sort: "sim" }));
  const settled = await Promise.allSettled(jobs);

  let ok = false;
  let total = 0;
  const errors = [];
  const items = [];

  settled.forEach((r, idx) => {
    if (r.status === "fulfilled") {
      const value = r.value;
      if (value.ok) ok = true;
      total += Number(value.total || 0);

      (value.items || []).forEach((item) => {
        items.push({
          source: "naver-shopping",
          query: queries[idx],
          title: stripTags(item.title),
          url: item.link || null,
          image: item.image || null,
          lprice: Number(item.lprice || 0),
          hprice: Number(item.hprice || 0),
          mallName: stripTags(item.mallName),
          brand: stripTags(item.brand),
          maker: stripTags(item.maker),
          category1: item.category1 || null,
          category2: item.category2 || null,
          category3: item.category3 || null,
          category4: item.category4 || null
        });
      });

      if (!value.ok && value.error) errors.push(value.error);
    } else {
      errors.push(r.reason?.message || "NAVER shopping search failed");
    }
  });

  return {
    ok,
    total,
    items: dedupeByKey(items, (x) => x.url || `${x.query}:${x.title}:${x.mallName}`).slice(0, 30),
    errors
  };
}

async function searchYouTube(input) {
  if (!ENV.YOUTUBE_API_KEY) {
    return { ok: false, items: [], best: null, error: "YOUTUBE_API_KEY missing" };
  }

  const query = buildQueries(input).youtube[0] || input.companyName;
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=7` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(ENV.YOUTUBE_API_KEY)}`;

  const searchRes = await fetchJson(searchUrl);

  if (!searchRes.ok) {
    return {
      ok: false,
      items: [],
      best: null,
      status: searchRes.status,
      error: searchRes.text || "YouTube search failed"
    };
  }

  const searchItems = Array.isArray(searchRes.data?.items) ? searchRes.data.items : [];
  const channelIds = unique(
    searchItems
      .map((item) => item?.snippet?.channelId || item?.id?.channelId)
      .filter(Boolean)
  );

  if (!channelIds.length) {
    return { ok: true, items: [], best: null };
  }

  const detailUrl =
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelIds.join(","))}` +
    `&key=${encodeURIComponent(ENV.YOUTUBE_API_KEY)}`;

  const channelRes = await fetchJson(detailUrl);

  if (!channelRes.ok) {
    return {
      ok: false,
      items: [],
      best: null,
      status: channelRes.status,
      error: channelRes.text || "YouTube channels failed"
    };
  }

  const channels = Array.isArray(channelRes.data?.items) ? channelRes.data.items : [];

  const items = channels.map((ch) => {
    const title = ch?.snippet?.title || "";
    const description = ch?.snippet?.description || "";
    const channelId = ch?.id || "";
    const subscribers = Number(ch?.statistics?.subscriberCount || 0);
    const videoCount = Number(ch?.statistics?.videoCount || 0);
    const viewCount = Number(ch?.statistics?.viewCount || 0);

    let score = 0;
    score += scoreNameMatch(input.companyName, title, description);
    if (/official|공식|오피셜|브랜드/i.test(`${title} ${description}`)) score += 12;
    score += clamp(Math.log10(subscribers + 1) * 6, 0, 18);
    score += clamp(Math.log10(videoCount + 1) * 4, 0, 12);

    return {
      source: "youtube",
      title,
      url: `https://www.youtube.com/channel/${channelId}`,
      channelId,
      snippet: description,
      subscribers,
      videoCount,
      viewCount,
      score: round(score),
      confidence:
        score >= 80 ? "high" :
        score >= 55 ? "medium" : "low"
    };
  }).sort((a, b) => b.score - a.score);

  return {
    ok: true,
    items,
    best: items[0] || null
  };
}

function pickShoppingPresence(input, shoppingItems = []) {
  const scored = shoppingItems.map((item) => {
    const hostname = getHostname(item.url || "");
    let score = 0;

    score += scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker);
    if (tokenIncludes(input.companyName, item.mallName)) score += 20;
    if (tokenIncludes(input.companyName, item.brand)) score += 15;
    if (hostname.includes("smartstore.naver.com")) score += 18;
    if (hostname.includes("shopping.naver.com")) score += 10;

    return {
      ...item,
      score
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 45) return null;

  const host = getHostname(best.url || "");
  return {
    title: best.mallName || best.title,
    url: best.url,
    source: "naver-shopping",
    confidence:
      best.score >= 80 ? "high" :
      best.score >= 60 ? "medium" : "low",
    snippet: [best.brand, best.maker, best.category1, best.category2].filter(Boolean).join(" / "),
    mallName: best.mallName || null,
    host
  };
}

function inferHomepage(input, shoppingItems = [], manualWebsite = "") {
  if (manualWebsite) {
    return {
      title: `${input.companyName} 공식 홈페이지`,
      url: manualWebsite,
      source: "manual-input",
      confidence: "high",
      snippet: "사용자 입력 URL"
    };
  }

  const candidates = [];

  shoppingItems.forEach((item) => {
    const url = item.url || "";
    const origin = getOrigin(url);
    const host = getHostname(url);
    if (!origin || !host) return;
    if (looksLikeMarketplace(host)) return;

    let score = 0;
    score += scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker);
    if (tokenIncludes(input.companyName, item.mallName)) score += 20;
    if (tokenIncludes(input.companyName, item.brand)) score += 12;

    candidates.push({
      title: item.mallName || item.title,
      url: origin,
      source: "derived-from-shopping",
      confidence: "low",
      snippet: `쇼핑 결과 링크 기반 추정 (${host})`,
      score
    });
  });

  const deduped = dedupeByKey(candidates, (x) => x.url).sort((a, b) => b.score - a.score);
  const best = deduped[0];

  if (!best || best.score < 38) return null;

  return {
    title: best.title,
    url: best.url,
    source: best.source,
    confidence:
      best.score >= 70 ? "medium" : "low",
    snippet: best.snippet
  };
}

function buildEvidence(input, blog, shopping, youtube) {
  const evidence = [];

  (blog.items || []).slice(0, 6).forEach((item) => {
    const score = clamp(
      15 +
      scoreNameMatch(input.companyName, item.title, item.snippet, item.blogName) * 0.5 +
      (item.title.includes("공식") ? 10 : 0),
      0,
      100
    );

    evidence.push({
      type: "blog-mention",
      source: item.source,
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      score: round(score),
      meta: {
        query: item.query,
        blogName: item.blogName,
        postDate: item.postDate
      }
    });
  });

  (shopping.items || []).slice(0, 8).forEach((item) => {
    const score = clamp(
      20 +
      scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker) * 0.6 +
      (getHostname(item.url).includes("smartstore.naver.com") ? 8 : 0),
      0,
      100
    );

    evidence.push({
      type: "shopping-item",
      source: item.source,
      title: item.title,
      url: item.url,
      snippet: [item.mallName, item.brand, item.category1, item.category2].filter(Boolean).join(" / "),
      score: round(score),
      meta: {
        lprice: item.lprice,
        mallName: item.mallName,
        brand: item.brand
      }
    });
  });

  if (youtube.best) {
    evidence.push({
      type: "youtube-channel",
      source: youtube.best.source,
      title: youtube.best.title,
      url: youtube.best.url,
      snippet: youtube.best.snippet,
      score: youtube.best.score,
      meta: {
        subscribers: youtube.best.subscribers,
        videoCount: youtube.best.videoCount,
        viewCount: youtube.best.viewCount
      }
    });
  }

  return evidence
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 16);
}

function countRegionSignals(region, items = []) {
  const r = String(region || "").trim();
  if (!r) return 0;

  return items.filter((item) => {
    const joined = `${item.title || ""} ${item.snippet || ""} ${item.mallName || ""}`;
    return joined.includes(r);
  }).length;
}

async function runPageSpeed(url) {
  if (!url || !ENV.PAGESPEED_API_KEY) return null;

  const mobileUrl =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
    `&strategy=mobile&key=${encodeURIComponent(ENV.PAGESPEED_API_KEY)}`;

  const desktopUrl =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}` +
    `&strategy=desktop&key=${encodeURIComponent(ENV.PAGESPEED_API_KEY)}`;

  const [mobileRes, desktopRes] = await Promise.allSettled([
    fetchJson(mobileUrl, {}, 20000),
    fetchJson(desktopUrl, {}, 20000)
  ]);

  function parseScore(result) {
    if (result.status !== "fulfilled" || !result.value.ok) return null;
    const score = result.value.data?.lighthouseResult?.categories?.performance?.score;
    if (typeof score !== "number") return null;
    return Math.round(score * 100);
  }

  const mobile = parseScore(mobileRes);
  const desktop = parseScore(desktopRes);

  if (mobile == null && desktop == null) return null;

  return {
    mobile,
    desktop,
    average: round(((mobile ?? desktop ?? 0) + (desktop ?? mobile ?? 0)) / 2)
  };
}

function compactAssetCount(assetDetails) {
  return ["homepage", "instagram", "youtube", "naverStore", "map"]
    .map((k) => assetDetails[k])
    .filter(Boolean).length;
}

function computeScores(input, profile, discovery, evidence) {
  const blogCount = discovery.counts.naverBlogItems;
  const shoppingCount = discovery.counts.naverShoppingItems;
  const assetCount = discovery.counts.assetCount;
  const regionHits = discovery.counts.regionHits;

  const homepage = discovery.assetDetails.homepage;
  const youtube = discovery.assetDetails.youtube;
  const naverStore = discovery.assetDetails.naverStore;
  const pageSpeed = discovery.pageSpeed;

  let searchVisibility =
    16 +
    clamp(Math.log10(blogCount + 1) * 18, 0, 28) +
    clamp(Math.log10(shoppingCount + 1) * 20, 0, 32) +
    (homepage ? 12 : 0) +
    (naverStore ? 14 : 0);

  let contentPresence =
    10 +
    (youtube ? 28 : 0) +
    clamp((youtube?.subscribers ? Math.log10(youtube.subscribers + 1) * 9 : 0), 0, 22) +
    clamp(evidence.filter((e) => e.type === "blog-mention").length * 4, 0, 18);

  let localExposure =
    profile.localBusiness
      ? 14 + clamp(regionHits * 12, 0, 52)
      : 22 + clamp(regionHits * 8, 0, 24) + (naverStore ? 8 : 0);

  let webQuality;
  if (pageSpeed?.average != null) {
    webQuality = clamp(pageSpeed.average, 20, 100);
  } else if (homepage) {
    webQuality = 42;
  } else {
    webQuality = 24;
  }

  if (profile.type === "ecommerce") {
    searchVisibility += 6;
    if (naverStore) localExposure += 4;
  }

  if (profile.localBusiness && !discovery.assetDetails.map) {
    localExposure -= 10;
  }

  searchVisibility = round(clamp(searchVisibility, 0, 100));
  contentPresence = round(clamp(contentPresence, 0, 100));
  localExposure = round(clamp(localExposure, 0, 100));
  webQuality = round(clamp(webQuality, 0, 100));

  const overall = round(clamp(
    searchVisibility * 0.30 +
    contentPresence * 0.22 +
    localExposure * 0.20 +
    webQuality * 0.16 +
    clamp(assetCount * 6, 0, 12),
    0,
    100
  ));

  return {
    overall,
    searchVisibility,
    contentPresence,
    localExposure,
    webQuality
  };
}

function computeConfidence(discovery, evidence) {
  const assetCount = discovery.counts.assetCount;
  const strongEvidence = evidence.filter((e) => (e.score || 0) >= 60).length;

  if (assetCount >= 3 || strongEvidence >= 5) {
    return {
      level: "높음",
      description: "복수 채널에서 자산과 언급 흔적이 확인되어 1차 진단 신뢰도가 높은 편입니다."
    };
  }

  if (assetCount >= 1 || strongEvidence >= 2) {
    return {
      level: "중간",
      description: "일부 자산 또는 반복 언급은 확인되지만 공식 자산 확정은 추가 검증이 필요합니다."
    };
  }

  return {
    level: "낮음",
    description: "발견 자산 수가 적어 초기 후보 수준의 진단입니다."
  };
}

function determineStage(profile, scores, discovery) {
  const assetCount = discovery.counts.assetCount;
  const hasHomepage = !!discovery.assetDetails.homepage;
  const hasStore = !!discovery.assetDetails.naverStore;
  const hasYoutube = !!discovery.assetDetails.youtube;

  if (scores.overall < 40 || assetCount <= 1) {
    return {
      code: "foundation",
      title: "기초 자산 정비 단계",
      description: "공식 자산 식별과 기본 전환 구조부터 정비해야 하는 단계입니다."
    };
  }

  if (scores.overall < 60 || (!hasHomepage && !hasStore)) {
    return {
      code: "traction",
      title: "채널 정렬 단계",
      description: "채널별 존재감은 일부 있으나 검색-콘텐츠-전환 구조를 정렬해야 하는 단계입니다."
    };
  }

  if (scores.overall < 78 || !(hasHomepage && (hasStore || hasYoutube))) {
    return {
      code: "growth",
      title: "성장 가속 단계",
      description: "기초 자산은 확보됐고 채널별 운영 효율과 광고 퍼포먼스를 끌어올릴 단계입니다."
    };
  }

  return {
    code: "scale",
    title: "브랜드 증폭 단계",
    description: "기본 자산은 갖춰져 있어 크리에이티브·광고·리텐션을 결합해 확장할 단계입니다."
  };
}

function buildKpis(profile, stage, discovery) {
  const local = profile.localBusiness;
  const isEcommerce = profile.type === "ecommerce";

  if (isEcommerce) {
    return {
      first30Days: [
        "브랜드 검색 랜딩페이지 이탈률 기준선 확보",
        "NAVER 쇼핑 상품/스토어 클릭 데이터 수집",
        "Instagram 운영 시 주간 저장률 3%+ 목표",
        "리타겟팅 광고 클릭률 1.2%+ 테스트"
      ],
      first90Days: [
        "브랜드 검색 유입 대비 전환 랜딩 도달률 상승",
        "스토어/상품 리뷰 증가 추세 확보",
        "콘텐츠 월 16~20개 운영 체계 정착",
        "브랜드 검색광고 + 리타겟팅 CPA 기준선 확보"
      ]
    };
  }

  if (local) {
    return {
      first30Days: [
        "지역 키워드 기반 문의/전화/길찾기 클릭 기준선 확보",
        "네이버/지도/리뷰 채널 응답 체계 정비",
        "Instagram 스토리/릴스로 매장 방문 유도 테스트",
        "리뷰 신규 유입 10~30건 구간 목표"
      ],
      first90Days: [
        "지역 키워드 노출 및 리뷰량 상승",
        "방문 전환형 랜딩 또는 플레이스 액션 개선",
        "오프라인 프로모션 재방문률 측정 체계 구축",
        "상담/예약/방문 전환율 개선"
      ]
    };
  }

  if (profile.type === "b2b") {
    return {
      first30Days: [
        "문의형 랜딩 전환 요소 정비",
        "업종 문제해결형 아티클 4~8개 발행",
        "브랜드/서비스 키워드 검색 유입 기준선 확보",
        "리드 수집 폼 전환율 측정"
      ],
      first90Days: [
        "리드당 획득비용 기준선 확보",
        "세일즈 콜 유입 가능한 콘텐츠 파이프라인 구축",
        "브랜드 검색 + 문제해결형 검색 동시 강화",
        "재마케팅/리드폼 광고 테스트 완료"
      ]
    };
  }

  return {
    first30Days: [
      "대표 채널 운영 리듬 확정",
      "검색 결과에서 식별되는 공식 자산 확보",
      "핵심 메시지와 CTA 정렬",
      "초기 전환지표 기준선 확보"
    ],
    first90Days: [
      "콘텐츠 운영 루틴 고정",
      "광고/리타겟팅 테스트 완료",
      "채널별 KPI 추적 체계 정착",
      "브랜드 검색 경험 개선"
    ]
  };
}

function buildChannelPlaybooks(profile, stage, discovery) {
  const local = profile.localBusiness;
  const hasYoutube = !!discovery.assetDetails.youtube;
  const hasStore = !!discovery.assetDetails.naverStore;
  const hasHomepage = !!discovery.assetDetails.homepage;

  if (profile.type === "ecommerce") {
    return [
      {
        channel: "Instagram",
        objective: "제품 인지 + 저장 + 프로필 유입",
        cadence: "주 4회",
        formatMix: "릴스 2 / 캐러셀 1 / 후기·증거형 포스트 1",
        first30Days: [
          "브랜드 소개보다 사용 장면·문제 해결·비교형 소재를 우선 제작",
          "제품 단독 컷보다 전후 비교/사용 순간/실구매 후기형 소재 비중 확대",
          "모든 게시물 첫 2초 후킹 문장과 커버 문구 통일",
          "프로필 링크는 대표 카테고리 또는 베스트 상품 랜딩으로 고정"
        ],
        first90Days: [
          "저장률 상위 포맷 중심으로 릴스 템플릿 2~3개 표준화",
          "UGC/리뷰형 소재 월 4개 이상 확보",
          "인플루언서 협업은 판매 링크보다 후기형 크리에이티브를 재활용하는 구조로 운영"
        ],
        kpis: [
          "저장률 3%+",
          "프로필 방문률 2%+",
          "링크 클릭률 1%+",
          "주간 댓글/DM 문의 추세 상승"
        ]
      },
      {
        channel: "NAVER Shopping / Store",
        objective: "검색 노출 + 구매 전환 접점 확보",
        cadence: "상품/리뷰 상시 관리 + 주 2회 점검",
        formatMix: "상품명 정비 / 썸네일 정비 / 리뷰 수집 / 베스트 상품 집중",
        first30Days: [
          "대표 상품 10개 우선으로 상품명·이미지·후킹 문구 통일",
          "브랜드 키워드와 카테고리 키워드를 분리해 상품명을 정렬",
          "리뷰 20~50개를 먼저 쌓을 핵심 SKU를 선정",
          hasStore ? "현재 노출된 쇼핑 접점의 리뷰/상세페이지 전환 요소를 우선 보강" : "스토어/쇼핑 노출 여부부터 우선 점검"
        ],
        first90Days: [
          "베스트 상품군과 신규 상품군을 분리 운영",
          "리뷰형 프로모션을 월 1~2회 고정",
          "상세페이지 A/B 테스트로 장바구니/클릭률 개선"
        ],
        kpis: [
          "핵심 SKU 리뷰 증가",
          "상품 클릭률 상승",
          "브랜드 검색 후 쇼핑 유입 비중 증가"
        ]
      },
      {
        channel: "브랜드 검색광고 + 리타겟팅",
        objective: "기존 수요 방어 + 재방문 전환",
        cadence: "상시 운영, 주 2회 최적화",
        formatMix: "브랜드 키워드 / 장바구니 리타겟팅 / 방문자 리타겟팅",
        first30Days: [
          "브랜드 검색량이 있다면 브랜드 키워드 방어를 가장 먼저 실행",
          "신규 콜드 확장보다 리타겟팅을 선행",
          hasHomepage ? "홈페이지/랜딩에 GA4·광고 태그 설치 및 전환 정의" : "대표 전환 랜딩부터 먼저 구축 후 광고 집행"
        ],
        first90Days: [
          "브랜드 검색광고와 리타겟팅의 CPA 기준선 확보",
          "전환율 상위 랜딩만 광고 연결",
          "매체 확장은 검색→리타겟팅→신규 타겟 순서로 진행"
        ],
        kpis: [
          "브랜드 검색 CTR 10%+",
          "리타겟팅 CTR 1.2%+",
          "CPA 기준선 확보"
        ]
      }
    ];
  }

  if (profile.type === "restaurant" || profile.type === "beauty") {
    return [
      {
        channel: "Instagram",
        objective: "방문 욕구 형성 + 저장 + DM/예약 유도",
        cadence: "주 3~5회 + 스토리 매일",
        formatMix: "릴스 2 / 캐러셀 1 / 방문후기·현장형 포스트 1~2",
        first30Days: [
          "매장 외관보다 방문 이유가 되는 대표 메뉴/서비스 결과물을 전면 배치",
          "스토리는 운영시간·대기상황·이벤트·고객 후기 재활용 중심으로 운영",
          "지역명 + 업종 + 대표서비스 조합의 고정 문구를 프로필과 캡션에 반복 사용"
        ],
        first90Days: [
          "상위 반응 포맷 중심으로 시리즈 콘텐츠화",
          "리뷰/방문 인증형 이벤트를 월 1회 반복",
          "지역 마이크로 인플루언서 협업은 1회성보다 반복 방문형으로 설계"
        ],
        kpis: [
          "프로필 클릭/길찾기/DM 증가",
          "저장률 4%+",
          "방문 후기 생성량 증가"
        ]
      },
      {
        channel: "네이버/지도/리뷰",
        objective: "지역 검색 전환 + 방문 결정 강화",
        cadence: "주 2회 점검 + 리뷰 상시 응답",
        formatMix: "리뷰 관리 / 메뉴·서비스 정보 최신화 / FAQ 정비",
        first30Days: [
          "리뷰 요청 문구와 응답 템플릿 고정",
          "가장 많이 묻는 질문을 프로필/소개 영역에 반영",
          "메뉴·가격·사진·운영시간 최신화"
        ],
        first90Days: [
          "리뷰 키워드를 바탕으로 자주 언급되는 강점 정리",
          "지역 키워드 기반 소개 문구 최적화",
          "방문 후기 UGC를 반복 재활용"
        ],
        kpis: [
          "리뷰 증가",
          "길찾기/전화/예약 액션 증가",
          "지역 검색 노출 안정화"
        ]
      }
    ];
  }

  if (profile.type === "medical") {
    return [
      {
        channel: "블로그/콘텐츠",
        objective: "신뢰 구축 + 상담 전환",
        cadence: "주 2회",
        formatMix: "증상/시술 설명 1 / FAQ 1",
        first30Days: [
          "과장형 전후사진보다 불안 해소형 설명 콘텐츠를 우선",
          "환자 질문 빈도가 높은 주제부터 작성",
          "상담 CTA는 예약/전화/카카오 중 1개로 집중"
        ],
        first90Days: [
          "진료과목별 대표 글 8~12개 축적",
          "지역 키워드와 결합한 설명 콘텐츠 강화",
          "상담 전환 페이지 개선"
        ],
        kpis: [
          "상담 문의 증가",
          "콘텐츠 체류시간 증가",
          "브랜드 검색 후 예약 전환 증가"
        ]
      },
      {
        channel: "검색광고",
        objective: "의도 높은 키워드 캡처",
        cadence: "상시 운영",
        formatMix: "지역 + 진료과목 / 브랜드명 / 핵심 증상",
        first30Days: [
          "너무 넓은 키워드보다 지역·진료 중심의 고의도 키워드부터 집행",
          "랜딩은 메인홈이 아니라 대표 시술/진료 소개 페이지 우선"
        ],
        first90Days: [
          "문의 전환율 상위 키워드 중심 재편",
          "브랜드 검색광고는 방어용으로 별도 운영"
        ],
        kpis: [
          "상담 폼 전환율",
          "전화 클릭률",
          "리드당 비용"
        ]
      }
    ];
  }

  if (profile.type === "education") {
    return [
      {
        channel: "블로그/사례 콘텐츠",
        objective: "신뢰 형성 + 상담 유도",
        cadence: "주 2회",
        formatMix: "합격/성취 사례 1 / 커리큘럼 설명 1",
        first30Days: [
          "과목 소개보다 학부모가 궁금해하는 변화 사례를 우선 배치",
          "지역명 + 학년 + 과목 조합 키워드 반복 사용",
          "상담 폼/전화 CTA를 고정"
        ],
        first90Days: [
          "성과 사례 아카이브 누적",
          "상담 전환이 높은 글 포맷 표준화",
          "오프라인 체험 수업과 디지털 랜딩 연계"
        ],
        kpis: [
          "상담 문의 증가",
          "체험신청 증가",
          "지역 키워드 유입 증가"
        ]
      },
      {
        channel: "Instagram / Shorts",
        objective: "가벼운 인지도 형성 + 학부모/학생 접점 확보",
        cadence: "주 3회",
        formatMix: "짧은 팁 2 / 현장형 1",
        first30Days: [
          "짧은 공부 팁, 수업 분위기, 실제 변화 포인트 중심",
          "릴스는 15~30초 내로 압축"
        ],
        first90Days: [
          "성과형 짧은 영상 반복",
          "질문형 포맷으로 댓글 유도"
        ],
        kpis: [
          "프로필 방문 증가",
          "상담 링크 클릭 증가"
        ]
      }
    ];
  }

  if (profile.type === "b2b") {
    return [
      {
        channel: "검색 + 블로그 아티클",
        objective: "리드 유입",
        cadence: "주 1~2회",
        formatMix: "문제해결형 아티클 1 / 사례형 아티클 1",
        first30Days: [
          "회사 소개보다 고객 문제와 해결 구조를 전면화",
          "브랜드 키워드보다 문제 키워드 기반으로 아티클 작성",
          "문의형 랜딩 CTA 통일"
        ],
        first90Days: [
          "아티클 8개 이상 축적",
          "리드 마그넷 또는 사례자료 연결",
          "리타겟팅 광고로 재방문 리드 회수"
        ],
        kpis: [
          "문의 전환율",
          "다운로드/상담 신청 수",
          "리드당 비용"
        ]
      },
      {
        channel: "LinkedIn/YouTube/웨비나 대체 콘텐츠",
        objective: "신뢰 형성",
        cadence: hasYoutube ? "주 1회 이상" : "월 2~4회",
        formatMix: "짧은 인사이트 영상 / 고객 사례 요약 / 웨비나 클립",
        first30Days: [
          "제품 소개보다 문제-해결-사례 구조를 유지",
          "세일즈팀이 실제 받은 질문을 콘텐츠화"
        ],
        first90Days: [
          "상위 질문 10개를 콘텐츠 라이브러리로 축적",
          "세미나/웨비나 클립 재활용"
        ],
        kpis: [
          "리드 질 향상",
          "브랜드 검색량 증가"
        ]
      }
    ];
  }

  return [
    {
      channel: "Instagram / Blog",
      objective: "브랜드 인지 + 기본 신뢰 확보",
      cadence: "주 3~4회",
      formatMix: "릴스/캐러셀/설명형 포스트 혼합",
      first30Days: [
        "브랜드 설명보다 고객이 얻는 변화 중심으로 메시지 재정렬",
        "프로필 링크는 대표 전환 랜딩 하나로 통일"
      ],
      first90Days: [
        "반응 좋은 포맷을 2~3개로 표준화",
        "후기/증거형 콘텐츠 비중 확대"
      ],
      kpis: [
        "저장률",
        "프로필 방문률",
        "링크 클릭률"
      ]
    }
  ];
}

function buildAdPlan(profile, stage, discovery) {
  const hasHomepage = !!discovery.assetDetails.homepage;

  if (profile.type === "ecommerce") {
    return {
      decision: "우선 집행 권장",
      priority: [
        "브랜드 검색광고",
        "방문자/장바구니 리타겟팅",
        "Meta 전환/카탈로그 광고"
      ],
      budgetGuide: "초기 테스트 기준 월 80만~300만원 범위에서 시작 후 CPA 기준으로 증감",
      notes: [
        "브랜드 검색량이 있으면 브랜드 키워드 방어부터 시작",
        hasHomepage
          ? "광고는 메인홈보다 베스트 상품/카테고리 랜딩에 직접 연결"
          : "홈페이지/전환 랜딩이 약하면 광고보다 랜딩 정비를 먼저 수행",
        "콜드 확장보다 리타겟팅을 먼저 안정화"
      ]
    };
  }

  if (profile.localBusiness) {
    return {
      decision: "지역 타깃 중심으로 제한 집행 권장",
      priority: [
        "지역 검색광고",
        "브랜드 방어 광고",
        "방문/예약 전환형 소액 광고"
      ],
      budgetGuide: "초기 테스트 기준 월 50만~150만원 범위에서 지역 반경형 집행",
      notes: [
        "광범위 확장보다 지역·업종 조합 키워드 우선",
        "광고 클릭 후 예약/전화/길찾기 액션이 쉬워야 함"
      ]
    };
  }

  if (profile.type === "b2b") {
    return {
      decision: "리드형 소규모 집행 권장",
      priority: [
        "브랜드 검색광고",
        "문제해결 키워드 검색광고",
        "리타겟팅"
      ],
      budgetGuide: "초기 테스트 기준 월 100만~300만원 범위에서 리드 품질 검증 중심",
      notes: [
        "광고 확장 전 문의 랜딩과 세일즈 핸드오프 구조 정리",
        "전환은 다운로드보다 상담신청 기준으로 보는 것이 유리"
      ]
    };
  }

  return {
    decision: "조건부 집행",
    priority: [
      "브랜드 검색광고",
      "리타겟팅"
    ],
    budgetGuide: "초기에는 소액 테스트 후 효율 기준선 확보",
    notes: [
      "기본 자산이 약하면 광고보다 자산 정비가 먼저",
      "광고는 전환 경로가 분명할 때만 확장"
    ]
  };
}

function buildOfflinePlan(profile, stage) {
  if (profile.localBusiness) {
    return {
      decision: "조건부 권장",
      priority: [
        "전단/리플렛",
        "인근 제휴처 비치물",
        "버스/옥외는 유동량 검증 후 테스트"
      ],
      whenToUse: [
        "반경 1~3km 생활권 업종",
        "방문/예약형 비즈니스",
        "지역 주민 반복 방문 가능 업종"
      ],
      whenNotToUse: [
        "전국구 이커머스",
        "브랜드 검색 기반 온라인 전환 업종",
        "측정 체계가 없는 상태의 대형 옥외 광고"
      ],
      budgetGuide: "전단은 소규모 테스트부터, 버스/옥외는 디지털 전환 구조가 잡힌 뒤 제한적으로 검토"
    };
  }

  return {
    decision: "1단계 우선순위 아님",
    priority: [
      "오프라인보다 검색·콘텐츠·리타겟팅 우선"
    ],
    whenToUse: [
      "팝업/행사/체험형 접점이 브랜드 전략상 꼭 필요한 경우"
    ],
    whenNotToUse: [
      "브랜드 자산과 전환 구조가 약한 초기 단계",
      "성과 측정이 불가능한 상태"
    ],
    budgetGuide: "전국구/온라인 중심 비즈니스는 오프라인보다 디지털 채널 정비가 먼저"
  };
}

function buildPriorityChannels(profile, stage, discovery) {
  if (profile.type === "ecommerce") {
    return [
      "브랜드 검색 방어",
      "NAVER 쇼핑/리뷰 최적화",
      "Instagram 릴스/캐러셀",
      "리타겟팅 광고"
    ];
  }

  if (profile.localBusiness) {
    return [
      "네이버/지도/리뷰",
      "Instagram 로컬 콘텐츠",
      "지역 검색광고",
      "오프라인 재방문 프로모션"
    ];
  }

  if (profile.type === "b2b") {
    return [
      "문제해결형 콘텐츠",
      "브랜드·서비스 검색광고",
      "리드 랜딩 최적화",
      "리타겟팅"
    ];
  }

  return [
    "공식 자산 정비",
    "콘텐츠 운영 루틴",
    "브랜드 검색 방어",
    "리타겟팅"
  ];
}

function buildThirtyDayPlan(profile, stage, discovery) {
  const items = [];

  if (!discovery.assetDetails.homepage) {
    items.push({
      week: "1주차",
      action: "브랜드 검색 시 가장 먼저 연결할 공식 홈페이지 또는 대표 랜딩 1개를 확정",
      detail: "메인홈보다 대표 제품/서비스를 바로 설명하는 전환형 랜딩을 우선 추천"
    });
  }

  if (!discovery.assetDetails.naverStore && profile.type === "ecommerce") {
    items.push({
      week: "1~2주차",
      action: "NAVER 쇼핑/스토어 노출 여부 점검 및 핵심 SKU 10개 정비",
      detail: "상품명·썸네일·리뷰 확보 대상을 먼저 고정"
    });
  }

  items.push({
    week: "1~2주차",
    action: "핵심 채널 2개만 우선 선택해 운영 리듬 고정",
    detail: profile.localBusiness
      ? "네이버/지도 + Instagram 조합 추천"
      : profile.type === "b2b"
        ? "검색 + 블로그/아티클 조합 추천"
        : "Instagram + 검색/리타겟팅 조합 추천"
  });

  items.push({
    week: "2~3주차",
    action: "콘텐츠 포맷 2~3개를 정하고 일관된 템플릿으로 제작",
    detail: profile.type === "ecommerce"
      ? "릴스 2 / 캐러셀 1 / 후기형 포스트 1"
      : profile.localBusiness
        ? "현장형 릴스 / 후기형 포스트 / FAQ형 포스트"
        : "문제해결형 / 사례형 / FAQ형 콘텐츠"
  });

  items.push({
    week: "3~4주차",
    action: "광고는 소액 테스트만 시작",
    detail: profile.type === "ecommerce"
      ? "브랜드 검색광고 + 리타겟팅부터"
      : profile.localBusiness
        ? "지역 검색광고 또는 예약 전환형 소액 집행"
        : "브랜드/문제 키워드 검색 중심"
  });

  items.push({
    week: "4주차",
    action: "첫 달 KPI 리뷰",
    detail: "저장률, 프로필 방문률, 클릭률, 문의/예약/구매 전환 중 하나를 핵심 기준으로 확정"
  });

  return items.slice(0, 6);
}

function buildNinetyDayPlan(profile, stage, discovery) {
  const plan = [];

  plan.push({
    period: "1~4주",
    focus: "기초 자산 정비 + 채널 운영 리듬 고정",
    deliverables: [
      "대표 랜딩 1개",
      "주간 콘텐츠 캘린더",
      "KPI 기준선",
      "광고 태그/측정 체계"
    ]
  });

  plan.push({
    period: "5~8주",
    focus: "반응 좋은 포맷 집중 + 전환 개선",
    deliverables: profile.type === "ecommerce"
      ? [
          "상위 반응 SKU 중심 콘텐츠 재편",
          "리타겟팅 안정화",
          "리뷰/UGC 축적"
        ]
      : profile.localBusiness
        ? [
            "리뷰량 증가",
            "길찾기/예약 전환 개선",
            "지역 키워드 고도화"
          ]
        : [
            "상위 아티클/콘텐츠 재활용",
            "문의 랜딩 개선",
            "광고 효율 기준선 확보"
          ]
  });

  plan.push({
    period: "9~12주",
    focus: "확장 채널 테스트 + 예산 확대 여부 판단",
    deliverables: profile.localBusiness
      ? [
          "오프라인 프로모션 또는 제휴 테스트",
          "지역 반경 기반 매체 추가 여부 판단"
        ]
      : [
          "콜드 확장 광고 여부 판단",
          "협업/인플루언서/파트너십 테스트",
          "CRM/재구매 구조 설계"
        ]
  });

  return plan;
}

function buildDeterministicPrescription(input, profile, stage, discovery, scores, evidence) {
  const priorityChannels = buildPriorityChannels(profile, stage, discovery);
  const channelPlaybooks = buildChannelPlaybooks(profile, stage, discovery);
  const adPlan = buildAdPlan(profile, stage, discovery);
  const offlinePlan = buildOfflinePlan(profile, stage);
  const kpis = buildKpis(profile, stage, discovery);
  const thirtyDayPlan = buildThirtyDayPlan(profile, stage, discovery);
  const ninetyDayPlan = buildNinetyDayPlan(profile, stage, discovery);

  const risks = [];
  const wins = [];
  const nextActions = [];

  if (discovery.assetDetails.youtube) {
    wins.push("유튜브 채널 후보가 확인되어 콘텐츠 자산 기반의 확장 가능성이 있습니다.");
  }
  if (discovery.assetDetails.naverStore) {
    wins.push("NAVER 쇼핑/스토어 계열 노출 흔적이 확인되어 검색-구매 접점은 일부 확보된 상태입니다.");
  }
  if (evidence.filter((e) => e.type === "blog-mention").length >= 2) {
    wins.push("네이버 블로그 언급이 반복적으로 발견되어 브랜드 언급 기반은 형성되어 있습니다.");
  }

  if (!discovery.assetDetails.homepage) {
    risks.push("공식 홈페이지 또는 대표 전환 랜딩이 확정되지 않아 브랜드 검색 유입이 외부 플랫폼에 분산될 수 있습니다.");
  }
  if (!discovery.assetDetails.instagram && (profile.type === "ecommerce" || profile.localBusiness || profile.type === "beauty")) {
    risks.push("인스타그램 공식 자산이 약하면 저장·공유·후기 기반의 확산 채널이 약해질 수 있습니다.");
  }
  if (!discovery.assetDetails.naverStore && profile.type === "ecommerce") {
    risks.push("이커머스 업종인데 NAVER 쇼핑/스토어 접점이 약하면 검색 전환 기회를 놓칠 수 있습니다.");
  }
  if (scores.webQuality < 45) {
    risks.push("웹 품질 신호가 부족하거나 속도 측정 대상 홈페이지가 확정되지 않았습니다.");
  }

  nextActions.push(...thirtyDayPlan.slice(0, 3).map((item) => `${item.week}: ${item.action}`));

  const executiveSummary =
    profile.type === "ecommerce"
      ? `${input.companyName}은(는) 현재 검색·콘텐츠 신호는 일부 존재하지만, 공식 랜딩/쇼핑 접점/리타겟팅 구조를 정리해야 매출형 마케팅이 제대로 굴러갈 단계입니다.`
      : profile.localBusiness
        ? `${input.companyName}은(는) 지역 검색과 후기·예약 전환 채널을 정리하면 성과가 날 가능성이 높습니다. 지금은 노출보다 방문 결정 구조를 먼저 다듬는 것이 중요합니다.`
        : `${input.companyName}은(는) 기초 자산은 일부 있으나 검색-콘텐츠-전환이 한 구조로 연결되지 않아 마케팅 효율이 분산될 가능성이 있습니다.`;

  return {
    stage,
    priorityChannels,
    channelPlaybooks,
    adPlan,
    offlinePlan,
    kpis,
    thirtyDayPlan,
    ninetyDayPlan,
    wins: unique(wins).slice(0, 3),
    risks: unique(risks).slice(0, 4),
    nextActions: unique(nextActions).slice(0, 4),
    executiveSummary
  };
}

async function refinePrescriptionWithGemini(input, profile, discovery, scores, stage, basePrescription, evidence) {
  if (!ENV.GEMINI_API_KEY) return basePrescription;

  const prompt = [
    "너는 한국 기업용 실무 마케팅 전략가다.",
    "아래 JSON을 보고 기존 실행안을 더 구체적으로 다듬어라.",
    "절대 추상적으로 쓰지 말고, 업로드 빈도/포맷/우선순위/광고 여부/오프라인 권장 여부를 구체적으로 작성하라.",
    "오프라인 광고는 지역 업종에만 조건부로 권장하라.",
    "출력은 반드시 JSON만 사용하라.",
    "키는 executiveSummary, wins, risks, nextActions, priorityChannels, channelPlaybooks, adPlan, offlinePlan, kpis, thirtyDayPlan, ninetyDayPlan 만 사용하라.",
    JSON.stringify({
      input,
      profile,
      stage,
      scores,
      discovery: {
        hasHomepage: !!discovery.assetDetails.homepage,
        hasInstagram: !!discovery.assetDetails.instagram,
        hasYouTube: !!discovery.assetDetails.youtube,
        hasNaverStore: !!discovery.assetDetails.naverStore,
        hasMap: !!discovery.assetDetails.map,
        pageSpeed: discovery.pageSpeed
      },
      evidence: evidence.slice(0, 8),
      basePrescription
    })
  ].join("\n");

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ENV.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(ENV.GEMINI_API_KEY)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.25,
      responseMimeType: "application/json"
    }
  };

  try {
    const result = await

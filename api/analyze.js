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
  "store.kakao.com"
];

function setCommonHeaders(res) {
  Object.entries({ ...JSON_HEADERS, ...CORS_HEADERS }).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

function tokenIncludes(base = "", target = "") {
  const a = normalizeText(base);
  const b = normalizeText(target);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function scoreNameMatch(companyName, ...texts) {
  const target = normalizeText(companyName);
  if (!target) return 0;

  let score = 0;
  const joined = texts.map((t) => normalizeText(t)).join(" ");

  if (joined.includes(target)) score += 50;

  for (const text of texts) {
    const n = normalizeText(text);
    if (!n) continue;
    if (n === target) score += 35;
    else if (n.includes(target) || target.includes(n)) score += 20;
  }

  return clamp(score, 0, 100);
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

function isEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
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

async function fetchJson(url, options = {}, timeoutMs = 12000) {
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
      data,
      text
    };
  } finally {
    clearTimeout(timer);
  }
}

function pickIndustryLabel(industry = "") {
  const s = String(industry || "").trim();
  const n = normalizeText(s);

  if (!s) return "일반";
  if (n.includes("이커머스") || n.includes("쇼핑몰") || n.includes("커머스")) return "이커머스 / 쇼핑몰";
  if (n.includes("병원") || n.includes("의원") || n.includes("치과")) return "병원 / 의료";
  if (n.includes("식당") || n.includes("카페") || n.includes("음식") || n.includes("외식")) return "외식 / 매장";
  if (n.includes("학원") || n.includes("교육")) return "교육 / 학원";
  if (n.includes("부동산")) return "부동산";
  if (n.includes("뷰티") || n.includes("미용")) return "뷰티";
  return s;
}

function buildQueries(input) {
  const company = String(input.companyName || "").trim();
  const industry = String(input.industry || "").trim();
  const region = String(input.region || "").trim();

  return {
    blog: unique([
      company,
      `${company} 공식`,
      region ? `${company} ${region}` : "",
      industry ? `${company} ${industry}` : ""
    ]).slice(0, 3),
    shopping: unique([
      company,
      industry ? `${company} ${industry}` : "",
      `${company} 공식`
    ]).slice(0, 3),
    youtube: unique([
      company,
      `${company} official`
    ]).slice(0, 2)
  };
}

async function naverSearch(endpoint, query, extra = {}) {
  if (!ENV.NAVER_CLIENT_ID || !ENV.NAVER_CLIENT_SECRET || !query) {
    return { ok: false, total: 0, items: [], error: "NAVER credentials missing or empty query" };
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

function dedupeByUrl(items = []) {
  const map = new Map();
  for (const item of items) {
    const key = item.url || item.link || item.channelId || JSON.stringify(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

async function searchNaverBlog(input) {
  const queries = buildQueries(input).blog;
  const jobs = queries.map((q) => naverSearch("blog", q, { display: 5, sort: "sim" }));
  const settled = await Promise.allSettled(jobs);

  const items = [];
  let total = 0;
  let ok = false;
  let errors = [];

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

  const deduped = dedupeByUrl(items).slice(0, 12);
  return { ok, total, items: deduped, errors };
}

async function searchNaverShopping(input) {
  const queries = buildQueries(input).shopping;
  const jobs = queries.map((q) => naverSearch("shopping", q, { display: 8, sort: "sim" }));
  const settled = await Promise.allSettled(jobs);

  const items = [];
  let total = 0;
  let ok = false;
  let errors = [];

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

  const deduped = dedupeByUrl(items).slice(0, 16);
  return { ok, total, items: deduped, errors };
}

async function searchYouTube(input) {
  if (!ENV.YOUTUBE_API_KEY) {
    return { ok: false, items: [], best: null, error: "YOUTUBE_API_KEY missing" };
  }

  const query = buildQueries(input).youtube[0] || input.companyName;
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=5` +
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
    searchItems.map((item) => item?.snippet?.channelId || item?.id?.channelId).filter(Boolean)
  );

  if (!channelIds.length) {
    return { ok: true, items: [], best: null };
  }

  const channelUrl =
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${encodeURIComponent(channelIds.join(","))}` +
    `&key=${encodeURIComponent(ENV.YOUTUBE_API_KEY)}`;

  const channelRes = await fetchJson(channelUrl);

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

  const enriched = channels.map((ch) => {
    const title = ch?.snippet?.title || "";
    const description = ch?.snippet?.description || "";
    const channelId = ch?.id || "";
    const subscribers = Number(ch?.statistics?.subscriberCount || 0);
    const videoCount = Number(ch?.statistics?.videoCount || 0);
    const viewCount = Number(ch?.statistics?.viewCount || 0);

    let score = 0;
    score += scoreNameMatch(input.companyName, title, description);
    if (tokenIncludes(input.companyName, title)) score += 20;
    if (/official|공식|오피셜|브랜드/i.test(`${title} ${description}`)) score += 10;
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
  });

  const sorted = enriched.sort((a, b) => b.score - a.score);
  return {
    ok: true,
    items: sorted,
    best: sorted[0] || null
  };
}

function pickNaverStore(input, shoppingItems = []) {
  const scored = shoppingItems
    .map((item) => {
      const url = item.url || "";
      const hostname = getHostname(url);
      let score = 0;

      if (hostname.includes("smartstore.naver.com")) score += 55;
      score += scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker);
      if (tokenIncludes(input.companyName, item.mallName)) score += 20;
      if (tokenIncludes(input.companyName, item.brand)) score += 15;

      return {
        ...item,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 40) return null;

  return {
    title: best.mallName || best.title,
    url: best.url,
    source: "naver-shopping",
    confidence: best.score >= 75 ? "high" : "medium",
    snippet: [best.brand, best.maker, best.category1, best.category2].filter(Boolean).join(" / ")
  };
}

function inferHomepage(input, shoppingItems = []) {
  const candidates = [];

  for (const item of shoppingItems) {
    const url = item.url || "";
    const host = getHostname(url);
    const origin = getOrigin(url);

    if (!origin || !host) continue;
    if (looksLikeMarketplace(host)) continue;

    let score = 0;
    score += scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker);
    if (tokenIncludes(input.companyName, item.mallName)) score += 20;
    if (tokenIncludes(input.companyName, item.brand)) score += 12;

    candidates.push({
      title: item.mallName || item.title,
      url: origin,
      source: "derived-from-shopping",
      confidence: "low",
      snippet: `NAVER Shopping 링크 기반 추정 (${host})`,
      score
    });
  }

  const merged = new Map();
  for (const c of candidates) {
    const prev = merged.get(c.url);
    if (!prev || prev.score < c.score) merged.set(c.url, c);
  }

  const best = [...merged.values()].sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 35) return null;

  if (best.score >= 70) best.confidence = "medium";
  return best;
}

function countRegionSignals(region, items = []) {
  const r = String(region || "").trim();
  if (!r) return 0;
  return items.filter((item) => {
    const joined = `${item.title || ""} ${item.snippet || ""} ${item.mallName || ""}`;
    return joined.includes(r);
  }).length;
}

function buildEvidence(input, blog, shopping, youtube) {
  const evidence = [];

  (blog.items || []).slice(0, 4).forEach((item) => {
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

  (shopping.items || []).slice(0, 6).forEach((item) => {
    const score = clamp(
      20 +
      scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker) * 0.6 +
      (getHostname(item.url).includes("smartstore.naver.com") ? 12 : 0),
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
    .slice(0, 12);
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

  const mobileScore = parseScore(mobileRes);
  const desktopScore = parseScore(desktopRes);

  if (mobileScore == null && desktopScore == null) return null;

  return {
    mobile: mobileScore,
    desktop: desktopScore,
    average: round(((mobileScore ?? desktopScore ?? 0) + (desktopScore ?? mobileScore ?? 0)) / 2)
  };
}

function computeScores(input, discovery, sourceStatus, evidence) {
  const blogCount = discovery.counts.naverBlogItems;
  const shoppingCount = discovery.counts.naverShoppingItems;
  const regionHits = discovery.counts.regionHits;
  const assetCount = discovery.counts.assetCount;

  const homepage = discovery.assetDetails.homepage;
  const naverStore = discovery.assetDetails.naverStore;
  const youtube = discovery.assetDetails.youtube;
  const pageSpeed = discovery.pageSpeed;

  let searchVisibility =
    18 +
    clamp(Math.log10(blogCount + 1) * 18, 0, 28) +
    clamp(Math.log10(shoppingCount + 1) * 22, 0, 32) +
    (homepage ? 12 : 0) +
    (naverStore ? 12 : 0);

  let contentPresence =
    12 +
    (youtube ? 35 : 0) +
    clamp((youtube?.subscribers ? Math.log10(youtube.subscribers + 1) * 8 : 0), 0, 20) +
    clamp(evidence.filter((e) => e.type === "blog-mention").length * 4, 0, 16);

  let localExposure =
    input.region
      ? 18 + clamp(regionHits * 12, 0, 48) + (naverStore ? 8 : 0)
      : 28 + clamp((blogCount + shoppingCount) * 2, 0, 28);

  let webQuality;
  if (pageSpeed?.average != null) {
    webQuality = clamp(pageSpeed.average, 15, 100);
  } else if (homepage) {
    webQuality = 38;
  } else {
    webQuality = 24;
  }

  searchVisibility = round(clamp(searchVisibility, 0, 100));
  contentPresence = round(clamp(contentPresence, 0, 100));
  localExposure = round(clamp(localExposure, 0, 100));
  webQuality = round(clamp(webQuality, 0, 100));

  const sourceBonus =
    (sourceStatus.naverBlog.ok ? 4 : 0) +
    (sourceStatus.naverShopping.ok ? 4 : 0) +
    (sourceStatus.youtube.ok ? 4 : 0) +
    (assetCount >= 2 ? 4 : 0);

  const overall = round(clamp(
    searchVisibility * 0.34 +
    contentPresence * 0.26 +
    localExposure * 0.18 +
    webQuality * 0.22 +
    sourceBonus,
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

function computeConfidence(discovery, sourceStatus, evidence) {
  const assetCount = discovery.counts.assetCount;
  const strongEvidence = evidence.filter((e) => (e.score || 0) >= 60).length;
  const sourceOkCount = [
    sourceStatus.naverBlog.ok,
    sourceStatus.naverShopping.ok,
    sourceStatus.youtube.ok
  ].filter(Boolean).length;

  if (assetCount >= 3 || (strongEvidence >= 4 && sourceOkCount >= 2)) {
    return {
      level: "높음",
      description: "복수 채널에서 자산과 언급 흔적이 확인되어 1차 진단 신뢰도가 높은 편입니다."
    };
  }

  if (assetCount >= 1 || strongEvidence >= 2 || sourceOkCount >= 2) {
    return {
      level: "중간",
      description: "일부 자산 또는 반복 언급은 확인되지만 공식 자산 확정이 더 필요합니다."
    };
  }

  return {
    level: "낮음",
    description: "자산 확정 신호가 적어 초기 후보 수준의 진단입니다."
  };
}

function buildFallbackNarrative(input, discovery, scores, evidence, confidence) {
  const wins = [];
  const risks = [];
  const nextActions = [];

  if (discovery.assetDetails.naverStore) {
    wins.push("네이버 쇼핑/스토어 계열 노출 흔적이 확인되어 구매 접점은 일부 확보된 상태입니다.");
  }
  if (discovery.assetDetails.youtube) {
    wins.push("유튜브 채널 후보가 확인되어 콘텐츠 자산 기반의 확장 가능성이 있습니다.");
  }
  if (evidence.filter((e) => e.type === "blog-mention").length >= 2) {
    wins.push("네이버 블로그 언급이 반복적으로 발견되어 브랜드 언급 기반은 형성되어 있습니다.");
  }

  if (!discovery.assetDetails.homepage) {
    risks.push("공식 홈페이지 후보가 아직 확정되지 않아 브랜드 검색 유입이 외부 플랫폼에 분산될 수 있습니다.");
  }
  if (!discovery.assetDetails.youtube) {
    risks.push("유튜브 공식 채널 신호가 약해 영상 기반 신뢰 축적이 제한될 수 있습니다.");
  }
  if (normalizeText(input.industry).includes("이커머스") || normalizeText(input.industry).includes("쇼핑몰")) {
    if (!discovery.assetDetails.naverStore) {
      risks.push("이커머스 업종인데 NAVER Shopping/스토어 계열 자산 신호가 약합니다.");
    }
  }
  if (scores.webQuality < 40) {
    risks.push("웹 품질 신호가 부족하거나 속도 측정 대상 홈페이지가 확정되지 않았습니다.");
  }

  if (!discovery.assetDetails.homepage) {
    nextActions.push("브랜드명 검색 시 바로 식별되는 공식 홈페이지 또는 대표 랜딩페이지를 먼저 확정하세요.");
  }
  if (!discovery.assetDetails.youtube) {
    nextActions.push("브랜드명과 일치하는 유튜브 공식 채널 운영 여부를 정리하고 프로필·설명·링크를 통일하세요.");
  }
  if (!discovery.assetDetails.naverStore) {
    nextActions.push("네이버 쇼핑/스마트스토어/상품 연동 여부를 점검해 검색 노출 접점을 보강하세요.");
  }

  const executiveSummary =
    discovery.counts.assetCount >= 2
      ? `${input.companyName}은(는) NAVER와 YouTube 기준으로 일부 공개 자산이 확인되며, 현재는 검색 가시성과 전환 접점을 더 구조화할 단계입니다.`
      : `${input.companyName}은(는) NAVER·YouTube 기준 초기 언급 신호는 있으나 공식 자산 확정이 부족해 브랜드 검색 경험이 약하게 보일 수 있습니다.`;

  return {
    industryLabel: pickIndustryLabel(input.industry),
    executiveSummary,
    wins: wins.slice(0, 3),
    risks: risks.slice(0, 3),
    nextActions: nextActions.slice(0, 3)
  };
}

async function buildNarrativeWithGemini(input, discovery, scores, evidence, confidence) {
  if (!ENV.GEMINI_API_KEY) {
    return buildFallbackNarrative(input, discovery, scores, evidence, confidence);
  }

  const payload = {
    input: {
      companyName: input.companyName,
      industry: pickIndustryLabel(input.industry),
      region: input.region || null
    },
    assets: {
      hasHomepage: !!discovery.assetDetails.homepage,
      hasYouTube: !!discovery.assetDetails.youtube,
      hasNaverStore: !!discovery.assetDetails.naverStore,
      hasInstagram: !!discovery.assetDetails.instagram,
      hasMap: !!discovery.assetDetails.map
    },
    scores,
    confidence,
    evidence: evidence.slice(0, 6).map((e) => ({
      type: e.type,
      title: e.title,
      snippet: e.snippet,
      score: e.score
    }))
  };

  const prompt = [
    "너는 한국 SMB 마케팅 진단 어시스턴트다.",
    "아래 JSON을 바탕으로 1차 진단 요약을 작성하라.",
    "반드시 JSON으로만 응답하라.",
    "키는 industryLabel, executiveSummary, wins, risks, nextActions 만 사용하라.",
    "wins, risks, nextActions 는 각각 최대 3개 항목의 배열이어야 한다.",
    "과장 금지. 확인된 증거만 반영하라.",
    JSON.stringify(payload)
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
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  try {
    const result = await fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }, 25000);

    if (!result.ok) {
      return buildFallbackNarrative(input, discovery, scores, evidence, confidence);
    }

    const text =
      result.data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text || "")
        .join("")
        .trim() || "";

    const parsed = tryParseJson(text, null);
    if (!parsed) {
      return buildFallbackNarrative(input, discovery, scores, evidence, confidence);
    }

    return {
      industryLabel: parsed.industryLabel || pickIndustryLabel(input.industry),
      executiveSummary: parsed.executiveSummary || buildFallbackNarrative(input, discovery, scores, evidence, confidence).executiveSummary,
      wins: Array.isArray(parsed.wins) ? parsed.wins.slice(0, 3) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 3) : [],
      nextActions: Array.isArray(parsed.nextActions) ? parsed.nextActions.slice(0, 3) : []
    };
  } catch {
    return buildFallbackNarrative(input, discovery, scores, evidence, confidence);
  }
}

function compactAssetCount(assetDetails) {
  return ["homepage", "instagram", "youtube", "naverStore", "map"]
    .map((k) => assetDetails[k])
    .filter(Boolean).length;
}

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "google-custom-search-removed",
      env: {
        hasGemini: !!ENV.GEMINI_API_KEY,
        hasYouTube: !!ENV.YOUTUBE_API_KEY,
        hasNaver: !!(ENV.NAVER_CLIENT_ID && ENV.NAVER_CLIENT_SECRET),
        hasPageSpeed: !!ENV.PAGESPEED_API_KEY
      }
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      message: "Method not allowed"
    });
  }

  try {
    const body = await readBody(req);

    const input = {
      companyName: String(body.companyName || body.company || "").trim(),
      industry: String(body.industry || "").trim(),
      region: String(body.region || "").trim(),
      email: String(body.email || "").trim()
    };

    if (!input.companyName) {
      return res.status(400).json({
        ok: false,
        message: "companyName is required"
      });
    }

    if (input.email && !isEmail(input.email)) {
      return res.status(400).json({
        ok: false,
        message: "email format is invalid"
      });
    }

    const [blog, shopping, youtube] = await Promise.all([
      searchNaverBlog(input),
      searchNaverShopping(input),
      searchYouTube(input)
    ]);

    const naverStore = pickNaverStore(input, shopping.items || []);
    const homepage = inferHomepage(input, shopping.items || []);
    const youtubeAsset = youtube.best
      ? {
          title: youtube.best.title,
          url: youtube.best.url,
          source: "youtube",
          confidence: youtube.best.confidence,
          snippet: youtube.best.snippet,
          subscribers: youtube.best.subscribers,
          videoCount: youtube.best.videoCount,
          viewCount: youtube.best.viewCount
        }
      : null;

    const instagram = null;
    const map = null;

    const pageSpeed = homepage?.url ? await runPageSpeed(homepage.url) : null;

    const assetDetails = {
      homepage,
      instagram,
      youtube: youtubeAsset,
      naverStore,
      map
    };

    const discovery = {
      assets: {
        homepage: homepage?.url || null,
        instagram: instagram?.url || null,
        youtube: youtubeAsset?.url || null,
        naverStore: naverStore?.url || null,
        map: map?.url || null
      },
      assetDetails,
      pageSpeed,
      counts: {
        naverBlogItems: (blog.items || []).length,
        naverShoppingItems: (shopping.items || []).length,
        regionHits: countRegionSignals(input.region, [
          ...(blog.items || []),
          ...(shopping.items || [])
        ]),
        assetCount: compactAssetCount(assetDetails)
      },
      sourceStatus: {
        naverBlog: {
          ok: blog.ok,
          total: blog.total,
          errorCount: (blog.errors || []).length
        },
        naverShopping: {
          ok: shopping.ok,
          total: shopping.total,
          errorCount: (shopping.errors || []).length
        },
        youtube: {
          ok: youtube.ok,
          candidateCount: (youtube.items || []).length,
          error: youtube.error || null
        },
        pageSpeed: {
          ok: !!pageSpeed
        }
      }
    };

    const evidence = buildEvidence(input, blog, shopping, youtube);
    const confidence = computeConfidence(discovery, discovery.sourceStatus, evidence);
    const scores = computeScores(input, discovery, discovery.sourceStatus, evidence);
    const narrative = await buildNarrativeWithGemini(input, discovery, scores, evidence, confidence);

    const diagnosis = {
      industryLabel: narrative.industryLabel || pickIndustryLabel(input.industry),
      confidence: confidence.level,
      confidenceDescription: confidence.description,
      executiveSummary: narrative.executiveSummary,
      scores,
      wins: Array.isArray(narrative.wins) ? narrative.wins : [],
      risks: Array.isArray(narrative.risks) ? narrative.risks : [],
      nextActions: Array.isArray(narrative.nextActions) ? narrative.nextActions : [],
      limits: [
        "현재 버전은 Google Custom Search 없이 NAVER Blog/Shopping, YouTube, PageSpeed 기준으로 1차 진단합니다.",
        "공식 홈페이지/인스타그램/지도 자산은 강한 증거가 있을 때만 확정하며, 일부 업체는 null로 남을 수 있습니다.",
        "URL 직접 입력 기능이나 추가 검색 소스를 붙이면 자산 확정률을 더 높일 수 있습니다."
      ]
    };

    return res.status(200).json({
      ok: true,
      input,
      discovery,
      diagnosis,
      evidence
    });
  } catch (error) {
    console.error("analyze fatal error:", error);

    return res.status(500).json({
      ok: false,
      message: "analyze failed",
      error: error?.message || "unknown error"
    });
  }
}

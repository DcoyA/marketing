// /api/analyze.js
// Vercel Serverless Function
// 현재 구조:
// - 프론트(script.js)에서 POST /api/analyze 호출
// - 입력값: companyName, industry, region, email
// - 반환값: { input, discovery, diagnosis, evidence }
//
// 지원 범위:
// 1) Google Custom Search 기반 후보 탐색
// 2) NAVER 블로그/쇼핑/지역 기반 후보 탐색
// 3) YouTube Data API 기반 채널 후보 탐색
// 4) Instagram 후보 탐색 (공개 웹 검색 기반)
// 5) 홈페이지 후보가 있으면 PageSpeed 측정
// 6) 규칙 기반 점수화
// 7) Gemini로 문장 품질 보강 (실패 시 deterministic fallback)

const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";
const YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_CHANNELS_ENDPOINT = "https://www.googleapis.com/youtube/v3/channels";
const PAGESPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const NAVER_SEARCH_BASE = "https://openapi.naver.com/v1/search";
const GEMINI_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  GOOGLE_SEARCH_API_KEY: process.env.GOOGLE_SEARCH_API_KEY || "",
  GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID || "",
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || "",
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || "",
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || "",
  PAGESPEED_API_KEY: process.env.PAGESPEED_API_KEY || ""
};

const SOCIAL_DOMAINS = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "smartstore.naver.com",
  "search.shopping.naver.com",
  "blog.naver.com",
  "map.naver.com",
  "m.place.naver.com",
  "place.map.kakao.com",
  "google.com"
];

const REJECT_HOMEPAGE_DOMAINS = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "blog.naver.com",
  "cafe.naver.com",
  "map.naver.com",
  "m.place.naver.com",
  "place.map.kakao.com",
  "smartstore.naver.com",
  "search.shopping.naver.com",
  "play.google.com",
  "apps.apple.com",
  "namu.wiki",
  "jobplanet.co.kr",
  "wanted.co.kr"
];

function stripHtml(input = "") {
  return String(input).replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
}

function normalizeText(input = "") {
  return String(input)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function tokenize(input = "") {
  return String(input)
    .toLowerCase()
    .split(/[\s/|,._\-()]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function safeJsonParse(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch (_) {
    try {
      const cleaned = String(text)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleaned);
    } catch (_) {
      return fallback;
    }
  }
}

function getHostname(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
}

function isSameOrSubdomain(hostname = "", domain = "") {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function domainMatchesAny(url = "", domains = []) {
  const hostname = getHostname(url);
  return domains.some((d) => isSameOrSubdomain(hostname, d));
}

function looksLikeInstagramProfile(url = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!isSameOrSubdomain(host, "instagram.com")) return false;
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return false;
    const first = path.split("/")[0];
    const blocked = ["p", "reel", "reels", "explore", "stories", "tv", "accounts"];
    return !blocked.includes(first.toLowerCase());
  } catch (_) {
    return false;
  }
}

function looksLikeYouTubeChannelUrl(url = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!isSameOrSubdomain(host, "youtube.com")) return false;
    const path = u.pathname.toLowerCase();
    return path.startsWith("/@") || path.startsWith("/channel/") || path.startsWith("/c/") || path.startsWith("/user/");
  } catch (_) {
    return false;
  }
}

function scoreNameMatch(text = "", companyName = "", region = "") {
  const raw = `${text}`.toLowerCase();
  const rawCompany = String(companyName || "").toLowerCase().trim();
  const rawRegion = String(region || "").toLowerCase().trim();

  const normText = normalizeText(text);
  const normCompany = normalizeText(companyName);
  const regionTokens = tokenize(region);
  const companyTokens = tokenize(companyName);

  let score = 0;

  if (!text) return 0;

  if (normCompany && normText.includes(normCompany)) score += 60;
  if (rawCompany && raw.includes(rawCompany)) score += 20;

  let companyTokenHits = 0;
  for (const token of companyTokens) {
    if (token && raw.includes(token)) companyTokenHits += 1;
  }
  if (companyTokens.length > 0) {
    score += Math.min(20, Math.round((companyTokenHits / companyTokens.length) * 20));
  }

  let regionHits = 0;
  for (const token of regionTokens) {
    if (token && raw.includes(token)) regionHits += 1;
  }
  if (regionTokens.length > 0) {
    score += Math.min(15, Math.round((regionHits / regionTokens.length) * 15));
  } else if (rawRegion && raw.includes(rawRegion)) {
    score += 10;
  }

  return clamp(score, 0, 100);
}

function uniqueBy(items = [], keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function countTruthy(arr = []) {
  return arr.filter(Boolean).length;
}

function getIndustryLabel(industry = "") {
  switch (industry) {
    case "it":
      return "IT / B2B / SaaS";
    case "local":
      return "소상공인 / 로컬 서비스";
    case "ecommerce":
      return "이커머스 / 쇼핑몰";
    case "professional":
      return "전문 서비스 / 컨설팅";
    case "creator":
      return "지식형 / 콘텐츠형";
    default:
      return "기타";
  }
}

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === "string") {
      return safeJsonParse(req.body, {});
    }
    return req.body;
  }

  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} - ${text.slice(0, 400)}`);
  }
  return response.json();
}

function mapGoogleItem(item = {}) {
  return {
    title: stripHtml(item.title || ""),
    snippet: stripHtml(item.snippet || ""),
    url: item.link || "",
    displayLink: item.displayLink || "",
    source: "google"
  };
}

async function googleSearch(query, num = 5) {
  if (!ENV.GOOGLE_SEARCH_API_KEY || !ENV.GOOGLE_SEARCH_ENGINE_ID) {
    return { items: [], warning: "GOOGLE_SEARCH_API_KEY 또는 GOOGLE_SEARCH_ENGINE_ID 미설정" };
  }

  const url =
    `${GOOGLE_CSE_ENDPOINT}?key=${encodeURIComponent(ENV.GOOGLE_SEARCH_API_KEY)}` +
    `&cx=${encodeURIComponent(ENV.GOOGLE_SEARCH_ENGINE_ID)}` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${num}`;

  const data = await fetchJson(url);
  return {
    items: (data.items || []).map(mapGoogleItem),
    warning: null
  };
}

function scoreGoogleCandidate(item, { companyName, region, boost = 0, type = "generic" }) {
  const text = `${item.title} ${item.snippet} ${item.url}`;
  let score = scoreNameMatch(text, companyName, region) + boost;

  const hostname = getHostname(item.url);

  if (type === "homepage") {
    if (domainMatchesAny(item.url, REJECT_HOMEPAGE_DOMAINS)) score -= 40;
    if (!domainMatchesAny(item.url, REJECT_HOMEPAGE_DOMAINS)) score += 12;
    if (/\b(official|공식|회사|기업|홈페이지|서비스)\b/i.test(text)) score += 8;
  }

  if (type === "instagram") {
    if (looksLikeInstagramProfile(item.url)) score += 18;
    else score -= 10;
  }

  if (type === "map") {
    if (
      hostname.includes("map.naver.com") ||
      hostname.includes("m.place.naver.com") ||
      hostname.includes("google.com") ||
      hostname.includes("g.page")
    ) {
      score += 20;
    }
  }

  if (type === "naverStore") {
    if (hostname.includes("smartstore.naver.com") || hostname.includes("search.shopping.naver.com")) {
      score += 25;
    }
  }

  return clamp(score, 0, 100);
}

function pickBestGoogleResult(items = [], { companyName, region, type = "generic" }) {
  if (!items.length) return null;

  const scored = items
    .map((item) => ({
      ...item,
      matchScore: scoreGoogleCandidate(item, { companyName, region, type })
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const best = scored[0];
  if (!best || best.matchScore < 35) return null;
  return best;
}

async function discoverGoogleAssets({ companyName, region }) {
  const querySet = [
    { key: "general", query: `${companyName} ${region}` },
    { key: "homepage", query: `${companyName} ${region} 공식 홈페이지` },
    { key: "instagram", query: `${companyName} ${region} site:instagram.com` },
    { key: "youtube", query: `${companyName} ${region} site:youtube.com` },
    { key: "naverStore", query: `${companyName} ${region} site:smartstore.naver.com` },
    { key: "map", query: `${companyName} ${region} 지도` }
  ];

  const settled = await Promise.allSettled(querySet.map((q) => googleSearch(q.query, 5)));

  const raw = {};
  const warnings = [];

  settled.forEach((result, index) => {
    const key = querySet[index].key;
    if (result.status === "fulfilled") {
      raw[key] = result.value.items || [];
      if (result.value.warning) warnings.push(result.value.warning);
    } else {
      raw[key] = [];
      warnings.push(`Google 탐색 실패: ${key}`);
    }
  });

  const homepage = pickBestGoogleResult(
    uniqueBy([...(raw.homepage || []), ...(raw.general || [])], (v) => v.url),
    { companyName, region, type: "homepage" }
  );

  const instagram = pickBestGoogleResult(
    uniqueBy([...(raw.instagram || []), ...(raw.general || [])].filter((v) => looksLikeInstagramProfile(v.url)), (v) => v.url),
    { companyName, region, type: "instagram" }
  );

  const naverStore = pickBestGoogleResult(
    uniqueBy(
      [...(raw.naverStore || []), ...(raw.general || [])].filter((v) => {
        const host = getHostname(v.url);
        return host.includes("smartstore.naver.com") || host.includes("search.shopping.naver.com");
      }),
      (v) => v.url
    ),
    { companyName, region, type: "naverStore" }
  );

  const map = pickBestGoogleResult(
    uniqueBy(
      [...(raw.map || []), ...(raw.general || [])].filter((v) => {
        const host = getHostname(v.url);
        return (
          host.includes("map.naver.com") ||
          host.includes("m.place.naver.com") ||
          host.includes("g.page") ||
          host.includes("google.com")
        );
      }),
      (v) => v.url
    ),
    { companyName, region, type: "map" }
  );

  const evidence = [];
  if (homepage) {
    evidence.push({
      title: homepage.title || "공식 홈페이지 후보",
      platform: "Google",
      reason: `Google 검색 결과에서 홈페이지 후보를 발견했습니다. 매칭 점수 ${homepage.matchScore}`,
      url: homepage.url
    });
  }
  if (instagram) {
    evidence.push({
      title: instagram.title || "Instagram 후보",
      platform: "Instagram",
      reason: `공개 웹 검색 결과에서 Instagram 프로필 후보를 발견했습니다. 매칭 점수 ${instagram.matchScore}`,
      url: instagram.url
    });
  }
  if (naverStore) {
    evidence.push({
      title: naverStore.title || "NAVER 쇼핑/스토어 후보",
      platform: "NAVER",
      reason: `Google 검색 결과에서 NAVER 스토어/쇼핑 후보를 발견했습니다. 매칭 점수 ${naverStore.matchScore}`,
      url: naverStore.url
    });
  }
  if (map) {
    evidence.push({
      title: map.title || "지도/플랫폼 후보",
      platform: "Map",
      reason: `Google 검색 결과에서 지도성 노출 후보를 발견했습니다. 매칭 점수 ${map.matchScore}`,
      url: map.url
    });
  }

  return {
    assets: {
      homepage,
      instagram,
      naverStore,
      map
    },
    raw,
    evidence,
    warnings
  };
}

async function naverSearch(endpoint, query, display = 5) {
  if (!ENV.NAVER_CLIENT_ID || !ENV.NAVER_CLIENT_SECRET) {
    return { items: [], warning: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 미설정" };
  }

  const url =
    `${NAVER_SEARCH_BASE}/${endpoint}?query=${encodeURIComponent(query)}&display=${display}&sort=sim`;

  const data = await fetchJson(url, {
    headers: {
      "X-Naver-Client-Id": ENV.NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": ENV.NAVER_CLIENT_SECRET
    }
  });

  return { items: data.items || [], total: data.total || 0, warning: null };
}

function mapNaverBlogItem(item = {}) {
  return {
    title: stripHtml(item.title || ""),
    snippet: stripHtml(item.description || ""),
    url: item.link || "",
    bloggerName: stripHtml(item.bloggername || ""),
    bloggerLink: item.bloggerlink || "",
    postDate: item.postdate || "",
    source: "naver_blog"
  };
}

function mapNaverShoppingItem(item = {}) {
  return {
    title: stripHtml(item.title || ""),
    snippet: `판매처: ${stripHtml(item.mallName || "")} / 최저가: ${item.lprice || "-"}`,
    url: item.link || "",
    mallName: stripHtml(item.mallName || ""),
    price: item.lprice || "",
    brand: stripHtml(item.brand || ""),
    maker: stripHtml(item.maker || ""),
    productId: item.productId || "",
    source: "naver_shopping"
  };
}

function mapNaverLocalItem(item = {}) {
  return {
    title: stripHtml(item.title || ""),
    snippet: stripHtml(item.description || ""),
    url: item.link || "",
    category: stripHtml(item.category || ""),
    address: stripHtml(item.address || ""),
    roadAddress: stripHtml(item.roadAddress || ""),
    telephone: stripHtml(item.telephone || ""),
    source: "naver_local"
  };
}

function pickBestNaverItem(items = [], { companyName, region, type = "generic" }) {
  if (!items.length) return null;

  const scored = items
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);

      if (type === "local") {
        if (item.address || item.roadAddress) score += 15;
        if (item.category) score += 8;
      }

      if (type === "shopping") {
        if (item.mallName) score += 10;
        if (item.price) score += 5;
      }

      return {
        ...item,
        matchScore: clamp(score, 0, 100)
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const best = scored[0];
  if (!best || best.matchScore < 30) return null;
  return best;
}

async function discoverNaverAssets({ companyName, region }) {
  const query = `${companyName} ${region}`;

  const [blogRes, shoppingRes, localRes] = await Promise.allSettled([
    naverSearch("blog.json", query, 5),
    naverSearch("shop.json", query, 5),
    naverSearch("local.json", query, 5)
  ]);

  const warnings = [];
  const blogItems =
    blogRes.status === "fulfilled"
      ? (blogRes.value.items || []).map(mapNaverBlogItem)
      : [];
  const shoppingItems =
    shoppingRes.status === "fulfilled"
      ? (shoppingRes.value.items || []).map(mapNaverShoppingItem)
      : [];
  const localItems =
    localRes.status === "fulfilled"
      ? (localRes.value.items || []).map(mapNaverLocalItem)
      : [];

  if (blogRes.status === "fulfilled" && blogRes.value.warning) warnings.push(blogRes.value.warning);
  if (shoppingRes.status === "fulfilled" && shoppingRes.value.warning) warnings.push(shoppingRes.value.warning);
  if (localRes.status === "fulfilled" && localRes.value.warning) warnings.push(localRes.value.warning);

  if (blogRes.status === "rejected") warnings.push("NAVER 블로그 검색 실패");
  if (shoppingRes.status === "rejected") warnings.push("NAVER 쇼핑 검색 실패");
  if (localRes.status === "rejected") warnings.push("NAVER 지역 검색 실패");

  const naverStore = pickBestNaverItem(shoppingItems, { companyName, region, type: "shopping" });
  const map = pickBestNaverItem(localItems, { companyName, region, type: "local" });

  const evidence = [];

  if (blogItems.length > 0) {
    evidence.push({
      title: blogItems[0].title || "NAVER 블로그 노출",
      platform: "NAVER Blog",
      reason: `NAVER 블로그 검색에서 관련 게시글 ${blogItems.length}건 이상 후보가 확인되었습니다.`,
      url: blogItems[0].url
    });
  }

  if (naverStore) {
    evidence.push({
      title: naverStore.title || "NAVER 쇼핑 노출",
      platform: "NAVER Shopping",
      reason: `NAVER 쇼핑 검색 결과에서 상품/스토어 후보가 확인되었습니다. 매칭 점수 ${naverStore.matchScore}`,
      url: naverStore.url
    });
  }

  if (map) {
    evidence.push({
      title: map.title || "NAVER 지역 노출",
      platform: "NAVER Local",
      reason: `NAVER 지역 검색에서 업체 후보가 확인되었습니다. 매칭 점수 ${map.matchScore}`,
      url: map.url
    });
  }

  return {
    blogItems,
    shoppingItems,
    localItems,
    assets: {
      naverStore,
      map
    },
    signals: {
      naverBlogCount: blogItems.length,
      naverShoppingCount: shoppingItems.length,
      naverLocalCount: localItems.length
    },
    evidence,
    warnings
  };
}

async function searchYouTubeChannels(query, maxResults = 5) {
  if (!ENV.YOUTUBE_API_KEY) {
    return { items: [], warning: "YOUTUBE_API_KEY 미설정" };
  }

  const url =
    `${YOUTUBE_SEARCH_ENDPOINT}?part=snippet&type=channel&maxResults=${maxResults}` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(ENV.YOUTUBE_API_KEY)}`;

  const data = await fetchJson(url);
  return { items: data.items || [], warning: null };
}

async function getYouTubeChannelStats(channelIds = []) {
  if (!channelIds.length) return [];
  if (!ENV.YOUTUBE_API_KEY) return [];

  const url =
    `${YOUTUBE_CHANNELS_ENDPOINT}?part=snippet,statistics&id=${encodeURIComponent(channelIds.join(","))}` +
    `&key=${encodeURIComponent(ENV.YOUTUBE_API_KEY)}`;

  const data = await fetchJson(url);
  return data.items || [];
}

async function findYouTubeCandidate({ companyName, region }) {
  const queries = [`${companyName} ${region}`, `${companyName}`];

  const searchSettled = await Promise.allSettled(queries.map((q) => searchYouTubeChannels(q, 5)));
  const warnings = [];

  const searchItems = searchSettled
    .flatMap((res) => {
      if (res.status === "fulfilled") {
        if (res.value.warning) warnings.push(res.value.warning);
        return res.value.items || [];
      }
      warnings.push("YouTube 채널 검색 실패");
      return [];
    });

  const uniqueSearchItems = uniqueBy(
    searchItems
      .map((item) => ({
        channelId: item?.id?.channelId || "",
        title: stripHtml(item?.snippet?.title || ""),
        snippet: stripHtml(item?.snippet?.description || ""),
        url: item?.id?.channelId ? `https://www.youtube.com/channel/${item.id.channelId}` : "",
        publishedAt: item?.snippet?.publishedAt || ""
      }))
      .filter((v) => v.channelId),
    (v) => v.channelId
  );

  if (!uniqueSearchItems.length) {
    return { asset: null, evidence: [], warnings };
  }

  const stats = await getYouTubeChannelStats(uniqueSearchItems.map((v) => v.channelId));

  const statMap = new Map();
  for (const item of stats) {
    statMap.set(item.id, {
      title: stripHtml(item?.snippet?.title || ""),
      snippet: stripHtml(item?.snippet?.description || ""),
      customUrl: item?.snippet?.customUrl || "",
      thumbnails: item?.snippet?.thumbnails || {},
      subscriberCount: Number(item?.statistics?.subscriberCount || 0),
      videoCount: Number(item?.statistics?.videoCount || 0),
      viewCount: Number(item?.statistics?.viewCount || 0)
    });
  }

  const candidates = uniqueSearchItems
    .map((item) => {
      const stat = statMap.get(item.channelId) || {};
      const mergedTitle = stat.title || item.title;
      const mergedSnippet = stat.snippet || item.snippet;
      const mergedUrl = stat.customUrl
        ? `https://www.youtube.com/${stat.customUrl.startsWith("@") ? stat.customUrl : `@${stat.customUrl}`}`
        : item.url;

      let score = scoreNameMatch(`${mergedTitle} ${mergedSnippet}`, companyName, region);
      if ((stat.videoCount || 0) > 0) score += 10;
      if ((stat.subscriberCount || 0) > 0) score += 8;
      if (looksLikeYouTubeChannelUrl(mergedUrl)) score += 10;

      return {
        title: mergedTitle,
        snippet: mergedSnippet,
        url: mergedUrl,
        channelId: item.channelId,
        matchScore: clamp(score, 0, 100),
        stats: {
          subscriberCount: stat.subscriberCount || 0,
          videoCount: stat.videoCount || 0,
          viewCount: stat.viewCount || 0
        },
        source: "youtube"
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  const best = candidates[0];
  const asset = best && best.matchScore >= 35 ? best : null;

  const evidence = asset
    ? [
        {
          title: asset.title || "YouTube 채널 후보",
          platform: "YouTube",
          reason: `YouTube 채널 후보를 발견했습니다. 구독자 ${asset.stats.subscriberCount.toLocaleString()} / 영상 ${asset.stats.videoCount.toLocaleString()} / 누적조회 ${asset.stats.viewCount.toLocaleString()}`,
          url: asset.url
        }
      ]
    : [];

  return { asset, evidence, warnings };
}

async function runPageSpeed(url) {
  if (!url) return null;
  if (!ENV.PAGESPEED_API_KEY) {
    return { mobile: null, desktop: null, warning: "PAGESPEED_API_KEY 미설정" };
  }

  async function fetchOne(strategy) {
    const endpoint =
      `${PAGESPEED_ENDPOINT}?url=${encodeURIComponent(url)}&strategy=${strategy}` +
      `&key=${encodeURIComponent(ENV.PAGESPEED_API_KEY)}`;

    const data = await fetchJson(endpoint);
    const score = data?.lighthouseResult?.categories?.performance?.score;
    return score != null ? Math.round(score * 100) : null;
  }

  const [mobile, desktop] = await Promise.allSettled([fetchOne("mobile"), fetchOne("desktop")]);

  return {
    mobile: mobile.status === "fulfilled" ? mobile.value : null,
    desktop: desktop.status === "fulfilled" ? desktop.value : null,
    warning:
      mobile.status === "rejected" || desktop.status === "rejected"
        ? "PageSpeed 일부 측정 실패"
        : null
  };
}

function mergeDiscovery({ googleDiscovery, naverDiscovery, youtubeDiscovery, pageSpeed }) {
  const homepage = googleDiscovery?.assets?.homepage || null;

  const instagram = googleDiscovery?.assets?.instagram || null;

  const youtube = youtubeDiscovery?.asset || null;

  const naverStore =
    (naverDiscovery?.assets?.naverStore &&
      (!googleDiscovery?.assets?.naverStore ||
        (naverDiscovery.assets.naverStore.matchScore || 0) >= (googleDiscovery.assets.naverStore.matchScore || 0))
      ? naverDiscovery.assets.naverStore
      : googleDiscovery?.assets?.naverStore) || null;

  const map =
    (naverDiscovery?.assets?.map &&
      (!googleDiscovery?.assets?.map ||
        (naverDiscovery.assets.map.matchScore || 0) >= (googleDiscovery.assets.map.matchScore || 0))
      ? naverDiscovery.assets.map
      : googleDiscovery?.assets?.map) || null;

  const warnings = [
    ...(googleDiscovery?.warnings || []),
    ...(navaverSafe(naverDiscovery?.warnings) || []),
    ...(youtubeDiscovery?.warnings || []),
    ...(pageSpeed?.warning ? [pageSpeed.warning] : [])
  ].filter(Boolean);

  return {
    assets: {
      homepage,
      instagram,
      youtube,
      naverStore,
      map
    },
    pageSpeed: pageSpeed
      ? {
          mobile: pageSpeed.mobile,
          desktop: pageSpeed.desktop
        }
      : null,
    signals: {
      naverBlogCount: naverDiscovery?.signals?.naverBlogCount || 0,
      naverShoppingCount: naverDiscovery?.signals?.naverShoppingCount || 0,
      naverLocalCount: naverDiscovery?.signals?.naverLocalCount || 0
    },
    raw: {
      google: googleDiscovery?.raw || {},
      naverBlog: naverDiscovery?.blogItems || [],
      naverShopping: naverDiscovery?.shoppingItems || [],
      naverLocal: naverDiscovery?.localItems || []
    },
    warnings
  };
}

function navaverSafe(value) {
  return Array.isArray(value) ? value : [];
}

function calculateScores({ industry, discovery }) {
  const { assets, pageSpeed, signals } = discovery;

  const hasHomepage = !!assets.homepage;
  const hasInstagram = !!assets.instagram;
  const hasYoutube = !!assets.youtube;
  const hasStore = !!assets.naverStore;
  const hasMap = !!assets.map;

  const blogCount = signals.naverBlogCount || 0;
  const shoppingCount = signals.naverShoppingCount || 0;
  const localCount = signals.naverLocalCount || 0;

  let searchVisibility = 0;
  searchVisibility += hasHomepage ? 28 : 0;
  searchVisibility += hasMap ? 18 : 0;
  searchVisibility += hasStore ? 16 : 0;
  searchVisibility += blogCount >= 5 ? 18 : blogCount >= 1 ? 10 : 0;
  searchVisibility += hasInstagram ? 10 : 0;
  searchVisibility += hasYoutube ? 10 : 0;
  searchVisibility = clamp(searchVisibility, 0, 100);

  let contentPresence = 0;
  contentPresence += hasInstagram ? 30 : 0;
  contentPresence += hasYoutube ? 32 : 0;
  contentPresence += blogCount >= 5 ? 22 : blogCount >= 1 ? 12 : 0;
  contentPresence += hasHomepage ? 10 : 0;
  contentPresence += hasStore ? 6 : 0;
  contentPresence = clamp(contentPresence, 0, 100);

  let localExposure = 0;
  localExposure += hasMap ? 40 : 0;
  localExposure += localCount >= 3 ? 25 : localCount >= 1 ? 16 : 0;
  localExposure += hasStore ? 18 : 0;
  localExposure += blogCount >= 3 ? 10 : blogCount >= 1 ? 5 : 0;
  localExposure = clamp(localExposure, 0, 100);

  let webQuality = 0;
  if (hasHomepage) webQuality += 35;
  if (pageSpeed?.mobile != null) webQuality += Math.round((pageSpeed.mobile / 100) * 35);
  if (pageSpeed?.desktop != null) webQuality += Math.round((pageSpeed.desktop / 100) * 30);
  webQuality = clamp(webQuality, 0, 100);

  let overall = 0;

  switch (industry) {
    case "it":
      overall = Math.round(searchVisibility * 0.27 + contentPresence * 0.18 + localExposure * 0.08 + webQuality * 0.47);
      break;
    case "local":
      overall = Math.round(searchVisibility * 0.22 + contentPresence * 0.14 + localExposure * 0.42 + webQuality * 0.22);
      break;
    case "ecommerce":
      overall = Math.round(searchVisibility * 0.25 + contentPresence * 0.22 + localExposure * 0.16 + webQuality * 0.37);
      break;
    case "professional":
      overall = Math.round(searchVisibility * 0.28 + contentPresence * 0.16 + localExposure * 0.16 + webQuality * 0.40);
      break;
    case "creator":
      overall = Math.round(searchVisibility * 0.18 + contentPresence * 0.45 + localExposure * 0.07 + webQuality * 0.30);
      break;
    default:
      overall = Math.round(searchVisibility * 0.25 + contentPresence * 0.20 + localExposure * 0.20 + webQuality * 0.35);
      break;
  }

  return {
    overall: clamp(overall, 0, 100),
    searchVisibility: clamp(searchVisibility, 0, 100),
    contentPresence: clamp(contentPresence, 0, 100),
    localExposure: clamp(localExposure, 0, 100),
    webQuality: clamp(webQuality, 0, 100)
  };
}

function calculateConfidence(discovery) {
  const assets = discovery.assets || {};
  const matchedAssets = [assets.homepage, assets.instagram, assets.youtube, assets.naverStore, assets.map].filter(Boolean);

  const avgMatch = matchedAssets.length
    ? Math.round(
        matchedAssets.reduce((acc, cur) => acc + Number(cur.matchScore || 50), 0) / matchedAssets.length
      )
    : 0;

  if (matchedAssets.length >= 4 && avgMatch >= 60) {
    return {
      confidence: "높음",
      confidenceDescription: "여러 플랫폼에서 브랜드명/지역과 일치하는 자산이 동시에 확인되어 후보 신뢰도가 높은 편입니다."
    };
  }

  if (matchedAssets.length >= 2 && avgMatch >= 45) {
    return {
      confidence: "중간",
      confidenceDescription: "복수 자산이 발견되었지만 일부는 추가 확인이 필요한 후보 단계입니다."
    };
  }

  return {
    confidence: "낮음",
    confidenceDescription: "발견 자산 수가 적거나 브랜드 일치도가 낮아 초기 후보 수준으로 해석해야 합니다."
  };
}

function buildDeterministicDiagnosis({ companyName, industry, region, discovery, scores }) {
  const industryLabel = getIndustryLabel(industry);
  const assets = discovery.assets || {};
  const pageSpeed = discovery.pageSpeed || {};
  const signals = discovery.signals || {};

  const { confidence, confidenceDescription } = calculateConfidence(discovery);

  const wins = [];
  const risks = [];
  const nextActions = [];
  const limits = [];

  if (assets.homepage) {
    wins.push("공식 홈페이지 후보가 확인되어 브랜드 검색 후 이탈 없이 자사 자산으로 연결될 가능성이 있습니다.");
  } else {
    risks.push("공식 홈페이지 후보가 명확하지 않아 검색 유입이 플랫폼이나 제3자 페이지로 분산될 가능성이 큽니다.");
    nextActions.push("브랜드명 + 지역으로 검색했을 때 바로 식별되는 공식 홈페이지/대표 랜딩페이지를 우선 정비하세요.");
  }

  if (assets.instagram) {
    wins.push("Instagram 프로필 후보가 확인되어 소셜 접점은 최소한 존재합니다.");
  } else {
    risks.push("Instagram 공식 계정 후보가 뚜렷하게 확인되지 않아 브랜드 검색 시 소셜 신뢰 자산이 약할 수 있습니다.");
    if (industry === "creator" || industry === "ecommerce" || industry === "local") {
      nextActions.push("Instagram 공식 계정을 브랜드명 기준으로 정리하고 검색 결과에 노출되도록 프로필명/소개/링크를 정비하세요.");
    }
  }

  if (assets.youtube) {
    const videoCount = assets.youtube?.stats?.videoCount || 0;
    if (videoCount >= 10) {
      wins.push("YouTube 채널 후보와 누적 콘텐츠가 확인되어 검색형/콘텐츠형 자산 축적이 어느 정도 진행된 상태로 보입니다.");
    } else {
      risks.push("YouTube 채널은 보이지만 누적 영상 수가 많지 않아 콘텐츠 자산 축적 효과는 아직 제한적일 수 있습니다.");
    }
  } else {
    if (industry === "it" || industry === "creator" || industry === "professional") {
      risks.push("YouTube 채널 후보가 명확하지 않아 검색형 콘텐츠 자산이 부족할 가능성이 있습니다.");
      nextActions.push("브랜드명 또는 핵심 서비스명을 사용하는 YouTube 채널을 개설/정비하고 대표 영상 3~5개를 우선 축적하세요.");
    }
  }

  if (assets.map) {
    wins.push("지역/지도성 노출 후보가 확인되어 최소한 로컬 검색 접점은 존재합니다.");
  } else if (industry === "local") {
    risks.push("로컬 서비스 업종인데 지역/지도성 노출 후보가 약해 핵심 검색 순간에 경쟁업체에게 밀릴 수 있습니다.");
    nextActions.push("NAVER 지역/지도 계열 노출과 프로필 정합성을 먼저 점검하세요.");
  }

  if (assets.naverStore) {
    wins.push("NAVER 쇼핑/스토어 흔적이 확인되어 상품형 검색 접점이 존재합니다.");
  } else if (industry === "ecommerce") {
    risks.push("이커머스 업종인데 NAVER 쇼핑/스토어 흔적이 약해 구매 검색 유입 손실 가능성이 있습니다.");
    nextActions.push("브랜드명/대표 상품명 기준으로 NAVER 쇼핑 또는 스토어 노출 경로를 확보하세요.");
  }

  if ((signals.naverBlogCount || 0) >= 3) {
    wins.push("NAVER 블로그 검색에서 관련 흔적이 확인되어 외부 언급 또는 후기성 자산이 일부 존재합니다.");
  } else {
    risks.push("NAVER 블로그 흔적이 적어 한국형 검색 환경에서 브랜드 신뢰 보강이 약할 수 있습니다.");
    nextActions.push("브랜드명·지역명·핵심 서비스 키워드가 함께 들어간 블로그성/리뷰성 콘텐츠 축적 전략을 병행하세요.");
  }

  if (pageSpeed.mobile != null) {
    if (pageSpeed.mobile >= 70) {
      wins.push(`모바일 PageSpeed ${pageSpeed.mobile}점으로 기본 웹 성능은 비교적 양호합니다.`);
    } else {
      risks.push(`모바일 PageSpeed ${pageSpeed.mobile}점으로 모바일 유입에서 이탈 리스크가 있습니다.`);
      nextActions.push("메인 이미지 용량, 폰트 로딩, 스크립트 수를 줄여 모바일 속도를 우선 개선하세요.");
    }
  } else if (assets.homepage) {
    limits.push("홈페이지 후보는 발견했지만 PageSpeed 측정이 완료되지 않았습니다.");
  }

  if (industry === "it") {
    nextActions.push("브랜드 검색 결과 1페이지에서 공식 홈페이지, 제품 설명, 사례 콘텐츠, YouTube/블로그 흐름이 이어지도록 정보 구조를 정비하세요.");
  }
  if (industry === "professional") {
    nextActions.push("상담/문의 전환을 높이기 위해 대표 서비스, 사례, 후기, CTA를 랜딩 상단에서 즉시 보이게 만드세요.");
  }
  if (industry === "local") {
    nextActions.push("지역명 + 업종 검색에서 지도 노출 → 후기/블로그 → 예약/문의로 이어지는 동선을 먼저 정리하세요.");
  }
  if (industry === "ecommerce") {
    nextActions.push("쇼핑 검색, 제품 상세, 리뷰, Instagram 연결, 재구매 유도 문구를 한 세트로 보이게 만드세요.");
  }
  if (industry === "creator") {
    nextActions.push("YouTube와 Instagram 사이에 동일한 브랜딩 키워드와 대표 링크를 맞춰 검색 신뢰도를 높이세요.");
  }

  limits.push("현재 단계는 공개 웹 자동 탐색 기반의 1차 진단이며, 내부 전환율·매출·광고비 성과는 포함되지 않습니다.");
  limits.push("Instagram 저장/공유/도달/인사이트 및 광고 성과는 계정 연결 후에만 정밀 분석할 수 있습니다.");
  limits.push("동명이인 업체, 지점명 상이, 브랜드명 중복이 있는 경우 일부 후보는 사람 확인이 추가로 필요할 수 있습니다.");

  const executiveSummary = (() => {
    if (scores.overall >= 75) {
      return `${companyName}은(는) 공개 웹 기준으로 핵심 자산이 비교적 정리되어 있으나, 업종별 고효율 채널 완성도까지는 추가 점검이 필요합니다.`;
    }
    if (scores.overall >= 50) {
      return `${companyName}은(는) 일부 자산은 확인되지만 플랫폼 간 연결성과 검색-전환 구조가 아직 불완전한 상태로 보입니다.`;
    }
    return `${companyName}은(는) 공개 웹에서 핵심 브랜드 자산이 분산되었거나 부족해 검색 순간의 신뢰 확보가 약할 가능성이 큽니다.`;
  })();

  return {
    industryLabel,
    confidence,
    confidenceDescription,
    executiveSummary,
    wins: uniqueBy(wins.map((v) => ({ v })), (x) => x.v).map((x) => x.v).slice(0, 5),
    risks: uniqueBy(risks.map((v) => ({ v })), (x) => x.v).map((x) => x.v).slice(0, 6),
    nextActions: uniqueBy(nextActions.map((v) => ({ v })), (x) => x.v).map((x) => x.v).slice(0, 6),
    limits: uniqueBy(limits.map((v) => ({ v })), (x) => x.v).map((x) => x.v).slice(0, 5),
    scores
  };
}

function buildEvidence({ googleDiscovery, naverDiscovery, youtubeDiscovery, mergedDiscovery }) {
  const evidence = [
    ...(googleDiscovery?.evidence || []),
    ...(naverDiscovery?.evidence || []),
    ...(youtubeDiscovery?.evidence || [])
  ];

  if (mergedDiscovery?.pageSpeed && (mergedDiscovery.pageSpeed.mobile != null || mergedDiscovery.pageSpeed.desktop != null)) {
    evidence.push({
      title: "홈페이지 성능 측정",
      platform: "PageSpeed",
      reason: `모바일 ${mergedDiscovery.pageSpeed.mobile ?? "-"} / 데스크톱 ${mergedDiscovery.pageSpeed.desktop ?? "-"}`,
      url: mergedDiscovery.assets?.homepage?.url || ""
    });
  }

  return uniqueBy(evidence, (v) => `${v.platform}|${v.url}|${v.title}`).slice(0, 10);
}

async function callGeminiJson(prompt) {
  if (!ENV.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY 미설정");
  }

  const url = `${GEMINI_ENDPOINT_BASE}/${ENV.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(ENV.GEMINI_API_KEY)}`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.4
    }
  };

  const data = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";

  const parsed = safeJsonParse(text, null);
  if (!parsed) throw new Error("Gemini JSON 파싱 실패");
  return parsed;
}

async function refineDiagnosisWithGemini({ input, discovery, scores, deterministicDiagnosis, evidence }) {
  const prompt = `
너는 한국 시장의 마케팅 진단 전문가다.
반드시 아래 JSON 데이터에만 근거해서 판단하라.
없는 데이터는 추정하지 마라.
결과는 반드시 JSON 객체만 반환하라.

반환 형식:
{
  "executiveSummary": "string",
  "wins": ["string"],
  "risks": ["string"],
  "nextActions": ["string"],
  "limits": ["string"]
}

규칙

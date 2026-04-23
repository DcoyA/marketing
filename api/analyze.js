/* =========================
 * api/analyze.js
 * REWRITE VERSION (1/3)
 * - sourceStatus 강화
 * - verified 구조 추가
 * - debug / rawCount 추가
 * - NAVER Blog / Shopping / WebKR
 * - YouTube Search / Channels
 * - PageSpeed는 뒤 파트에서 연결
 * ========================= */

export const config = {
  api: {
    bodyParser: true,
  },
};

const NAVER_BLOG_API = "https://openapi.naver.com/v1/search/blog.json";
const NAVER_SHOPPING_API = "https://openapi.naver.com/v1/search/shop.json";
const NAVER_WEBKR_API = "https://openapi.naver.com/v1/search/webkr.json";

const YOUTUBE_SEARCH_API = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_CHANNELS_API = "https://www.googleapis.com/youtube/v3/channels";
const PAGESPEED_API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const DEFAULT_TIMEOUT_MS = 12000;

const SOCIAL_DOMAINS = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "blog.naver.com",
  "post.naver.com",
  "m.blog.naver.com",
];

const NOISY_WEB_DOMAINS = [
  "blog.naver.com",
  "post.naver.com",
  "namu.wiki",
  "wikipedia.org",
  "news.naver.com",
  "search.naver.com",
  "m.search.naver.com",
  "cafe.naver.com",
  "m.cafe.naver.com",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
];

const LOCATION_KEYWORDS = [
  "서울",
  "강남",
  "홍대",
  "부산",
  "대구",
  "대전",
  "인천",
  "광주",
  "울산",
  "수원",
  "성수",
  "명동",
  "잠실",
  "일산",
  "분당",
  "판교",
  "의정부",
  "여주",
  "김해",
  "제주",
  "코엑스",
  "아울렛",
  "매장",
  "스토어",
  "지점",
  "점",
];

const OFFICIAL_KEYWORDS = [
  "공식",
  "official",
  "브랜드스토어",
  "brand store",
  "코리아",
  "korea",
  "대한민국",
  "kr",
];

const REJECT_INSTAGRAM_PATH_KEYWORDS = [
  "/p/",
  "/reel/",
  "/reels/",
  "/stories/",
  "/tv/",
  "/explore/",
];

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of toArray(arr)) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function stripHtml(input = "") {
  return safeString(input)
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

function normalizeSpace(input = "") {
  return safeString(input).replace(/\s+/g, " ").trim();
}

function normalizeText(input = "") {
  return normalizeSpace(
    stripHtml(input)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s./:_-]+/gu, " ")
  );
}

function normalizeCompareText(input = "") {
  return normalizeText(input).replace(/\s+/g, "");
}

function extractDomain(inputUrl = "") {
  try {
    const u = new URL(inputUrl);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeUrl(inputUrl = "") {
  try {
    const u = new URL(inputUrl);
    u.hash = "";
    return u.toString();
  } catch {
    return safeString(inputUrl);
  }
}

function isSocialDomain(domain = "") {
  return SOCIAL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function isNoisyWebDomain(domain = "") {
  return NOISY_WEB_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function containsAny(text = "", keywords = []) {
  const t = normalizeText(text);
  return keywords.some((kw) => t.includes(normalizeText(kw)));
}

function countContains(text = "", keywords = []) {
  const t = normalizeText(text);
  let count = 0;
  for (const kw of keywords) {
    if (t.includes(normalizeText(kw))) count += 1;
  }
  return count;
}

function buildBrandTokens(companyName = "") {
  const raw = normalizeSpace(companyName);
  const normalized = normalizeText(companyName);

  const tokens = raw
    .split(/[\s/(),.&-]+/)
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .filter((x) => x.length >= 2);

  const merged = normalizeCompareText(companyName);

  const unique = uniqBy(
    [
      raw,
      normalized,
      merged,
      ...tokens,
      raw.replace(/\s+/g, ""),
      raw.replace(/\s+/g, "-"),
    ].map((x) => normalizeText(x)).filter(Boolean),
    (x) => x
  );

  return unique;
}

function buildQuerySet(input) {
  const company = safeString(input.companyName);
  const industry = safeString(input.industry);
  const region = safeString(input.region);

  const compact = company.replace(/\s+/g, "");
  const queries = {
    blog: uniqBy(
      [
        company,
        `${company} ${region}`,
        `${company} ${industry}`,
        `${compact} 후기`,
        `${company} 추천`,
      ].filter(Boolean),
      (x) => x
    ),
    shopping: uniqBy(
      [
        company,
        compact,
        `${company} 공식`,
        `${company} 브랜드스토어`,
        `${company} 정품`,
      ].filter(Boolean),
      (x) => x
    ),
    homepage: uniqBy(
      [
        `${company} 공식`,
        `${company} 홈페이지`,
        `${company} 코리아`,
        company,
      ].filter(Boolean),
      (x) => x
    ),
    instagram: uniqBy(
      [
        `${company} 인스타그램`,
        `${company} instagram`,
        `${company} 공식 인스타`,
        `${company} 인스타`,
      ].filter(Boolean),
      (x) => x
    ),
    youtube: uniqBy(
      [
        company,
        `${company} 공식`,
        `${company} official`,
        `${company} korea`,
      ].filter(Boolean),
      (x) => x
    ),
  };

  return queries;
}

function makeSourceStatusEntry() {
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

function makeSourceStatus() {
  return {
    naverBlog: makeSourceStatusEntry(),
    naverShopping: makeSourceStatusEntry(),
    naverWebHomepage: makeSourceStatusEntry(),
    naverWebInstagram: makeSourceStatusEntry(),
    youtube: makeSourceStatusEntry(),
    pageSpeed: makeSourceStatusEntry(),
  };
}

function makeVerified() {
  return {
    homepage: {
      found: false,
      verified: false,
      confidence: "low",
      source: null,
      reason: null,
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
      reason: null,
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
      reason: null,
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
      reason: null,
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
      reason: "지도 연동 전",
      score: 0,
      candidateCount: 0,
      url: null,
      title: null,
    },
  };
}

function makeRawCount() {
  return {
    naverBlogFetched: 0,
    naverShoppingFetched: 0,
    naverWebHomepageFetched: 0,
    naverWebInstagramFetched: 0,
    youtubeSearchFetched: 0,
    youtubeChannelFetched: 0,
    evidenceBuilt: 0,
    verifiedAssets: 0,
  };
}

function makeDebug(input) {
  return {
    stage: "rewrite-v2",
    inputEcho: {
      companyName: safeString(input.companyName),
      industry: safeString(input.industry),
      region: safeString(input.region),
      emailPresent: !!safeString(input.email),
    },
    queries: null,
    env: {
      naverClientId: !!env("NAVER_CLIENT_ID"),
      naverClientSecret: !!env("NAVER_CLIENT_SECRET"),
      youtubeApiKey: !!env("YOUTUBE_API_KEY"),
      pageSpeedApiKey: !!env("PAGESPEED_API_KEY"),
      geminiApiKey: !!env("GEMINI_API_KEY"),
    },
    requestLog: [],
    rejectedCandidates: {
      homepage: [],
      instagram: [],
      youtube: [],
      naverStore: [],
    },
    selectedReason: {
      homepage: null,
      instagram: null,
      youtube: null,
      naverStore: null,
    },
  };
}

function pushRequestLog(debug, item) {
  if (!debug || !Array.isArray(debug.requestLog)) return;
  debug.requestLog.push({
    at: new Date().toISOString(),
    ...item,
  });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

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
      headers: Object.fromEntries(res.headers.entries()),
      text,
      data,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      headers: {},
      text: "",
      data: null,
      error: error?.message || "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function getNaverHeaders() {
  return {
    "X-Naver-Client-Id": env("NAVER_CLIENT_ID"),
    "X-Naver-Client-Secret": env("NAVER_CLIENT_SECRET"),
  };
}

async function fetchNaverSearch({
  endpoint,
  query,
  display = 10,
  start = 1,
  sort = "sim",
  debug,
  sourceLabel,
}) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;

  pushRequestLog(debug, {
    source: sourceLabel,
    query,
    url,
  });

  const result = await fetchJsonWithTimeout(url, {
    headers: getNaverHeaders(),
  });

  return {
    query,
    source: sourceLabel,
    ...result,
  };
}

async function fetchYouTubeSearch({
  query,
  maxResults = 8,
  type = "channel",
  debug,
}) {
  const apiKey = env("YOUTUBE_API_KEY");
  const url =
    `${YOUTUBE_SEARCH_API}?part=snippet` +
    `&q=${encodeURIComponent(query)}` +
    `&type=${encodeURIComponent(type)}` +
    `&maxResults=${maxResults}` +
    `&key=${encodeURIComponent(apiKey)}`;

  pushRequestLog(debug, {
    source: "youtube-search",
    query,
    url,
  });

  const result = await fetchJsonWithTimeout(url);
  return {
    query,
    source: "youtube-search",
    ...result,
  };
}

async function fetchYouTubeChannels(channelIds = [], debug) {
  const ids = uniqBy(channelIds.filter(Boolean), (x) => x);
  if (!ids.length) {
    return {
      ok: true,
      status: 200,
      data: { items: [] },
      text: '{"items":[]}',
      error: null,
      source: "youtube-channels",
    };
  }

  const apiKey = env("YOUTUBE_API_KEY");
  const url =
    `${YOUTUBE_CHANNELS_API}?part=snippet,statistics,brandingSettings` +
    `&id=${encodeURIComponent(ids.join(","))}` +
    `&key=${encodeURIComponent(apiKey)}`;

  pushRequestLog(debug, {
    source: "youtube-channels",
    channelIds: ids,
    url,
  });

  const result = await fetchJsonWithTimeout(url);
  return {
    source: "youtube-channels",
    ...result,
  };
}
function makeAssetDetail({
  title = null,
  url = null,
  source = null,
  confidence = "low",
  snippet = "",
  meta = {},
}) {
  return {
    title,
    url,
    source,
    confidence,
    snippet: safeString(snippet),
    ...meta,
  };
}

function scoreToConfidence(score = 0) {
  if (score >= 90) return "high";
  if (score >= 75) return "medium";
  if (score >= 55) return "low";
  return "very-low";
}

function scoreToKoreanConfidence(score = 0) {
  if (score >= 90) return "높음";
  if (score >= 75) return "보통";
  if (score >= 55) return "낮음";
  return "매우 낮음";
}

function safeUrlObject(inputUrl = "") {
  try {
    return new URL(inputUrl);
  } catch {
    return null;
  }
}

function cleanTrailingSlash(inputUrl = "") {
  if (!inputUrl) return "";
  return inputUrl.replace(/\/+$/, "");
}

function extractPathname(inputUrl = "") {
  const u = safeUrlObject(inputUrl);
  return u ? u.pathname || "/" : "";
}

function extractHandleFromInstagramUrl(inputUrl = "") {
  const u = safeUrlObject(inputUrl);
  if (!u) return "";
  const path = (u.pathname || "/").replace(/^\/+|\/+$/g, "");
  if (!path) return "";
  const first = path.split("/")[0];
  return first || "";
}

function looksLikeInstagramProfileUrl(inputUrl = "") {
  const domain = extractDomain(inputUrl);
  if (!(domain === "instagram.com" || domain.endsWith(".instagram.com"))) return false;
  const path = extractPathname(inputUrl).toLowerCase();

  if (!path || path === "/") return false;
  if (REJECT_INSTAGRAM_PATH_KEYWORDS.some((kw) => path.startsWith(kw))) return false;

  const handle = extractHandleFromInstagramUrl(inputUrl);
  if (!handle) return false;
  if (handle.startsWith("explore")) return false;
  return true;
}

function looksLikeYouTubeChannelUrl(inputUrl = "") {
  const domain = extractDomain(inputUrl);
  if (!(domain === "youtube.com" || domain.endsWith(".youtube.com"))) return false;
  const path = extractPathname(inputUrl).toLowerCase();
  return (
    path.startsWith("/channel/") ||
    path.startsWith("/@") ||
    path.startsWith("/c/") ||
    path.startsWith("/user/")
  );
}

function looksLikeHomepageUrl(inputUrl = "") {
  const u = safeUrlObject(inputUrl);
  if (!u) return false;

  const domain = extractDomain(inputUrl);
  const path = extractPathname(inputUrl).toLowerCase();

  if (!domain) return false;
  if (isSocialDomain(domain)) return false;
  if (domain.includes("search.naver.com")) return false;
  if (domain.includes("blog.naver.com")) return false;
  if (domain.includes("youtube.com")) return false;
  if (domain.includes("instagram.com")) return false;

  if (
    path.startsWith("/search") ||
    path.startsWith("/p/") ||
    path.startsWith("/reel/") ||
    path.startsWith("/category/")
  ) {
    return false;
  }

  return true;
}

function looksLikeNaverStoreUrl(inputUrl = "") {
  const domain = extractDomain(inputUrl);
  return (
    domain === "smartstore.naver.com" ||
    domain.endsWith(".smartstore.naver.com") ||
    domain === "brand.naver.com" ||
    domain.endsWith(".brand.naver.com") ||
    domain === "shopping.naver.com" ||
    domain.endsWith(".shopping.naver.com")
  );
}

function extractUrlsFromText(input = "") {
  const text = safeString(input);
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) || [];
  return uniqBy(
    matches
      .map((x) => x.replace(/[),.;]+$/g, ""))
      .map(normalizeUrl)
      .filter(Boolean),
    (x) => x
  );
}

function buildCandidateRecord({
  type,
  source,
  title,
  url,
  snippet = "",
  score = 0,
  reason = "",
  meta = {},
}) {
  return {
    type,
    source,
    title: safeString(title),
    url: normalizeUrl(url),
    snippet: stripHtml(snippet),
    score: clamp(safeNumber(score), 0, 100),
    reason: safeString(reason),
    meta: meta || {},
  };
}

function brandMatchScore(text = "", brandTokens = []) {
  const normalized = normalizeText(text);
  const compact = normalizeCompareText(text);

  let score = 0;
  let matched = 0;

  for (const token of brandTokens) {
    const tokenNorm = normalizeText(token);
    const tokenCompact = normalizeCompareText(token);
    if (!tokenNorm) continue;

    if (normalized.includes(tokenNorm) || (tokenCompact && compact.includes(tokenCompact))) {
      matched += 1;
      if (tokenNorm.length >= 5) score += 18;
      else if (tokenNorm.length >= 3) score += 12;
      else score += 6;
    }
  }

  return {
    score: clamp(score, 0, 55),
    matched,
  };
}

function officialHintScore(text = "") {
  const hits = countContains(text, OFFICIAL_KEYWORDS);
  return clamp(hits * 8, 0, 24);
}

function noisePenalty(text = "") {
  let penalty = 0;
  if (containsAny(text, LOCATION_KEYWORDS)) penalty += 14;
  if (containsAny(text, ["후기", "리뷰", "사용기", "브이로그", "맛집", "주가", "투자", "중고"])) penalty += 16;
  if (containsAny(text, ["아울렛", "세일", "할인", "공구"])) penalty += 10;
  return clamp(penalty, 0, 36);
}

function domainBonus(domain = "") {
  if (!domain) return 0;
  if (domain.endsWith(".kr")) return 8;
  if (domain.endsWith(".com")) return 6;
  if (domain.endsWith(".co.kr")) return 10;
  if (domain.endsWith(".co")) return 4;
  return 0;
}

function computeHomepageCandidateScore(item, brandTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const domain = extractDomain(url);

  if (!looksLikeHomepageUrl(url)) {
    return { score: 0, reason: "not-homepage-like" };
  }

  let score = 0;
  const reasons = [];

  const brand = brandMatchScore(`${title} ${snippet} ${domain}`, brandTokens);
  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  const official = officialHintScore(`${title} ${snippet} ${url}`);
  score += official;
  if (official > 0) reasons.push(`official:${official}`);

  const dBonus = domainBonus(domain);
  score += dBonus;
  if (dBonus > 0) reasons.push(`domain:${dBonus}`);

  if (!isNoisyWebDomain(domain)) {
    score += 10;
    reasons.push("clean-domain:10");
  }

  if (domain && brandTokens.some((t) => domain.includes(normalizeCompareText(t)))) {
    score += 15;
    reasons.push("brand-in-domain:15");
  }

  const penalty = noisePenalty(`${title} ${snippet} ${domain}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  if (containsAny(title, ["공식 홈페이지", "공식홈페이지", "official site", "official website"])) {
    score += 18;
    reasons.push("official-title:18");
  }

  score = clamp(score, 0, 100);
  return {
    score,
    reason: reasons.join(", "),
  };
}

function computeInstagramCandidateScore(item, brandTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const domain = extractDomain(url);

  if (!looksLikeInstagramProfileUrl(url)) {
    return { score: 0, reason: "not-instagram-profile" };
  }

  let score = 0;
  const reasons = [];
  const handle = extractHandleFromInstagramUrl(url);
  const handleNorm = normalizeCompareText(handle);

  const brand = brandMatchScore(`${title} ${snippet} ${handle}`, brandTokens);
  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  if (handleNorm && brandTokens.some((t) => handleNorm.includes(normalizeCompareText(t)))) {
    score += 22;
    reasons.push("brand-in-handle:22");
  }

  const official = officialHintScore(`${title} ${snippet}`);
  score += official;
  if (official > 0) reasons.push(`official:${official}`);

  if (domain === "instagram.com") {
    score += 8;
    reasons.push("insta-domain:8");
  }

  const penalty = noisePenalty(`${title} ${snippet} ${handle}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  if (containsAny(title, ["reel", "릴스", "게시물", "post"])) {
    score -= 20;
    reasons.push("post-like:-20");
  }

  score = clamp(score, 0, 100);
  return {
    score,
    reason: reasons.join(", "),
  };
}

function computeNaverStoreCandidateScore(item, brandTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const mallName = stripHtml(item.mallName || "");
  const productName = stripHtml(item.productName || "");
  const domain = extractDomain(url);

  let score = 0;
  const reasons = [];

  const brand = brandMatchScore(`${title} ${snippet} ${mallName} ${productName}`, brandTokens);
  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  if (looksLikeNaverStoreUrl(url)) {
    score += 22;
    reasons.push("naver-store-url:22");
  }

  if (containsAny(`${title} ${mallName}`, ["공식", "브랜드스토어", "brand store", "official"])) {
    score += 20;
    reasons.push("official-store:20");
  }

  if (mallName && brandTokens.some((t) => normalizeCompareText(mallName).includes(normalizeCompareText(t)))) {
    score += 20;
    reasons.push("brand-in-mall:20");
  }

  if (domain === "shopping.naver.com") {
    score += 8;
    reasons.push("shopping-domain:8");
  }

  const penalty = noisePenalty(`${title} ${snippet} ${mallName} ${productName}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  score = clamp(score, 0, 100);
  return {
    score,
    reason: reasons.join(", "),
  };
}

function computeYouTubeCandidateScore(item, brandTokens = []) {
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const customUrl = safeString(item.customUrl || "");
  const country = safeString(item.country || "");
  const description = stripHtml(item.description || "");
  const subscriberCount = safeNumber(item.subscriberCount);
  const videoCount = safeNumber(item.videoCount);
  const viewCount = safeNumber(item.viewCount);

  let score = 0;
  const reasons = [];

  const brand = brandMatchScore(`${title} ${snippet} ${description} ${customUrl}`, brandTokens);
  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  const official = officialHintScore(`${title} ${snippet} ${description}`);
  score += official;
  if (official > 0) reasons.push(`official:${official}`);

  if (customUrl && brandTokens.some((t) => normalizeCompareText(customUrl).includes(normalizeCompareText(t)))) {
    score += 18;
    reasons.push("brand-in-customUrl:18");
  }

  if (subscriberCount >= 1000000) {
    score += 18;
    reasons.push("subs:18");
  } else if (subscriberCount >= 100000) {
    score += 14;
    reasons.push("subs:14");
  } else if (subscriberCount >= 10000) {
    score += 10;
    reasons.push("subs:10");
  } else if (subscriberCount >= 1000) {
    score += 4;
    reasons.push("subs:4");
  }

  if (videoCount >= 100) {
    score += 8;
    reasons.push("videos:8");
  } else if (videoCount >= 20) {
    score += 4;
    reasons.push("videos:4");
  }

  if (viewCount >= 1000000) {
    score += 8;
    reasons.push("views:8");
  }

  if (country.toUpperCase() === "KR") {
    score += 4;
    reasons.push("country:4");
  }

  const penalty = noisePenalty(`${title} ${snippet} ${description}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  if (containsAny(title, LOCATION_KEYWORDS)) {
    score -= 18;
    reasons.push("location-title:-18");
  }

  if (containsAny(title, ["아울렛", "매장", "점", "리셀", "후기"])) {
    score -= 14;
    reasons.push("store-like:-14");
  }

  if (containsAny(description, ["facebook.com/groups", "중고", "개인"])) {
    score -= 18;
    reasons.push("personal-signal:-18");
  }

  score = clamp(score, 0, 100);
  return {
    score,
    reason: reasons.join(", "),
  };
}

function registerRejectedCandidate(debug, bucket, candidate, extra = {}) {
  if (!debug?.rejectedCandidates?.[bucket]) return;
  debug.rejectedCandidates[bucket].push({
    title: candidate?.title || null,
    url: candidate?.url || null,
    score: safeNumber(candidate?.score),
    reason: candidate?.reason || null,
    ...extra,
  });
}

function chooseBestCandidate(candidates = [], bucket, debug, threshold = 70) {
  const sorted = [...toArray(candidates)].sort((a, b) => b.score - a.score);
  const top = sorted[0] || null;

  if (!top) {
    if (debug?.selectedReason) debug.selectedReason[bucket] = "후보 없음";
    return null;
  }

  for (let i = 1; i < sorted.length; i += 1) {
    registerRejectedCandidate(debug, bucket, sorted[i], { rejected: "not-top-ranked" });
  }

  if (top.score < threshold) {
    registerRejectedCandidate(debug, bucket, top, { rejected: "below-threshold" });
    if (debug?.selectedReason) {
      debug.selectedReason[bucket] = `최고점 후보가 임계치 미달(${top.score} < ${threshold})`;
    }
    return null;
  }

  if (debug?.selectedReason) {
    debug.selectedReason[bucket] = `score ${top.score}, ${top.reason || "reason 없음"}`;
  }

  return top;
}

function mapBlogItemToEvidence(item, query) {
  return {
    type: "brand-mention",
    source: "naver-blog",
    title: stripHtml(item.title || ""),
    url: normalizeUrl(item.link || item.url || ""),
    snippet: stripHtml(item.description || item.snippet || ""),
    score: 38,
    meta: {
      query,
      blogName: stripHtml(item.bloggername || item.blogName || ""),
      postDate: safeString(item.postdate || item.postDate || ""),
    },
  };
}

function mapShoppingItemToEvidence(item, query) {
  return {
    type: "store-candidate",
    source: "naver-shopping",
    title: stripHtml(item.title || item.productName || ""),
    url: normalizeUrl(item.link || item.url || ""),
    snippet: stripHtml(item.mallName || ""),
    score: 52,
    meta: {
      query,
      mallName: stripHtml(item.mallName || ""),
      brand: stripHtml(item.brand || ""),
      maker: stripHtml(item.maker || ""),
      price: safeString(item.lprice || item.price || ""),
      productId: safeString(item.productId || ""),
    },
  };
}

function mapYouTubeCandidateToEvidence(candidate) {
  return {
    type: "youtube-channel",
    source: "youtube",
    title: safeString(candidate.title),
    url: normalizeUrl(candidate.url),
    snippet: stripHtml(candidate.snippet || ""),
    score: clamp(candidate.score || 0, 0, 100),
    meta: {
      subscribers: safeNumber(candidate.subscriberCount),
      videoCount: safeNumber(candidate.videoCount),
      viewCount: safeNumber(candidate.viewCount),
    },
  };
}

function buildHomepageCandidatesFromWebResults(results = [], brandTokens = [], debug) {
  const candidates = [];

  for (const row of toArray(results)) {
    const items = toArray(row?.data?.items);
    for (const item of items) {
      const directUrl = normalizeUrl(item.link || item.url || "");
      const extracted = extractUrlsFromText(`${item.title || ""} ${item.description || ""}`);

      const urlPool = uniqBy([directUrl, ...extracted].filter(Boolean), (x) => x);

      for (const url of urlPool) {
        const scored = computeHomepageCandidateScore(
          {
            title: item.title || "",
            url,
            snippet: item.description || "",
          },
          brandTokens
        );

        if (scored.score <= 0) {
          registerRejectedCandidate(debug, "homepage", {
            title: stripHtml(item.title || ""),
            url,
            score: scored.score,
            reason: scored.reason,
          });
          continue;
        }

        candidates.push(
          buildCandidateRecord({
            type: "homepage",
            source: "naver-webkr",
            title: stripHtml(item.title || ""),
            url,
            snippet: item.description || "",
            score: scored.score,
            reason: scored.reason,
          })
        );
      }
    }
  }

  return uniqBy(candidates, (x) => cleanTrailingSlash(x.url));
}

function buildInstagramCandidatesFromWebResults(results = [], brandTokens = [], debug) {
  const candidates = [];

  for (const row of toArray(results)) {
    const items = toArray(row?.data?.items);
    for (const item of items) {
      const directUrl = normalizeUrl(item.link || item.url || "");
      const extracted = extractUrlsFromText(`${item.title || ""} ${item.description || ""}`);

      const urlPool = uniqBy([directUrl, ...extracted].filter(Boolean), (x) => x);

      for (const url of urlPool) {
        const scored = computeInstagramCandidateScore(
          {
            title: item.title || "",
            url,
            snippet: item.description || "",
          },
          brandTokens
        );

        if (scored.score <= 0) {
          registerRejectedCandidate(debug, "instagram", {
            title: stripHtml(item.title || ""),
            url,
            score: scored.score,
            reason: scored.reason,
          });
          continue;
        }

        candidates.push(
          buildCandidateRecord({
            type: "instagram",
            source: "naver-webkr",
            title: stripHtml(item.title || ""),
            url,
            snippet: item.description || "",
            score: scored.score,
            reason: scored.reason,
          })
        );
      }
    }
  }

  return uniqBy(candidates, (x) => cleanTrailingSlash(x.url));
}

function buildNaverStoreCandidatesFromShopping(results = [], brandTokens = [], debug) {
  const candidates = [];

  for (const row of toArray(results)) {
    const items = toArray(row?.data?.items);
    for (const item of items) {
      const url = normalizeUrl(item.link || item.url || "");
      const scored = computeNaverStoreCandidateScore(
        {
          title: item.title || "",
          url,
          snippet: item.category1 || "",
          mallName: item.mallName || "",
          productName: item.title || "",
        },
        brandTokens
      );

      if (scored.score <= 0) {
        registerRejectedCandidate(debug, "naverStore", {
          title: stripHtml(item.title || ""),
          url,
          score: scored.score,
          reason: scored.reason,
        });
        continue;
      }

      candidates.push(
        buildCandidateRecord({
          type: "naverStore",
          source: "naver-shopping",
          title: stripHtml(item.title || ""),
          url,
          snippet: item.mallName || "",
          score: scored.score,
          reason: scored.reason,
          meta: {
            mallName: stripHtml(item.mallName || ""),
            brand: stripHtml(item.brand || ""),
            maker: stripHtml(item.maker || ""),
            price: safeString(item.lprice || ""),
            productId: safeString(item.productId || ""),
          },
        })
      );
    }
  }

  return uniqBy(candidates, (x) => cleanTrailingSlash(x.url));
}

function buildYouTubeCandidates(searchResults = [], channelMap = {}, brandTokens = [], debug) {
  const candidates = [];

  for (const row of toArray(searchResults)) {
    const items = toArray(row?.data?.items);

    for (const item of items) {
      const channelId =
        safeString(item?.id?.channelId) ||
        safeString(item?.snippet?.channelId) ||
        safeString(item?.id);

      if (!channelId) continue;

      const channel = channelMap[channelId];
      if (!channel) {
        registerRejectedCandidate(debug, "youtube", {
          title: stripHtml(item?.snippet?.title || ""),
          url: `https://www.youtube.com/channel/${channelId}`,
          score: 0,
          reason: "channel-detail-missing",
        });
        continue;
      }

      const snippet = channel.snippet || {};
      const stats = channel.statistics || {};
      const branding = channel.brandingSettings || {};

      const candidate = {
        title: stripHtml(snippet.title || item?.snippet?.title || ""),
        url:
          snippet.customUrl
            ? `https://www.youtube.com/@${safeString(snippet.customUrl).replace(/^@/, "")}`
            : `https://www.youtube.com/channel/${channelId}`,
        snippet: stripHtml(snippet.description || item?.snippet?.description || ""),
        description: stripHtml(snippet.description || ""),
        customUrl: safeString(snippet.customUrl || ""),
        country: safeString(snippet.country || branding?.channel?.country || ""),
        subscriberCount: safeNumber(stats.subscriberCount),
        videoCount: safeNumber(stats.videoCount),
        viewCount: safeNumber(stats.viewCount),
      };

      const scored = computeYouTubeCandidateScore(candidate, brandTokens);
      candidate.score = scored.score;
      candidate.reason = scored.reason;

      if (scored.score <= 0) {
        registerRejectedCandidate(debug, "youtube", candidate);
        continue;
      }

      candidates.push(
        buildCandidateRecord({
          type: "youtube",
          source: "youtube",
          title: candidate.title,
          url: candidate.url,
          snippet: candidate.snippet,
          score: candidate.score,
          reason: candidate.reason,
          meta: {
            subscriberCount: candidate.subscriberCount,
            videoCount: candidate.videoCount,
            viewCount: candidate.viewCount,
            country: candidate.country,
            customUrl: candidate.customUrl,
          },
        })
      );
    }
  }

  return uniqBy(candidates, (x) => cleanTrailingSlash(x.url));
}

function summarizeVerifiedAsset(candidate, threshold = 85) {
  if (!candidate) {
    return {
      found: false,
      verified: false,
      confidence: "low",
      source: null,
      reason: "후보 없음",
      score: 0,
      candidateCount: 0,
      url: null,
      title: null,
    };
  }

  return {
    found: true,
    verified: candidate.score >= threshold,
    confidence: scoreToConfidence(candidate.score),
    source: candidate.source || null,
    reason: candidate.reason || null,
    score: candidate.score || 0,
    candidateCount: 1,
    url: candidate.url || null,
    title: candidate.title || null,
  };
}

function buildChannelMap(channelItems = []) {
  const map = {};
  for (const item of toArray(channelItems)) {
    const id = safeString(item.id);
    if (!id) continue;
    map[id] = item;
  }
  return map;
}

function countRegionHits(blogEvidence = [], region = "") {
  const regionText = normalizeText(region);
  if (!regionText) return 0;

  let hits = 0;
  for (const item of toArray(blogEvidence)) {
    const text = `${item.title || ""} ${item.snippet || ""}`;
    if (normalizeText(text).includes(regionText)) hits += 1;
  }
  return hits;
}

function dedupeEvidence(evidence = []) {
  return uniqBy(
    evidence.filter((x) => x && x.url),
    (x) => `${x.type || ""}::${cleanTrailingSlash(x.url || "")}`
  );
}

function sortEvidence(evidence = []) {
  return [...toArray(evidence)].sort((a, b) => {
    const scoreDiff = safeNumber(b.score) - safeNumber(a.score);
    if (scoreDiff !== 0) return scoreDiff;
    return safeString(a.title).localeCompare(safeString(b.title), "ko");
  });
}

function chooseTopBlogEvidence(results = [], limit = 6) {
  const output = [];

  for (const row of toArray(results)) {
    const query = safeString(row?.query);
    const items = toArray(row?.data?.items);
    for (const item of items) {
      output.push(mapBlogItemToEvidence(item, query));
    }
  }

  return sortEvidence(dedupeEvidence(output)).slice(0, limit);
}

function chooseTopShoppingEvidence(results = [], limit = 6) {
  const output = [];

  for (const row of toArray(results)) {
    const query = safeString(row?.query);
    const items = toArray(row?.data?.items);
    for (const item of items) {
      output.push(mapShoppingItemToEvidence(item, query));
    }
  }

  return sortEvidence(dedupeEvidence(output)).slice(0, limit);
}

function chooseTopYouTubeEvidence(candidates = [], limit = 3) {
  return sortEvidence(
    dedupeEvidence(toArray(candidates).map((x) => mapYouTubeCandidateToEvidence({
      ...x,
      subscriberCount: x?.meta?.subscriberCount,
      videoCount: x?.meta?.videoCount,
      viewCount: x?.meta?.viewCount,
    })))
  ).slice(0, limit);
}

function makeDiscoverySkeleton() {
  return {
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
    verified: makeVerified(),
    pageSpeed: {
      ok: false,
      error: "not-run",
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
    sourceStatus: makeSourceStatus(),
    rawCount: makeRawCount(),
  };
}

function applySelectedAsset(discovery, key, candidate, verifiedSummary) {
  if (!candidate) {
    discovery.assets[key] = null;
    discovery.assetDetails[key] = null;
    discovery.verified[key] = {
      ...discovery.verified[key],
      ...verifiedSummary,
      candidateCount: 0,
    };
    return;
  }

  discovery.assets[key] = candidate.url || null;
  discovery.assetDetails[key] = makeAssetDetail({
    title: candidate.title || null,
    url: candidate.url || null,
    source: candidate.source || null,
    confidence: scoreToConfidence(candidate.score || 0),
    snippet: candidate.snippet || "",
    meta:
      key === "youtube"
        ? {
            subscribers: safeNumber(candidate?.meta?.subscriberCount),
            videoCount: safeNumber(candidate?.meta?.videoCount),
            viewCount: safeNumber(candidate?.meta?.viewCount),
          }
        : key === "naverStore"
          ? {
              mallName: safeString(candidate?.meta?.mallName),
              brand: safeString(candidate?.meta?.brand),
              maker: safeString(candidate?.meta?.maker),
              price: safeString(candidate?.meta?.price),
            }
          : {},
  });

  discovery.verified[key] = {
    ...discovery.verified[key],
    ...verifiedSummary,
  };
}

function computeDiscoveryFromSearchResults({
  input,
  blogResults,
  shoppingResults,
  homepageWebResults,
  instagramWebResults,
  youtubeSearchResults,
  youtubeChannelsResult,
  debug,
}) {
  const discovery = makeDiscoverySkeleton();
  const brandTokens = buildBrandTokens(input.companyName);
  const channelItems = toArray(youtubeChannelsResult?.data?.items);
  const channelMap = buildChannelMap(channelItems);

  const blogEvidence = chooseTopBlogEvidence(blogResults, 6);
  const shoppingEvidence = chooseTopShoppingEvidence(shoppingResults, 6);

  const homepageCandidates = buildHomepageCandidatesFromWebResults(
    homepageWebResults,
    brandTokens,
    debug
  );
  const instagramCandidates = buildInstagramCandidatesFromWebResults(
    instagramWebResults,
    brandTokens,
    debug
  );
  const naverStoreCandidates = buildNaverStoreCandidatesFromShopping(
    shoppingResults,
    brandTokens,
    debug
  );
  const youtubeCandidates = buildYouTubeCandidates(
    youtubeSearchResults,
    channelMap,
    brandTokens,
    debug
  );

  const selectedHomepage = chooseBestCandidate(homepageCandidates, "homepage", debug, 74);
  const selectedInstagram = chooseBestCandidate(instagramCandidates, "instagram", debug, 72);
  const selectedNaverStore = chooseBestCandidate(naverStoreCandidates, "naverStore", debug, 70);
  const selectedYoutube = chooseBestCandidate(youtubeCandidates, "youtube", debug, 84);

  const homepageVerified = summarizeVerifiedAsset(selectedHomepage, 86);
  const instagramVerified = summarizeVerifiedAsset(selectedInstagram, 86);
  const naverStoreVerified = summarizeVerifiedAsset(selectedNaverStore, 82);
  const youtubeVerified = summarizeVerifiedAsset(selectedYoutube, 90);

  homepageVerified.candidateCount = homepageCandidates.length;
  instagramVerified.candidateCount = instagramCandidates.length;
  naverStoreVerified.candidateCount = naverStoreCandidates.length;
  youtubeVerified.candidateCount = youtubeCandidates.length;

  applySelectedAsset(discovery, "homepage", selectedHomepage, homepageVerified);
  applySelectedAsset(discovery, "instagram", selectedInstagram, instagramVerified);
  applySelectedAsset(discovery, "naverStore", selectedNaverStore, naverStoreVerified);
  applySelectedAsset(discovery, "youtube", selectedYoutube, youtubeVerified);

  discovery.verified.map = {
    ...discovery.verified.map,
    found: false,
    verified: false,
    confidence: "low",
    source: null,
    reason: "지도 연동 전",
    score: 0,
    candidateCount: 0,
    url: null,
    title: null,
  };

  const topYoutubeEvidence = chooseTopYouTubeEvidence(youtubeCandidates, 3);

  const evidence = sortEvidence(
    dedupeEvidence([
      ...topYoutubeEvidence,
      ...shoppingEvidence,
      ...blogEvidence,
    ])
  );
  const verifiedAssetCount = [
    discovery.verified.homepage?.verified,
    discovery.verified.instagram?.verified,
    discovery.verified.youtube?.verified,
    discovery.verified.naverStore?.verified,
    discovery.verified.map?.verified,
  ].filter(Boolean).length;

  discovery.counts.naverBlogItems = sumResultItems(blogResults);
  discovery.counts.naverShoppingItems = sumResultItems(shoppingResults);
  discovery.counts.naverWebHomepageItems = sumResultItems(homepageWebResults);
  discovery.counts.naverWebInstagramItems = sumResultItems(instagramWebResults);
  discovery.counts.youtubeItems = youtubeCandidates.length;
  discovery.counts.regionHits = countRegionHits(blogEvidence, input.region);
  discovery.counts.assetCount = [
    discovery.assets.homepage,
    discovery.assets.instagram,
    discovery.assets.youtube,
    discovery.assets.naverStore,
    discovery.assets.map,
  ].filter(Boolean).length;
  discovery.counts.verifiedAssetCount = verifiedAssetCount;

  discovery.rawCount.naverBlogFetched = sumResultItems(blogResults);
  discovery.rawCount.naverShoppingFetched = sumResultItems(shoppingResults);
  discovery.rawCount.naverWebHomepageFetched = sumResultItems(homepageWebResults);
  discovery.rawCount.naverWebInstagramFetched = sumResultItems(instagramWebResults);
  discovery.rawCount.youtubeSearchFetched = sumResultItems(youtubeSearchResults);
  discovery.rawCount.youtubeChannelFetched = channelItems.length;
  discovery.rawCount.evidenceBuilt = evidence.length;
  discovery.rawCount.verifiedAssets = verifiedAssetCount;

  discovery.sourceStatus.naverBlog = buildAggregateSourceStatus(blogResults, {
    verified: false,
  });
  discovery.sourceStatus.naverShopping = buildAggregateSourceStatus(shoppingResults, {
    verified: discovery.verified.naverStore?.verified || false,
  });
  discovery.sourceStatus.naverWebHomepage = buildAggregateSourceStatus(homepageWebResults, {
    verified: discovery.verified.homepage?.verified || false,
  });
  discovery.sourceStatus.naverWebInstagram = buildAggregateSourceStatus(instagramWebResults, {
    verified: discovery.verified.instagram?.verified || false,
  });
  discovery.sourceStatus.youtube = buildYouTubeSourceStatus(
    youtubeSearchResults,
    youtubeChannelsResult,
    youtubeCandidates.length,
    discovery.verified.youtube?.verified || false
  );

  return {
    discovery,
    evidence,
    candidates: {
      homepage: homepageCandidates,
      instagram: instagramCandidates,
      naverStore: naverStoreCandidates,
      youtube: youtubeCandidates,
    },
  };
}

function sumResultItems(rows = []) {
  return toArray(rows).reduce((acc, row) => {
    return acc + toArray(row?.data?.items).length;
  }, 0);
}

function sumResultTotals(rows = []) {
  return toArray(rows).reduce((acc, row) => {
    return acc + safeNumber(row?.data?.total);
  }, 0);
}

function collectResultErrors(rows = []) {
  const errors = [];

  for (const row of toArray(rows)) {
    const dataError =
      row?.data?.errorMessage ||
      row?.data?.error?.message ||
      row?.data?.message ||
      null;

    const textError =
      !row?.ok && row?.text
        ? safeString(row.text).slice(0, 200)
        : null;

    const error = row?.error || dataError || textError;
    if (error) errors.push(safeString(error));
  }

  return uniqBy(errors.filter(Boolean), (x) => x);
}

function buildAggregateSourceStatus(rows = [], overrides = {}) {
  const list = toArray(rows);
  const statuses = list.map((x) => x?.status).filter((x) => x !== null && x !== undefined);
  const rawItems = sumResultItems(list);
  const total = sumResultTotals(list);
  const errors = collectResultErrors(list);
  const fetchOk = list.length > 0 && list.every((x) => !!x?.ok);
  const parseOk = list.length > 0 && list.every((x) => x?.data !== null && x?.data !== undefined);
  const candidateFound = rawItems > 0;

  return {
    fetchOk,
    parseOk,
    candidateFound,
    verified: !!overrides.verified,
    total,
    rawItems,
    status: statuses.length ? statuses[0] : null,
    error: errors[0] || null,
    errorCount: errors.length,
  };
}

function buildYouTubeSourceStatus(searchRows = [], channelsResult = null, candidateCount = 0, verified = false) {
  const searchList = toArray(searchRows);
  const searchErrors = collectResultErrors(searchList);
  const searchStatuses = searchList
    .map((x) => x?.status)
    .filter((x) => x !== null && x !== undefined);

  const channelItems = toArray(channelsResult?.data?.items);
  const channelError =
    channelsResult?.error ||
    channelsResult?.data?.error?.message ||
    channelsResult?.data?.errorMessage ||
    null;

  const fetchOk =
    searchList.length > 0 &&
    searchList.every((x) => !!x?.ok) &&
    !!channelsResult?.ok;

  const parseOk =
    searchList.length > 0 &&
    searchList.every((x) => x?.data !== null && x?.data !== undefined) &&
    channelsResult?.data !== null &&
    channelsResult?.data !== undefined;

  const errors = uniqBy(
    [...searchErrors, ...(channelError ? [safeString(channelError)] : [])].filter(Boolean),
    (x) => x
  );

  return {
    fetchOk,
    parseOk,
    candidateFound: candidateCount > 0,
    verified: !!verified,
    total: sumResultItems(searchList),
    rawItems: sumResultItems(searchList),
    status: searchStatuses[0] || channelsResult?.status || null,
    error: errors[0] || null,
    errorCount: errors.length,
  };
}

async function fetchPageSpeedSummary(targetUrl, debug) {
  const apiKey = env("PAGESPEED_API_KEY");
  if (!targetUrl) {
    return {
      ok: false,
      status: null,
      error: "homepage missing",
      summary: null,
      source: "pagespeed",
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      status: null,
      error: "pagespeed api key missing",
      summary: null,
      source: "pagespeed",
    };
  }

  const url =
    `${PAGESPEED_API}?url=${encodeURIComponent(targetUrl)}` +
    `&strategy=mobile` +
    `&key=${encodeURIComponent(apiKey)}`;

  pushRequestLog(debug, {
    source: "pagespeed",
    url,
    targetUrl,
  });

  const result = await fetchJsonWithTimeout(url, {}, 20000);

  if (!result.ok || !result.data) {
    return {
      ok: false,
      status: result.status,
      error:
        result.error ||
        result?.data?.error?.message ||
        "pagespeed fetch failed",
      summary: null,
      source: "pagespeed",
    };
  }

  const lighthouse = result.data?.lighthouseResult || {};
  const categories = lighthouse?.categories || {};
  const audits = lighthouse?.audits || {};

  const performanceScore = safeNumber(categories?.performance?.score) * 100;
  const accessibilityScore = safeNumber(categories?.accessibility?.score) * 100;
  const bestPracticesScore = safeNumber(categories?.["best-practices"]?.score) * 100;
  const seoScore = safeNumber(categories?.seo?.score) * 100;

  return {
    ok: true,
    status: result.status,
    error: null,
    source: "pagespeed",
    summary: {
      performanceScore: Math.round(performanceScore),
      accessibilityScore: Math.round(accessibilityScore),
      bestPracticesScore: Math.round(bestPracticesScore),
      seoScore: Math.round(seoScore),
      firstContentfulPaint: safeString(audits?.["first-contentful-paint"]?.displayValue),
      largestContentfulPaint: safeString(audits?.["largest-contentful-paint"]?.displayValue),
      speedIndex: safeString(audits?.["speed-index"]?.displayValue),
      totalBlockingTime: safeString(audits?.["total-blocking-time"]?.displayValue),
      cumulativeLayoutShift: safeString(audits?.["cumulative-layout-shift"]?.displayValue),
    },
  };
}

function computeSearchVisibility(discovery) {
  let score = 0;

  const blogTotal = safeNumber(discovery?.sourceStatus?.naverBlog?.total);
  const shoppingRaw = safeNumber(discovery?.sourceStatus?.naverShopping?.rawItems);

  if (blogTotal > 0) score += clamp(Math.round(Math.log10(blogTotal + 1) * 10), 8, 30);
  if (shoppingRaw > 0) score += clamp(shoppingRaw * 3, 0, 18);

  if (discovery?.verified?.homepage?.found) score += 10;
  if (discovery?.verified?.homepage?.verified) score += 16;

  if (discovery?.verified?.instagram?.found) score += 6;
  if (discovery?.verified?.instagram?.verified) score += 10;

  if (discovery?.verified?.naverStore?.found) score += 8;
  if (discovery?.verified?.naverStore?.verified) score += 12;

  return clamp(Math.round(score), 0, 100);
}

function computeContentPresence(discovery, evidence) {
  let score = 0;

  if (discovery?.verified?.youtube?.found) score += 20;
  if (discovery?.verified?.youtube?.verified) score += 30;

  const youtubeEvidenceCount = toArray(evidence).filter((x) => x?.type === "youtube-channel").length;
  const blogEvidenceCount = toArray(evidence).filter((x) => x?.type === "brand-mention").length;

  score += clamp(youtubeEvidenceCount * 10, 0, 20);
  score += clamp(blogEvidenceCount * 3, 0, 18);

  return clamp(Math.round(score), 0, 100);
}

function computeLocalExposure(discovery) {
  let score = 0;
  score += clamp(safeNumber(discovery?.counts?.regionHits) * 12, 0, 48);

  if (discovery?.verified?.naverStore?.found) score += 16;
  if (discovery?.verified?.map?.found) score += 12;
  if (discovery?.verified?.map?.verified) score += 12;

  return clamp(Math.round(score), 0, 100);
}

function computeWebQuality(discovery) {
  if (discovery?.pageSpeed?.ok && discovery?.pageSpeed?.performanceScore >= 0) {
    return clamp(Math.round(safeNumber(discovery.pageSpeed.performanceScore)), 0, 100);
  }

  if (discovery?.verified?.homepage?.verified) return 28;
  if (discovery?.verified?.homepage?.found) return 14;
  return 0;
}

function buildConfidence(discovery) {
  const verifiedAssetCount = safeNumber(discovery?.counts?.verifiedAssetCount);
  const failedSources = Object.values(discovery?.sourceStatus || {}).filter((x) => {
    if (!x) return false;
    if (x.error === "homepage missing") return false;
    return x.fetchOk === false || safeNumber(x.errorCount) > 0;
  }).length;

  if (verifiedAssetCount >= 3 && failedSources === 0) {
    return {
      label: "높음",
      description: "검증된 공식 자산이 복수 확인되어 1차 진단 신뢰도가 높습니다.",
    };
  }

  if (verifiedAssetCount >= 1 && failedSources <= 1) {
    return {
      label: "보통",
      description: "일부 자산은 확인되었지만 공식성 검증 또는 추가 소스 보강이 더 필요합니다.",
    };
  }

  if (failedSources >= 2) {
    return {
      label: "매우 낮음",
      description: "외부 소스 실패가 다수 발생해 현재 결과는 참고용 초기 탐색 수준입니다.",
    };
  }

  return {
    label: "낮음",
    description: "브랜드 언급은 있으나 공식 자산 검증 수가 적어 현재 결과는 후보 탐색에 가깝습니다.",
  };
}

function buildExecutiveSummary(input, discovery) {
  const company = safeString(input.companyName) || "해당 업체";
  const verifiedCount = safeNumber(discovery?.counts?.verifiedAssetCount);
  const homepageFound = !!discovery?.verified?.homepage?.found;
  const youtubeVerified = !!discovery?.verified?.youtube?.verified;
  const shoppingFailed = discovery?.sourceStatus?.naverShopping?.fetchOk === false;
  const instagramFound = !!discovery?.verified?.instagram?.found;

  if (verifiedCount >= 3) {
    return `${company}은(는) 공식 자산 식별이 비교적 안정적으로 이루어졌으며, 이제는 채널 운영 밀도와 전환 효율을 높이는 단계에 가깝습니다.`;
  }

  if (!homepageFound && shoppingFailed) {
    return `${company}은(는) 일부 언급 신호는 있으나 공식 홈페이지 식별과 NAVER Shopping 수집이 동시에 약해 현재 결과는 초기 후보 탐색 수준에 가깝습니다.`;
  }

  if (youtubeVerified && !instagramFound) {
    return `${company}은(는) 영상 자산 신호는 보이나, 검색-소셜-전환을 잇는 대표 자산 식별은 아직 더 보강이 필요합니다.`;
  }

  return `${company}은(는) 검색 흔적은 일부 확인되지만 공식 자산 검증 수가 적어 브랜드 검색 동선이 아직 분산되어 보일 수 있습니다.`;
}

function buildWins(discovery, evidence) {
  const wins = [];

  if (discovery?.verified?.youtube?.verified) {
    wins.push("공식성 높은 YouTube 채널 후보가 확인되어 영상 자산 운영 기반이 있습니다.");
  } else if (discovery?.verified?.youtube?.found) {
    wins.push("YouTube 채널 후보가 존재해 영상 기반 확장 가능성은 확인됩니다.");
  }

  if (safeNumber(discovery?.sourceStatus?.naverBlog?.total) > 0) {
    wins.push("네이버 블로그 상의 브랜드 언급량이 존재해 검색형 콘텐츠 수요 신호는 확인됩니다.");
  }

  if (discovery?.verified?.homepage?.verified) {
    wins.push("대표 홈페이지 후보가 확인되어 검색 유입을 한 곳으로 모을 기반이 있습니다.");
  }

  if (discovery?.pageSpeed?.ok && safeNumber(discovery?.pageSpeed?.performanceScore) >= 70) {
    wins.push("대표 페이지의 PageSpeed 성능 점수가 양호해 전환 환경 기반이 나쁘지 않습니다.");
  }

  if (wins.length === 0 && toArray(evidence).length > 0) {
    wins.push("브랜드 관련 외부 신호는 일부 수집되어 추가 정제 시 자산 확정 가능성이 있습니다.");
  }

  return wins.slice(0, 4);
}

function buildRisks(discovery) {
  const risks = [];

  if (!discovery?.verified?.homepage?.verified) {
    risks.push("공식 홈페이지 또는 대표 랜딩이 검증되지 않아 브랜드 검색 유입이 외부 플랫폼에 분산될 수 있습니다.");
  }

  if (!discovery?.verified?.instagram?.verified) {
    risks.push("Instagram 공식 계정 식별이 되지 않아 검색 이후 소셜 신뢰 형성이 약할 수 있습니다.");
  }

  if (discovery?.sourceStatus?.naverShopping?.fetchOk === false) {
    risks.push("NAVER Shopping 수집 실패가 있어 스토어 존재 여부 판단이 현재 결과에서 과소평가되었을 수 있습니다.");
  } else if (!discovery?.verified?.naverStore?.found) {
    risks.push("NAVER Shopping 상 공식 스토어 단서가 약하면 구매 전환 동선이 경쟁 판매자에게 분산될 수 있습니다.");
  }

  if (discovery?.verified?.youtube?.found && !discovery?.verified?.youtube?.verified) {
    risks.push("YouTube 채널 후보는 있으나 공식성 검증이 충분치 않아 오탐 가능성이 있습니다.");
  }

  if (discovery?.pageSpeed?.ok && safeNumber(discovery?.pageSpeed?.performanceScore) < 50) {
    risks.push("대표 페이지 속도 점수가 낮아 유입 대비 이탈률이 높아질 수 있습니다.");
  }

  return risks.slice(0, 5);
}

function buildNextActions(input, discovery) {
  const actions = [];
  const industry = normalizeText(input?.industry);

  if (!discovery?.verified?.homepage?.verified) {
    actions.push("브랜드 검색 시 가장 먼저 도달해야 할 대표 홈페이지 또는 단일 랜딩 1개를 확정하고, 브랜드명 검색 시 동일 URL이 반복 노출되도록 모든 채널 링크를 통일하세요.");
  }

  if (!discovery?.verified?.instagram?.verified) {
    actions.push("Instagram은 브랜드명과 최대한 일치하는 핸들로 통일하고, 프로필 링크를 대표 랜딩 1개로 고정한 뒤 주 3회 이상 제품/캠페인/사용장면 중심 포맷으로 8주 이상 누적 운영하세요.");
  }

  if (!discovery?.verified?.youtube?.verified) {
    actions.push("YouTube는 브랜드명 정확 일치 채널명과 설명란 공식 URL 삽입을 우선 적용하고, Shorts 기준 주 2회 이상 업로드로 브랜드 검색 보조 채널로 육성하세요.");
  }

  if (discovery?.sourceStatus?.naverShopping?.fetchOk === false) {
    actions.push("NAVER Shopping 연동 오류를 먼저 복구해 스토어 존재 여부를 재확인하고, 브랜드스토어/공식몰/정품 키워드 정합성을 점검하세요.");
  }

  if (industry.includes("ecommerce") || industry.includes("쇼핑")) {
    actions.push("이커머스 업종이라면 검색광고는 브랜드 키워드 방어형으로 먼저 집행하고, 이후 리타게팅·상품피드 광고를 순차 확대하는 구조가 효율적입니다.");
    actions.push("오프라인 접점이 있다면 매장/행사 반경 중심의 버스쉘터·리플렛·POP보다, 온라인 전환 가능한 QR 랜딩 중심 집행이 더 적합합니다.");
  } else {
    actions.push("블로그는 주 2회 이상 고객 문제 해결형 글을 8주 이상 누적해 검색 지면에서 반복 노출되는 주제를 먼저 확보하세요.");
  }

  return actions.slice(0, 6);
}

function buildLimits() {
  return [
    "현재는 NAVER Blog + NAVER Shopping + NAVER WebKR + YouTube + PageSpeed 기반 진단입니다.",
    "Instagram / 홈페이지 후보는 웹 검색 기반 후보 판정이므로 추가 검증이 필요할 수 있습니다.",
    "지도 자산은 아직 연결되지 않았습니다.",
    "Gemini 문장 보정 없이 결정론적 규칙 기반으로 우선 진단합니다.",
  ];
}

function buildDiagnosis(input, discovery, evidence) {
  const searchVisibility = computeSearchVisibility(discovery);
  const contentPresence = computeContentPresence(discovery, evidence);
  const localExposure = computeLocalExposure(discovery);
  const webQuality = computeWebQuality(discovery);

  const overall = clamp(
    Math.round(
      searchVisibility * 0.34 +
      contentPresence * 0.24 +
      localExposure * 0.17 +
      webQuality * 0.25
    ),
    0,
    100
  );

  const confidence = buildConfidence(discovery);

  return {
    industryLabel: safeString(input.industry),
    confidence: confidence.label,
    confidenceDescription: confidence.description,
    executiveSummary: buildExecutiveSummary(input, discovery),
    scores: {
      overall,
      searchVisibility,
      contentPresence,
      localExposure,
      webQuality,
    },
    wins: buildWins(discovery, evidence),
    risks: buildRisks(discovery),
    nextActions: buildNextActions(input, discovery),
    limits: buildLimits(),
  };
}

function buildPrescription(input, discovery, diagnosis) {
  const verifiedCount = safeNumber(discovery?.counts?.verifiedAssetCount);

  let stage = {
    code: "foundation",
    title: "기초 자산 복구 단계",
    description: "공식 자산을 먼저 명확히 확정하고 검색·소셜·스토어 동선을 한 방향으로 정렬해야 하는 단계입니다.",
  };

  if (verifiedCount >= 3 || safeNumber(diagnosis?.scores?.overall) >= 70) {
    stage = {
      code: "acceleration",
      title: "확장 운영 단계",
      description: "기초 자산은 어느 정도 갖춰졌으며 채널별 운영 밀도와 광고 효율을 고도화해야 하는 단계입니다.",
    };
  } else if (verifiedCount >= 1 || safeNumber(diagnosis?.scores?.overall) >= 45) {
    stage = {
      code: "traction",
      title: "검색 접점 정교화 단계",
      description: "일부 채널은 잡히지만 공식성·전환성·반복 노출 구조를 더 촘촘히 만들 필요가 있는 단계입니다.",
    };
  }

  const priorityChannels = [];
  if (!discovery?.verified?.homepage?.verified) priorityChannels.push("대표 랜딩");
  if (!discovery?.verified?.instagram?.verified) priorityChannels.push("Instagram");
  if (!discovery?.verified?.naverStore?.verified) priorityChannels.push("NAVER Shopping/스토어");
  if (!discovery?.verified?.youtube?.verified) priorityChannels.push("YouTube/Shorts");
  if (priorityChannels.length === 0) {
    priorityChannels.push("대표 랜딩", "검색광고", "리타게팅", "콘텐츠 자동화");
  }

  const thirtyDayPlan = [
    {
      week: "1주차",
      action: "브랜드 자산 기준 URL 1개 확정",
      detail: "홈페이지, 인스타그램, 유튜브, 스마트스토어의 프로필/소개란/고정링크를 하나의 대표 랜딩으로 통일하고 UTM 규칙을 적용합니다.",
    },
    {
      week: "2주차",
      action: "브랜드 검색 방어 세팅",
      detail: "브랜드명·브랜드명 공식·브랜드명 스토어 키워드 중심으로 검색광고를 소액 집행하고, 검색 결과 상단에서 경쟁 전환 분산을 차단합니다.",
    },
    {
      week: "3주차",
      action: "콘텐츠 운영 리듬 고정",
      detail: "블로그 주 2회, Instagram 주 3회, Shorts 주 2회 기준으로 4주 분량 캘린더를 확정하고 제품/사용장면/비교/후기 포맷을 반복합니다.",
    },
    {
      week: "4주차",
      action: "전환 지표 첫 점검",
      detail: "브랜드 검색량, 랜딩 클릭률, 인스타 프로필 방문, 쇼츠 조회-클릭 전환, 장바구니/문의 유입을 기준으로 다음 달 확대 예산을 결정합니다.",
    },
  ];

  const ninetyDayPlan = [
    {
      period: "1~4주",
      focus: "공식 자산 정렬",
      deliverables: [
        "대표 랜딩 확정",
        "채널별 소개문구 통일",
        "콘텐츠 캘린더 4주 확보",
      ],
    },
    {
      period: "5~8주",
      focus: "반복 노출 확보",
      deliverables: [
        "블로그 8개 이상",
        "Instagram 12개 이상",
        "Shorts 8개 이상",
        "브랜드 검색광고 안정화",
      ],
    },
    {
      period: "9~12주",
      focus: "성과 증폭",
      deliverables: [
        "반응 좋은 포맷 재활용",
        "리타게팅/피드광고 확대",
        "오프라인 QR 유입 테스트",
        "전환 KPI 기준선 확정",
      ],
    },
  ];

  const channelGuides = {
    blog: {
      frequency: "주 2회",
      pattern: "고객 질문형 제목 → 해결 방법 → 제품/서비스 연결 → CTA",
      duration: "최소 8주",
      target: "브랜드명 검색 외 일반 문제 해결 키워드 유입 확보",
    },
    instagram: {
      frequency: "주 3회 + 스토리 상시",
      pattern: "제품 컷 1회, 사용장면 1회, 사회적 증거/후기 1회",
      duration: "최소 8주",
      target: "프로필 방문 대비 링크 클릭률 2~5% 이상, 저장/공유 중심 반응 확보",
    },
    youtubeShorts: {
      frequency: "주 2회",
      pattern: "첫 2초 후킹 → 제품 장면/효익 → CTA 자막",
      duration: "최소 8주",
      target: "브랜드 검색 보조와 제품 이해도 상승",
    },
  };

  const adPlan = [
    "1단계: 브랜드 키워드 방어형 검색광고 우선 집행",
    "2단계: 사이트 방문자/영상 조회자 대상 리타게팅 광고 확장",
    "3단계: 제품 피드 또는 베스트셀러 중심 전환형 광고 집행",
  ];

  const offlinePlan = [
    "오프라인 매장/행사 접점이 있으면 QR 포함 전단·배너·POP를 대표 랜딩과 연결",
    "버스 광고는 광역 인지도 예산이 충분할 때만 검토하고, 일반적으로는 지역 반경형 옥외매체보다 검색/리타게팅이 우선입니다.",
  ];

  const kpi = [
    "브랜드 검색 유입",
    "대표 랜딩 클릭률",
    "Instagram 프로필 방문→링크 클릭률",
    "Shorts 조회→채널/사이트 유입률",
    "NAVER Shopping/스토어 유입 및 전환",
  ];

  return {
    stage,
    priorityChannels,
    thirtyDayPlan,
    ninetyDayPlan,
    channelGuides,
    adPlan,
    offlinePlan,
    kpi,
  };
}

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    error: message,
    ...extra,
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "rewrite-v2",
    });
  }

  if (req.method !== "POST") {
    return jsonError(res, 405, "Method Not Allowed", {
      allowedMethods: ["GET", "POST"],
    });
  }

  try {
    const body = req.body || {};
    const input = {
      companyName: safeString(body.companyName),
      industry: safeString(body.industry),
      region: safeString(body.region),
      email: safeString(body.email),
    };

    if (!input.companyName) {
      return jsonError(res, 400, "companyName is required", { input });
    }

    const debug = makeDebug(input);
    const queries = buildQuerySet(input);
    debug.queries = queries;

    const hasNaverCreds = !!env("NAVER_CLIENT_ID") && !!env("NAVER_CLIENT_SECRET");
    const hasYoutubeKey = !!env("YOUTUBE_API_KEY");

    let blogResults = [];
    let shoppingResults = [];
    let homepageWebResults = [];
    let instagramWebResults = [];
    let youtubeSearchResults = [];
    let youtubeChannelsResult = {
      ok: true,
      status: 200,
      data: { items: [] },
      text: '{"items":[]}',
      error: null,
      source: "youtube-channels",
    };

    if (hasNaverCreds) {
      const [
        blogFetched,
        shoppingFetched,
        homepageFetched,
        instagramFetched,
      ] = await Promise.all([
        Promise.all(
          queries.blog.map((query) =>
            fetchNaverSearch({
              endpoint: NAVER_BLOG_API,
              query,
              display: 10,
              sort: "sim",
              debug,
              sourceLabel: "naver-blog",
            })
          )
        ),
        Promise.all(
          queries.shopping.map((query) =>
            fetchNaverSearch({
              endpoint: NAVER_SHOPPING_API,
              query,
              display: 10,
              sort: "sim",
              debug,
              sourceLabel: "naver-shopping",
            })
          )
        ),
        Promise.all(
          queries.homepage.map((query) =>
            fetchNaverSearch({
              endpoint: NAVER_WEBKR_API,
              query,
              display: 10,
              sort: "sim",
              debug,
              sourceLabel: "naver-web-homepage",
            })
          )
        ),
        Promise.all(
          queries.instagram.map((query) =>
            fetchNaverSearch({
              endpoint: NAVER_WEBKR_API,
              query,
              display: 10,
              sort: "sim",
              debug,
              sourceLabel: "naver-web-instagram",
            })
          )
        ),
      ]);

      blogResults = blogFetched;
      shoppingResults = shoppingFetched;
      homepageWebResults = homepageFetched;
      instagramWebResults = instagramFetched;
    } else {
      pushRequestLog(debug, {
        source: "naver",
        skipped: true,
        reason: "missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET",
      });
    }

    if (hasYoutubeKey) {
      youtubeSearchResults = await Promise.all(
        queries.youtube.map((query) =>
          fetchYouTubeSearch({
            query,
            maxResults: 8,
            type: "channel",
            debug,
          })
        )
      );

      const channelIds = uniqBy(
        youtubeSearchResults.flatMap((row) =>
          toArray(row?.data?.items).map((item) => {
            return (
              safeString(item?.id?.channelId) ||
              safeString(item?.snippet?.channelId) ||
              safeString(item?.id)
            );
          })
        ).filter(Boolean),
        (x) => x
      );

      youtubeChannelsResult = await fetchYouTubeChannels(channelIds, debug);
    } else {
      pushRequestLog(debug, {
        source: "youtube",
        skipped: true,
        reason: "missing YOUTUBE_API_KEY",
      });
    }

    const computed = computeDiscoveryFromSearchResults({
      input,
      blogResults,
      shoppingResults,
      homepageWebResults,
      instagramWebResults,
      youtubeSearchResults,
      youtubeChannelsResult,
      debug,
    });

    const discovery = computed.discovery;
    const evidence = computed.evidence;

    if (discovery?.assets?.homepage) {
      const pageSpeed = await fetchPageSpeedSummary(discovery.assets.homepage, debug);

      discovery.pageSpeed = pageSpeed.ok
        ? {
            ok: true,
            ...pageSpeed.summary,
          }
        : {
            ok: false,
            error: pageSpeed.error || "pagespeed failed",
          };

      discovery.sourceStatus.pageSpeed = {
        fetchOk: !!pageSpeed.ok,
        parseOk: !!pageSpeed.ok && !!pageSpeed.summary,
        candidateFound: !!discovery.assets.homepage,
        verified: !!pageSpeed.ok,
        total: pageSpeed.ok ? 1 : 0,
        rawItems: pageSpeed.ok ? 1 : 0,
        status: pageSpeed.status || null,
        error: pageSpeed.error || null,
        errorCount: pageSpeed.error ? 1 : 0,
      };
    } else {
      discovery.pageSpeed = {
        ok: false,
        error: "homepage missing",
      };
      discovery.sourceStatus.pageSpeed = {
        fetchOk: false,
        parseOk: false,
        candidateFound: false,
        verified: false,
        total: 0,
        rawItems: 0,
        status: null,
        error: "homepage missing",
        errorCount: 1,
      };
    }

    const diagnosis = buildDiagnosis(input, discovery, evidence);
    const prescription = buildPrescription(input, discovery, diagnosis);

    return res.status(200).json({
      ok: true,
      input,
      discovery,
      diagnosis,
      evidence,
      prescription,
      debug,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "internal server error",
      stack:
        process.env.NODE_ENV !== "production"
          ? safeString(error?.stack)
          : undefined,
    });
  }
}

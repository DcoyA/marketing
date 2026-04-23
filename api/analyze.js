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
const NAVER_QUERY_DELAY_MS = 220;

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
];

const OFFICIAL_KEYWORDS = [
  "공식",
  "official",
  "브랜드스토어",
  "brand store",
  "코리아",
  "korea",
  "대한민국",
];

const REJECT_INSTAGRAM_PATH_KEYWORDS = [
  "/p/",
  "/reel/",
  "/reels/",
  "/stories/",
  "/tv/",
  "/explore/",
];

const ALIAS_STRIP_WORDS = [
  "official",
  "korea",
  "korean",
  "kr",
  "shop",
  "mall",
  "store",
  "brand",
  "global",
  "kurlymall",
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

function safeUrlObject(inputUrl = "") {
  try {
    return new URL(inputUrl);
  } catch {
    return null;
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

function extractDomain(inputUrl = "") {
  try {
    const u = new URL(inputUrl);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function extractPathname(inputUrl = "") {
  const u = safeUrlObject(inputUrl);
  return u ? u.pathname || "/" : "";
}

function cleanTrailingSlash(inputUrl = "") {
  if (!inputUrl) return "";
  return inputUrl.replace(/\/+$/, "");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRegistrableDomain(domain = "") {
  const d = safeString(domain).toLowerCase().replace(/^www\./, "");
  if (!d) return "";

  const parts = d.split(".");
  if (parts.length <= 2) return d;

  const last2 = parts.slice(-2).join(".");
  const last3 = parts.slice(-3).join(".");

  if (["co.kr", "or.kr", "ne.kr", "go.kr", "ac.kr"].includes(last2)) {
    return last3;
  }

  return last2;
}

function getPrimaryDomainLabel(domain = "") {
  const registrable = getRegistrableDomain(domain);
  if (!registrable) return "";

  const parts = registrable.split(".");
  if (parts.length >= 2) return parts[0];
  return registrable;
}

function buildHomepageOriginFromUrl(inputUrl = "") {
  const domain = extractDomain(inputUrl);
  if (!domain) return "";

  const registrable = getRegistrableDomain(domain);
  if (!registrable) return "";

  return `https://${registrable}/`;
}

function tokenizeLooseText(input = "") {
  return normalizeSpace(stripHtml(input))
    .split(/[\s/(),.&|_-]+/)
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .filter((x) => x.length >= 2);
}

function normalizeAliasToken(input = "") {
  let t = normalizeCompareText(input);
  if (!t) return "";

  for (const word of ALIAS_STRIP_WORDS) {
    t = t.replace(new RegExp(word, "g"), "");
  }

  t = t.replace(/[_\-./]/g, "");
  t = t.replace(/official$/g, "");
  t = t.replace(/^official/g, "");
  return t.trim();
}

function buildBrandTokens(companyName = "") {
  const raw = normalizeSpace(companyName);
  const normalized = normalizeText(companyName);
  const compact = normalizeCompareText(companyName);

  const tokens = raw
    .split(/[\s/(),.&-]+/)
    .map((x) => normalizeText(x))
    .filter(Boolean)
    .filter((x) => x.length >= 2);

  const output = uniqBy(
    [
      raw,
      normalized,
      compact,
      ...tokens,
      raw.replace(/\s+/g, ""),
      normalizeAliasToken(raw),
      normalizeAliasToken(compact),
    ]
      .map((x) => normalizeText(x))
      .filter(Boolean),
    (x) => x
  );

  return output;
}

function buildQuerySet(input) {
  const company = safeString(input.companyName);
  const industry = safeString(input.industry);
  const compact = company.replace(/\s+/g, "");

  return {
    blog: uniqBy(
      [
        company,
        `${company} ${industry}`,
        `${compact} 후기`,
      ].filter(Boolean),
      (x) => x
    ),
    shopping: uniqBy(
      [
        company,
        `${company} 공식`,
      ].filter(Boolean),
      (x) => x
    ),
    homepage: uniqBy(
      [
        `${company} 공식`,
        `${company} 홈페이지`,
      ].filter(Boolean),
      (x) => x
    ),
    instagram: uniqBy(
      [
        `${company} 인스타그램`,
        `${company} 공식 인스타`,
      ].filter(Boolean),
      (x) => x
    ),
    youtube: uniqBy(
      [
        company,
        `${company} 공식`,
        `${company} official`,
      ].filter(Boolean),
      (x) => x
    ),
  };
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
    stage: "rewrite-v3-final",
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
    brandTokens: {
      base: [],
      learned: [],
      final: [],
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
}) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;
  const result = await fetchJsonWithTimeout(url, {
    headers: getNaverHeaders(),
  });

  return {
    query,
    ...result,
  };
}

async function fetchNaverSearchBatchSequential({
  endpoint,
  queries = [],
  sourceLabel,
  debug,
}) {
  const results = [];
  let stopFurther = false;

  for (const query of toArray(queries)) {
    if (stopFurther) break;

    const result = await fetchNaverSearch({
      endpoint,
      query,
      display: 10,
      start: 1,
      sort: "sim",
    });

    const rawItems = toArray(result?.data?.items).length;
    const total = safeNumber(result?.data?.total);
    const error =
      result?.error ||
      result?.data?.errorMessage ||
      result?.data?.error?.message ||
      null;

    pushRequestLog(debug, {
      source: sourceLabel,
      query,
      status: result?.status,
      ok: !!result?.ok,
      rawItems,
      total,
      error,
    });

    results.push({
      query,
      source: sourceLabel,
      ...result,
    });

    if (result?.status === 429) {
      stopFurther = true;
      break;
    }

    await delay(NAVER_QUERY_DELAY_MS);
  }

  return results;
}

async function fetchYouTubeSearch({ query, maxResults = 8 }) {
  const apiKey = env("YOUTUBE_API_KEY");
  const url =
    `${YOUTUBE_SEARCH_API}?part=snippet` +
    `&q=${encodeURIComponent(query)}` +
    `&type=channel` +
    `&maxResults=${maxResults}` +
    `&key=${encodeURIComponent(apiKey)}`;

  const result = await fetchJsonWithTimeout(url);
  return {
    query,
    source: "youtube-search",
    ...result,
  };
}

async function fetchYouTubeChannels(channelIds = []) {
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

  const result = await fetchJsonWithTimeout(url);
  return {
    source: "youtube-channels",
    ...result,
  };
}

function maskDomainOnly(inputUrl = "") {
  const domain = extractDomain(inputUrl);
  return domain || null;
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

function domainBonus(domain = "") {
  if (!domain) return 0;
  if (domain.endsWith(".co.kr")) return 10;
  if (domain.endsWith(".kr")) return 8;
  if (domain.endsWith(".com")) return 6;
  if (domain.endsWith(".co")) return 4;
  return 0;
}

function noisePenalty(text = "") {
  let penalty = 0;

  if (containsAny(text, LOCATION_KEYWORDS)) penalty += 14;
  if (containsAny(text, ["후기", "리뷰", "사용기", "브이로그", "맛집", "주가", "투자", "중고"])) penalty += 16;
  if (containsAny(text, ["아울렛", "세일", "할인", "공구"])) penalty += 10;

  return clamp(penalty, 0, 40);
}

function officialHintScore(text = "") {
  const hits = countContains(text, OFFICIAL_KEYWORDS);
  return clamp(hits * 8, 0, 24);
}

function brandMatchScore(text = "", brandTokens = []) {
  const normalized = normalizeText(text);
  const compact = normalizeCompareText(text);

  let score = 0;
  let matched = 0;
  let exact = false;

  for (const token of brandTokens) {
    const tokenNorm = normalizeText(token);
    const tokenCompact = normalizeCompareText(token);
    if (!tokenNorm && !tokenCompact) continue;

    const isMatch =
      (tokenNorm && normalized.includes(tokenNorm)) ||
      (tokenCompact && compact.includes(tokenCompact));

    if (isMatch) {
      matched += 1;
      if (
        tokenCompact &&
        (compact === tokenCompact || compact.startsWith(tokenCompact) || compact.endsWith(tokenCompact))
      ) {
        exact = true;
      }

      if (tokenCompact.length >= 10) score += 22;
      else if (tokenCompact.length >= 5) score += 18;
      else if (tokenCompact.length >= 3) score += 12;
      else score += 6;
    }
  }

  return {
    score: clamp(score, 0, 60),
    matched,
    exact,
  };
}

function aliasMatchScore(text = "", aliasTokens = []) {
  const compact = normalizeCompareText(text);

  let score = 0;
  let matched = 0;
  let exact = false;

  for (const alias of aliasTokens) {
    const a = normalizeAliasToken(alias);
    if (!a) continue;

    if (compact.includes(a)) {
      matched += 1;
      score += a.length >= 8 ? 24 : a.length >= 5 ? 18 : 10;
      if (compact === a || compact.startsWith(a) || compact.endsWith(a)) {
        exact = true;
      }
    }
  }

  return {
    score: clamp(score, 0, 60),
    matched,
    exact,
  };
}

function maybeAddAlias(set, value) {
  const raw = safeString(value);
  if (!raw) return;

  const candidates = uniqBy(
    [
      raw,
      normalizeText(raw),
      normalizeCompareText(raw),
      normalizeAliasToken(raw),
      ...tokenizeLooseText(raw),
    ].filter(Boolean),
    (x) => x
  );

  for (const c of candidates) {
    const norm = normalizeAliasToken(c);
    if (!norm) continue;
    if (norm.length < 2) continue;
    if (/^\d+$/.test(norm)) continue;
    set.add(norm);
  }
}

function buildLearnedAliases({
  input,
  shoppingResults,
  homepageWebResults,
  instagramWebResults,
  youtubeChannelsResult,
  baseTokens,
}) {
  const learned = new Set();
  const company = safeString(input.companyName);
  const companyCompact = normalizeCompareText(company);

  baseTokens.forEach((t) => maybeAddAlias(learned, t));

  for (const row of toArray(shoppingResults)) {
    for (const item of toArray(row?.data?.items)) {
      const url = normalizeUrl(item.link || item.url || "");
      const domain = extractDomain(url);
      const homepageOrigin = buildHomepageOriginFromUrl(url);
      const domainLabel = getPrimaryDomainLabel(domain);
      const mallName = stripHtml(item.mallName || "");
      const title = stripHtml(item.title || "");

      if (homepageOrigin && !isNoisyWebDomain(domain)) {
        maybeAddAlias(learned, domainLabel);
      }

      if (mallName && mallName.length <= 20) {
        maybeAddAlias(learned, mallName);
      }

      if (title.includes(company) || normalizeCompareText(title).includes(companyCompact)) {
        maybeAddAlias(learned, title);
      }
    }
  }

  for (const row of toArray(instagramWebResults)) {
    for (const item of toArray(row?.data?.items)) {
      const title = stripHtml(item.title || "");
      const snippet = stripHtml(item.description || "");
      const directUrl = normalizeUrl(item.link || item.url || "");
      const extracted = extractUrlsFromText(`${item.title || ""} ${item.description || ""}`);
      const urls = uniqBy([directUrl, ...extracted].filter(Boolean), (x) => x);

      for (const url of urls) {
        if (looksLikeInstagramProfileUrl(url)) {
          maybeAddAlias(learned, extractHandleFromInstagramUrl(url));
        }

        const domain = extractDomain(url);
        if (looksLikeHomepageUrl(url) && !isNoisyWebDomain(domain)) {
          maybeAddAlias(learned, getPrimaryDomainLabel(domain));
        }
      }

      if (title.includes(company) || snippet.includes(company)) {
        maybeAddAlias(learned, title.replace(/\s*-\s*instagram/i, ""));
      }
    }
  }

  for (const row of toArray(homepageWebResults)) {
    for (const item of toArray(row?.data?.items)) {
      const title = stripHtml(item.title || "");
      const snippet = stripHtml(item.description || "");
      const urls = uniqBy(
        [normalizeUrl(item.link || item.url || ""), ...extractUrlsFromText(`${item.title || ""} ${item.description || ""}`)]
          .filter(Boolean),
        (x) => x
      );

      if (title.includes(company) || snippet.includes(company)) {
        maybeAddAlias(learned, title);
      }

      for (const url of urls) {
        const domain = extractDomain(url);
        if (looksLikeHomepageUrl(url) && !isNoisyWebDomain(domain)) {
          maybeAddAlias(learned, getPrimaryDomainLabel(domain));
        }
      }
    }
  }

  for (const channel of toArray(youtubeChannelsResult?.data?.items)) {
    const snippet = channel?.snippet || {};
    const title = stripHtml(snippet.title || "");
    const customUrl = safeString(snippet.customUrl || "");
    const description = stripHtml(snippet.description || "");

    if (title) maybeAddAlias(learned, title);
    if (customUrl) {
      maybeAddAlias(learned, customUrl);
      maybeAddAlias(learned, customUrl.replace(/^@/, ""));
    }

    if (title.includes(company) || description.includes(company)) {
      maybeAddAlias(learned, title);
      maybeAddAlias(learned, customUrl);
      const extracted = extractUrlsFromText(description);
      for (const url of extracted) {
        const domain = extractDomain(url);
        if (domain && !isNoisyWebDomain(domain)) {
          maybeAddAlias(learned, getPrimaryDomainLabel(domain));
        }
      }
    }
  }

  const filtered = uniqBy(
    [...learned]
      .map((x) => normalizeAliasToken(x))
      .filter(Boolean)
      .filter((x) => x.length >= 2),
    (x) => x
  );

  return filtered;
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

function chooseBestCandidate(candidates = [], bucket, debug, selectThreshold = 35) {
  const sorted = [...toArray(candidates)].sort((a, b) => b.score - a.score);
  const top = sorted[0] || null;

  if (!top) {
    if (debug?.selectedReason) debug.selectedReason[bucket] = "후보 없음";
    return null;
  }

  for (let i = 1; i < sorted.length; i += 1) {
    registerRejectedCandidate(debug, bucket, sorted[i], { rejected: "not-top-ranked" });
  }

  if (top.score < selectThreshold) {
    registerRejectedCandidate(debug, bucket, top, { rejected: "below-select-threshold" });
    if (debug?.selectedReason) {
      debug.selectedReason[bucket] = `최고점 후보가 선택 임계치 미달(${top.score} < ${selectThreshold})`;
    }
    return null;
  }

  if (debug?.selectedReason) {
    debug.selectedReason[bucket] = `score ${top.score}, ${top.reason || "reason 없음"}`;
  }

  return top;
}

function scoreToConfidence(score = 0) {
  if (score >= 90) return "high";
  if (score >= 75) return "medium";
  if (score >= 55) return "low";
  return "very-low";
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

function summarizeVerifiedAsset(candidate, verifyThreshold = 70) {
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
    verified: candidate.score >= verifyThreshold,
    confidence: scoreToConfidence(candidate.score),
    source: candidate.source || null,
    reason: candidate.reason || null,
    score: candidate.score || 0,
    candidateCount: 1,
    url: candidate.url || null,
    title: candidate.title || null,
  };
}

function computeHomepageCandidateScore(item, brandTokens = [], aliasTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const domain = extractDomain(url);
  const domainLabel = getPrimaryDomainLabel(domain);

  if (!looksLikeHomepageUrl(url)) {
    return { score: 0, reason: "not-homepage-like" };
  }

  const brand = brandMatchScore(`${title} ${snippet} ${domain}`, brandTokens);
  const alias = aliasMatchScore(`${title} ${snippet} ${domainLabel}`, aliasTokens);

  if (brand.matched === 0 && alias.matched === 0) {
    return { score: 0, reason: "brand-gate-failed" };
  }

  let score = 0;
  const reasons = [];

  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  score += alias.score;
  if (alias.score > 0) reasons.push(`alias:${alias.score}`);

  if (brand.exact || alias.exact) {
    score += 18;
    reasons.push("exact:18");
  }

  if (!isNoisyWebDomain(domain)) {
    score += 12;
    reasons.push("clean-domain:12");
  }

  const dBonus = domainBonus(domain);
  score += dBonus;
  if (dBonus > 0) reasons.push(`domain:${dBonus}`);

  const official = officialHintScore(`${title} ${snippet} ${url}`);
  if (brand.matched > 0 || alias.matched > 0) {
    score += official;
    if (official > 0) reasons.push(`official:${official}`);
  }

  if (domainLabel && aliasTokens.some((a) => normalizeAliasToken(a) === normalizeAliasToken(domainLabel))) {
    score += 14;
    reasons.push("alias-in-domain:14");
  }

  const penalty = noisePenalty(`${title} ${snippet}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  return {
    score: clamp(score, 0, 100),
    reason: reasons.join(", "),
  };
}

function computeInstagramCandidateScore(item, brandTokens = [], aliasTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const handle = extractHandleFromInstagramUrl(url);

  if (!looksLikeInstagramProfileUrl(url)) {
    return { score: 0, reason: "not-instagram-profile" };
  }

  const brand = brandMatchScore(`${title} ${snippet} ${handle}`, brandTokens);
  const alias = aliasMatchScore(`${title} ${snippet} ${handle}`, aliasTokens);

  if (brand.matched === 0 && alias.matched === 0) {
    return { score: 0, reason: "brand-gate-failed" };
  }

  let score = 0;
  const reasons = [];

  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  score += alias.score;
  if (alias.score > 0) reasons.push(`alias:${alias.score}`);

  if (brand.exact || alias.exact) {
    score += 22;
    reasons.push("exact:22");
  }

  score += 8;
  reasons.push("insta-domain:8");

  const official = officialHintScore(`${title} ${snippet}`);
  if (brand.matched > 0 || alias.matched > 0) {
    score += official;
    if (official > 0) reasons.push(`official:${official}`);
  }

  if (containsAny(title, ["reel", "릴스", "게시물", "post"])) {
    score -= 18;
    reasons.push("post-like:-18");
  }

  const penalty = noisePenalty(`${title} ${snippet}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  return {
    score: clamp(score, 0, 100),
    reason: reasons.join(", "),
  };
}

function computeNaverStoreCandidateScore(item, brandTokens = [], aliasTokens = []) {
  const url = normalizeUrl(item.url || "");
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const mallName = stripHtml(item.mallName || "");
  const productName = stripHtml(item.productName || "");
  const domain = extractDomain(url);
  const domainLabel = getPrimaryDomainLabel(domain);

  const brand = brandMatchScore(`${title} ${snippet} ${mallName} ${productName}`, brandTokens);
  const alias = aliasMatchScore(`${title} ${snippet} ${mallName} ${productName} ${domainLabel}`, aliasTokens);

  const isOfficialRedirect = domain.endsWith("kurly.com") || domainLabel === "kurly";

  if (brand.matched === 0 && alias.matched === 0 && !isOfficialRedirect) {
    return { score: 0, reason: "brand-gate-failed" };
  }

  let score = 0;
  const reasons = [];

  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  score += alias.score;
  if (alias.score > 0) reasons.push(`alias:${alias.score}`);

  if (looksLikeNaverStoreUrl(url)) {
    score += 14;
    reasons.push("naver-store-url:14");
  }

  if (isOfficialRedirect) {
    score += 30;
    reasons.push("official-domain:30");
  }

  if (mallName && aliasTokens.some((a) => normalizeAliasToken(a) === normalizeAliasToken(mallName))) {
    score += 18;
    reasons.push("mall-alias-exact:18");
  }

  const official = officialHintScore(`${title} ${mallName}`);
  if (brand.matched > 0 || alias.matched > 0 || isOfficialRedirect) {
    score += official;
    if (official > 0) reasons.push(`official:${official}`);
  }

  const penalty = noisePenalty(`${title} ${snippet} ${mallName} ${productName}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  return {
    score: clamp(score, 0, 100),
    reason: reasons.join(", "),
  };
}

function computeYouTubeCandidateScore(item, brandTokens = [], aliasTokens = []) {
  const title = stripHtml(item.title || "");
  const snippet = stripHtml(item.snippet || "");
  const customUrl = safeString(item.customUrl || "");
  const country = safeString(item.country || "");
  const description = stripHtml(item.description || "");
  const subscriberCount = safeNumber(item.subscriberCount);
  const videoCount = safeNumber(item.videoCount);
  const viewCount = safeNumber(item.viewCount);

  const brand = brandMatchScore(`${title} ${snippet} ${description} ${customUrl}`, brandTokens);
  const alias = aliasMatchScore(`${title} ${snippet} ${description} ${customUrl}`, aliasTokens);

  if (brand.matched === 0 && alias.matched === 0) {
    return { score: 0, reason: "brand-gate-failed" };
  }

  let score = 0;
  const reasons = [];

  score += brand.score;
  if (brand.score > 0) reasons.push(`brand:${brand.score}`);

  score += alias.score;
  if (alias.score > 0) reasons.push(`alias:${alias.score}`);

  if (brand.exact || alias.exact) {
    score += 20;
    reasons.push("exact:20");
  }

  const official = officialHintScore(`${title} ${snippet} ${description} ${customUrl}`);
  if (brand.matched > 0 || alias.matched > 0) {
    score += official;
    if (official > 0) reasons.push(`official:${official}`);
  }

  if (subscriberCount >= 1000000) {
    score += 10;
    reasons.push("subs:10");
  } else if (subscriberCount >= 100000) {
    score += 8;
    reasons.push("subs:8");
  } else if (subscriberCount >= 10000) {
    score += 5;
    reasons.push("subs:5");
  }

  if (videoCount >= 100) {
    score += 6;
    reasons.push("videos:6");
  } else if (videoCount >= 20) {
    score += 3;
    reasons.push("videos:3");
  }

  if (viewCount >= 1000000) {
    score += 5;
    reasons.push("views:5");
  }

  if (country.toUpperCase() === "KR") {
    score += 4;
    reasons.push("country:4");
  }

  if (containsAny(title, LOCATION_KEYWORDS)) {
    score -= 18;
    reasons.push("location-title:-18");
  }

  if (containsAny(title, ["아울렛", "매장", "리셀", "후기", "판매", "인증"])) {
    score -= 20;
    reasons.push("store-like:-20");
  }

  if (containsAny(description, ["facebook.com/groups", "중고", "개인"])) {
    score -= 18;
    reasons.push("personal-signal:-18");
  }

  const penalty = noisePenalty(`${title} ${snippet} ${description}`);
  if (penalty > 0) {
    score -= penalty;
    reasons.push(`penalty:-${penalty}`);
  }

  return {
    score: clamp(score, 0, 100),
    reason: reasons.join(", "),
  };
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
      subscribers: safeNumber(candidate?.meta?.subscriberCount),
      videoCount: safeNumber(candidate?.meta?.videoCount),
      viewCount: safeNumber(candidate?.meta?.viewCount),
    },
  };
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

function buildChannelMap(channelItems = []) {
  const map = {};
  for (const item of toArray(channelItems)) {
    const id = safeString(item.id);
    if (!id) continue;
    map[id] = item;
  }
  return map;
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
    dedupeEvidence(
      toArray(candidates).map((x) =>
        mapYouTubeCandidateToEvidence({
          ...x,
          subscriberCount: x?.meta?.subscriberCount,
          videoCount: x?.meta?.videoCount,
          viewCount: x?.meta?.viewCount,
        })
      )
    )
  ).slice(0, limit);
}

function buildHomepageCandidatesFromWebResults(results = [], brandTokens = [], aliasTokens = [], debug) {
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
          brandTokens,
          aliasTokens
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

function buildHomepageCandidatesFromShoppingResults(results = [], brandTokens = [], aliasTokens = [], debug) {
  const candidates = [];

  for (const row of toArray(results)) {
    const items = toArray(row?.data?.items);
    for (const item of items) {
      const originalUrl = normalizeUrl(item.link || item.url || "");
      const homepageUrl = buildHomepageOriginFromUrl(originalUrl);
      if (!homepageUrl) continue;

      const scored = computeHomepageCandidateScore(
        {
          title: item.mallName || item.title || "",
          url: homepageUrl,
          snippet: `${item.brand || ""} ${item.maker || ""} ${item.mallName || ""}`,
        },
        brandTokens,
        aliasTokens
      );

      if (scored.score <= 0) continue;

      candidates.push(
        buildCandidateRecord({
          type: "homepage",
          source: "naver-shopping",
          title: stripHtml(item.mallName || item.title || ""),
          url: homepageUrl,
          snippet: item.title || "",
          score: scored.score,
          reason: scored.reason,
        })
      );
    }
  }

  return uniqBy(candidates, (x) => cleanTrailingSlash(x.url));
}

function buildInstagramCandidatesFromWebResults(results = [], brandTokens = [], aliasTokens = [], debug) {
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
          brandTokens,
          aliasTokens
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

function buildNaverStoreCandidatesFromShopping(results = [], brandTokens = [], aliasTokens = [], debug) {
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
        brandTokens,
        aliasTokens
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

function buildYouTubeCandidates(searchResults = [], channelMap = {}, brandTokens = [], aliasTokens = [], debug) {
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

      const scored = computeYouTubeCandidateScore(candidate, brandTokens, aliasTokens);
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
      candidateCount: verifiedSummary?.candidateCount || 0,
    };
    return;
  }

  discovery.assets[key] = candidate.url || null;
  discovery.assetDetails[key] = makeAssetDetail({
    title: candidate.title || null,
    url: candidate.url || null,
    source: candidate.source || null,
    confidence: scoreToConfidence(candidate.score

const ENV = {
  NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID || "",
  NAVER_CLIENT_SECRET: process.env.NAVER_CLIENT_SECRET || ""
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
  "coupang.com",
  "link.coupang.com",
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

function setHeaders(res) {
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

function safeString(v) {
  return String(v || "").trim();
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

  if (typeof req.body === "string") {
    return tryParseJson(req.body, {});
  }

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

function dedupeByKey(items = [], keyFn) {
  const map = new Map();

  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    if (!map.has(key)) map.set(key, item);
  });

  return [...map.values()];
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
  const hasRegion = !!safeString(input.region);

  const isEcommerce =
    n.includes("이커머스") || n.includes("쇼핑몰") || n.includes("커머스") || n.includes("스토어");
  const isRestaurant =
    n.includes("카페") || n.includes("식당") || n.includes("음식") || n.includes("외식") || n.includes("레스토랑");
  const isMedical =
    n.includes("병원") || n.includes("의원") || n.includes("치과") || n.includes("한의원");
  const isEducation =
    n.includes("학원") || n.includes("교육") || n.includes("과외");
  const isRealEstate = n.includes("부동산");
  const isBeauty =
    n.includes("뷰티") || n.includes("미용") || n.includes("에스테틱") || n.includes("네일");
  const isB2B =
    n.includes("b2b") || n.includes("제조") || n.includes("솔루션") || n.includes("saas") || n.includes("소프트웨어");

  let type = "general";
  if (isEcommerce) type = "ecommerce";
  else if (isRestaurant) type = "restaurant";
  else if (isMedical) type = "medical";
  else if (isEducation) type = "education";
  else if (isRealEstate) type = "realestate";
  else if (isBeauty) type = "beauty";
  else if (isB2B) type = "b2b";

  const localBusiness = hasRegion && (isRestaurant || isMedical || isEducation || isBeauty || isRealEstate);

  return {
    type,
    industryLabel: pickIndustryLabel(input.industry),
    localBusiness,
    hasRegion
  };
}

function buildQueries(input) {
  const company = safeString(input.companyName);
  const industry = safeString(input.industry);
  const region = safeString(input.region);

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
      `${company} 브랜드`,
      industry ? `${company} ${industry}` : ""
    ]).slice(0, 4)
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

function pickNaverStore(input, shoppingItems = []) {
  const scored = shoppingItems
    .map((item) => {
      const host = getHostname(item.url || "");
      let score = 0;

      score += scoreNameMatch(input.companyName, item.title, item.mallName, item.brand, item.maker);

      if (tokenIncludes(input.companyName, item.mallName)) score += 20;
      if (tokenIncludes(input.companyName, item.brand)) score += 15;
      if (host.includes("smartstore.naver.com")) score += 18;
      if (host.includes("shopping.naver.com")) score += 10;
      if (host.includes("adcr.naver.com")) score += 5;

      return {
        ...item,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 45) return null;

  return {
    title: best.mallName || best.title,
    url: best.url,
    source: "naver-shopping",
    confidence:
      best.score >= 80 ? "high" :
      best.score >= 60 ? "medium" : "low",
    snippet: [best.brand, best.maker, best.category1, best.category2].filter(Boolean).join(" / "),
    mallName: best.mallName || null,
    lprice: best.lprice || 0
  };
}

function inferHomepageFromShopping(input, shoppingItems = []) {
  const candidates = [];

  shoppingItems.forEach((item) => {
    const origin = getOrigin(item.url || "");
    const host = getHostname(item.url || "");
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
      snippet: `쇼핑 링크 기반 추정 (${host})`,
      score
    });
  });

  const deduped = dedupeByKey(candidates, (x) => x.url).sort((a, b) => b.score - a.score);
  const best = deduped[0];

  if (!best || best.score < 40) return null;

  return {
    title: best.title,
    url: best.url,
    source: best.source,
    confidence: best.score >= 70 ? "medium" : "low",
    snippet: best.snippet
  };
}

function countRegionSignals(region, items = []) {
  const r = safeString(region);
  if (!r) return 0;

  return items.filter((item) => {
    const joined = `${item.title || ""} ${item.snippet || ""} ${item.mallName || ""}`;
    return joined.includes(r);
  }).length;
}

function buildEvidence(input, blog, shopping) {
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

  return evidence
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 16);
}

function compactAssetCount(assetDetails) {
  return ["homepage", "instagram", "youtube", "naverStore", "map"]
    .map((k) => assetDetails[k])
    .filter(Boolean).length;
}

function computeScores(profile, discovery, evidence) {
  const blogCount = discovery.counts.naverBlogItems;
  const shoppingCount = discovery.counts.naverShoppingItems;
  const regionHits = discovery.counts.regionHits;

  const homepage = discovery.assetDetails.homepage;
  const naverStore = discovery.assetDetails.naverStore;

  let searchVisibility =
    16 +
    clamp(Math.log10(blogCount + 1) * 18, 0, 28) +
    clamp(Math.log10(shoppingCount + 1) * 20, 0, 32) +
    (homepage ? 12 : 0) +
    (naverStore ? 14 : 0);

  let contentPresence =
    12 +
    clamp(evidence.filter((e) => e.type === "blog-mention").length * 8, 0, 36) +
    clamp(evidence.filter((e) => e.type === "shopping-item").length * 5, 0, 30);

  let localExposure =
    profile.localBusiness
      ? 16 + clamp(regionHits * 12, 0, 54)
      : 24 + clamp(regionHits * 6, 0, 18) + (naverStore ? 6 : 0);

  let webQuality = homepage ? 38 : 16;

  if (profile.type === "ecommerce" && naverStore) {
    searchVisibility += 6;
    contentPresence += 4;
  }

  if (profile.localBusiness && !discovery.assetDetails.map) {
    localExposure -= 8;
  }

  searchVisibility = round(clamp(searchVisibility, 0, 100));
  contentPresence = round(clamp(contentPresence, 0, 100));
  localExposure = round(clamp(localExposure, 0, 100));
  webQuality = round(clamp(webQuality, 0, 100));

  const overall = round(clamp(
    searchVisibility * 0.35 +
    contentPresence * 0.25 +
    localExposure * 0.22 +
    webQuality * 0.18,
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

  if (assetCount >= 2 || strongEvidence >= 5) {
    return {
      level: "높음",
      description: "NAVER 기준으로 자산과 반복 언급 흔적이 확인되어 1차 진단 신뢰도가 높은 편입니다."
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

  if (scores.overall < 35 || assetCount === 0) {
    return {
      code: "foundation",
      title: "기초 자산 정비 단계",
      description: "공식 자산 식별과 기본 검색 접점부터 정비해야 하는 단계입니다."
    };
  }

  if (scores.overall < 60) {
    return {
      code: "traction",
      title: "검색 접점 확장 단계",
      description: "브랜드 언급은 보이지만 검색-콘텐츠-전환 접점을 더 구체화해야 하는 단계입니다."
    };
  }

  return {
    code: "growth",
    title: "확장 준비 단계",
    description: "기본 자산 흔적이 있어 채널 운영과 전환 구조를 구체화할 수 있는 단계입니다."
  };
}

function buildNarrative(input, profile, discovery, scores, evidence, confidence) {
  const wins = [];
  const risks = [];
  const nextActions = [];

  if (discovery.assetDetails.naverStore) {
    wins.push("NAVER 쇼핑/스토어 계열 노출 흔적이 확인되어 검색-구매 접점은 일부 확보된 상태입니다.");
  }

  if ((blogEvidenceCount(evidence) >= 3)) {
    wins.push("네이버 블로그 언급이 반복적으로 발견되어 브랜드 언급 기반은 형성되어 있습니다.");
  }

  if (!discovery.assetDetails.homepage) {
    risks.push("공식 홈페이지 또는 대표 랜딩이 확정되지 않아 브랜드 검색 유입이 외부 플랫폼에 분산될 수 있습니다.");
  }

  if (profile.type === "ecommerce" && !discovery.assetDetails.naverStore) {
    risks.push("이커머스 업종인데 NAVER 쇼핑/스토어 접점이 약하면 검색 전환 기회를 놓칠 수 있습니다.");
  }

  if (scores.webQuality < 30) {
    risks.push("홈페이지 확정 전이라 웹 품질 점검이 아직 불가능하거나 제한적입니다.");
  }

  if (!discovery.assetDetails.homepage) {
    nextActions.push("브랜드 검색 시 가장 먼저 연결될 공식 홈페이지 또는 대표 랜딩 1개를 우선 확정하세요.");
  }

  if (profile.type === "ecommerce") {
    nextActions.push("대표 상품 10개를 기준으로 NAVER 쇼핑 상품명·썸네일·리뷰 구조를 먼저 정비하세요.");
    nextActions.push("첫 4주 동안 블로그 콘텐츠는 주 2회, 후기형 1개 + 문제해결형 1개 패턴으로 운영하세요.");
  } else if (profile.localBusiness) {
    nextActions.push("지역명 + 업종 + 대표 서비스 조합으로 블로그/소개 문구를 통일해 지역 검색 접점을 강화하세요.");
    nextActions.push("첫 4주 동안 후기형/FAQ형 블로그 콘텐츠를 주 2회 운영해 신뢰 자산을 축적하세요.");
  } else {
    nextActions.push("브랜드 소개보다 고객 문제 해결형 콘텐츠를 주 2회 발행해 검색 기반 콘텐츠를 축적하세요.");
    nextActions.push("검색 후 바로 이동할 대표 전환 페이지를 하나 정하고 CTA를 단일화하세요.");
  }

  const executiveSummary =
    profile.type === "ecommerce"
      ? `${input.companyName}은(는) NAVER 기준으로 일부 검색 흔적은 있으나, 공식 랜딩과 쇼핑 전환 접점을 더 구조화해야 매출형 마케팅 효율이 올라갈 단계입니다.`
      : profile.localBusiness
        ? `${input.companyName}은(는) 지역 기반 검색과 블로그 언급 신호를 활용할 여지가 있으며, 지금은 방문 결정에 필요한 신뢰 자산을 더 쌓아야 하는 단계입니다.`
        : `${input.companyName}은(는) NAVER 기준 초기 언급 신호는 있으나 공식 자산과 전환 구조가 아직 약하게 보일 수 있습니다.`;

  return {
    executiveSummary,
    wins: unique(wins).slice(0, 3),
    risks: unique(risks).slice(0, 3),
    nextActions: unique(nextActions).slice(0, 4)
  };
}

function blogEvidenceCount(evidence = []) {
  return evidence.filter((e) => e.type === "blog-mention").length;
}

function buildPrescription(profile, stage, discovery) {
  if (profile.type === "ecommerce") {
    return {
      stage,
      priorityChannels: [
        "NAVER Shopping",
        "브랜드 랜딩페이지",
        "블로그 콘텐츠"
      ],
      thirtyDayPlan: [
        {
          week: "1주차",
          action: "브랜드 검색 시 연결될 대표 랜딩페이지 1개 확정",
          detail: "메인홈보다 대표 제품/카테고리 또는 전환형 랜딩 우선"
        },
        {
          week: "1~2주차",
          action: "대표 상품 10개 기준으로 상품명·썸네일·리뷰 구조 정비",
          detail: "카테고리 키워드와 브랜드 키워드를 분리해 상품명을 정렬"
        },
        {
          week: "2~4주차",
          action: "주 2회 블로그 운영",
          detail: "후기형 1개 + 문제해결형 1개 패턴으로 4주 지속"
        }
      ],
      ninetyDayPlan: [
        {
          period: "1~4주",
          focus: "검색 접점 정비",
          deliverables: ["대표 랜딩", "상품 구조 정비", "초기 리뷰 목표 설정"]
        },
        {
          period: "5~8주",
          focus: "콘텐츠 반복 운영",
          deliverables: ["블로그 8개 이상", "베스트 상품 중심 노출 강화"]
        },
        {
          period: "9~12주",
          focus: "광고/리타겟팅 테스트 준비",
          deliverables: ["전환 측정 구조", "상위 랜딩 확정"]
        }
      ]
    };
  }

  if (profile.localBusiness) {
    return {
      stage,
      priorityChannels: [
        "지역 검색",
        "블로그 후기/FAQ",
        "대표 랜딩 또는 소개 페이지"
      ],
      thirtyDayPlan: [
        {
          week: "1주차",
          action: "지역명 + 업종 + 대표 서비스 조합의 핵심 문구 정리",
          detail: "모든 소개 문구와 콘텐츠 제목 톤을 통일"
        },
        {
          week: "1~2주차",
          action: "블로그 콘텐츠 주 2회 운영 시작",
          detail: "후기형 1개 + FAQ형 1개"
        },
        {
          week: "3~4주차",
          action: "상담/문의/예약으로 이어질 대표 페이지 정비",
          detail: "CTA를 1개로 단순화"
        }
      ],
      ninetyDayPlan: [
        {
          period: "1~4주",
          focus: "지역 검색 기초 자산 정비",
          deliverables: ["대표 문구 정리", "블로그 4~8개", "전환 페이지 정리"]
        },
        {
          period: "5~8주",
          focus: "후기/사례 축적",
          deliverables: ["반복 후기 콘텐츠", "FAQ 아카이브"]
        },
        {
          period: "9~12주",
          focus: "지역 광고 테스트 준비",
          deliverables: ["상담/예약 전환 기준선 확보"]
        }
      ]
    };
  }

  return {
    stage,
    priorityChannels: [
      "대표 랜딩",
      "블로그 콘텐츠",
      "브랜드 검색 접점"
    ],
    thirtyDayPlan: [
      {
        week: "1주차",
        action: "브랜드 검색 후 도달할 대표 페이지 1개 확정",
        detail: "메시지와 CTA를 단일화"
      },
      {
        week: "2~4주차",
        action: "주 2회 블로그 운영",
        detail: "문제해결형 또는 소개형 콘텐츠를 반복 축적"
      }
    ],
    ninetyDayPlan: [
      {
        period: "1~4주",
        focus: "기초 자산 정비",
        deliverables: ["대표 페이지", "블로그 4개 이상"]
      },
      {
        period: "5~8주",
        focus: "콘텐츠 반복 운영",
        deliverables: ["반응 좋은 주제 재활용", "전환 요소 보강"]
      },
      {
        period: "9~12주",
        focus: "광고/확장 채널 검토",
        deliverables: ["기초 KPI 기준선 확보"]
      }
    ]
  };
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "naver-stage-1"
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
      companyName: safeString(body.companyName || body.company),
      industry: safeString(body.industry),
      region: safeString(body.region),
      email: safeString(body.email)
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

    const profile = buildBusinessProfile(input);

    const [blog, shopping] = await Promise.all([
      searchNaverBlog(input),
      searchNaverShopping(input)
    ]);

    const homepage = inferHomepageFromShopping(input, shopping.items || []);
    const naverStore = pickNaverStore(input, shopping.items || []);

    const assetDetails = {
      homepage,
      instagram: null,
      youtube: null,
      naverStore,
      map: null
    };

    const discovery = {
      assets: {
        homepage: homepage?.url || null,
        instagram: null,
        youtube: null,
        naverStore: naverStore?.url || null,
        map: null
      },
      assetDetails,
      pageSpeed: null,
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
          ok: false,
          candidateCount: 0,
          error: "stage-1 not connected"
        },
        pageSpeed: {
          ok: false
        }
      }
    };

    const evidence = buildEvidence(input, blog, shopping);
    const scores = computeScores(profile, discovery, evidence);
    const confidence = computeConfidence(discovery, evidence);
    const stage = determineStage(profile, scores, discovery);
    const narrative = buildNarrative(input, profile, discovery, scores, evidence, confidence);
    const prescription = buildPrescription(profile, stage, discovery);

    const diagnosis = {
      industryLabel: profile.industryLabel,
      confidence: confidence.level,
      confidenceDescription: confidence.description,
      executiveSummary: narrative.executiveSummary,
      scores,
      wins: narrative.wins,
      risks: narrative.risks,
      nextActions: narrative.nextActions,
      limits: [
        "현재는 1단계 NAVER Blog + NAVER Shopping 기반 진단입니다.",
        "Instagram / YouTube / PageSpeed / 지도 자산은 아직 연결되지 않았습니다.",
        "2단계에서 YouTube, 3단계에서 PageSpeed를 추가하면 진단 정밀도가 올라갑니다."
      ]
    };

    return res.status(200).json({
      ok: true,
      input,
      discovery,
      diagnosis,
      evidence,
      prescription
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

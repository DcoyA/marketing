const GOOGLE_CSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

function stripHtml(input = "") {
  return String(input)
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .trim();
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

function getHostname(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_) {
    return "";
  }
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

function scoreNameMatch(text = "", companyName = "", region = "") {
  const raw = `${text}`.toLowerCase();
  const rawCompany = String(companyName || "").toLowerCase().trim();
  const rawRegion = String(region || "").toLowerCase().trim();

  const normText = normalizeText(text);
  const normCompany = normalizeText(companyName);
  const companyTokens = tokenize(companyName);
  const regionTokens = tokenize(region);

  let score = 0;

  if (!text) return 0;

  if (normCompany && normText.includes(normCompany)) score += 60;
  if (rawCompany && raw.includes(rawCompany)) score += 15;

  let companyTokenHits = 0;
  for (const token of companyTokens) {
    if (token && raw.includes(token)) companyTokenHits += 1;
  }
  if (companyTokens.length > 0) {
    score += Math.min(15, Math.round((companyTokenHits / companyTokens.length) * 15));
  }

  let regionHits = 0;
  for (const token of regionTokens) {
    if (token && raw.includes(token)) regionHits += 1;
  }
  if (regionTokens.length > 0) {
    score += Math.min(10, Math.round((regionHits / regionTokens.length) * 10));
  } else if (rawRegion && raw.includes(rawRegion)) {
    score += 8;
  }

  return clamp(score, 0, 100);
}

function looksLikeInstagramProfile(url = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("instagram.com")) return false;

    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return false;

    const first = path.split("/")[0].toLowerCase();
    const blocked = ["p", "reel", "reels", "explore", "stories", "tv", "accounts"];
    return !blocked.includes(first);
  } catch (_) {
    return false;
  }
}

function looksLikeYouTubeChannel(url = "") {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.endsWith("youtube.com")) return false;

    const path = u.pathname.toLowerCase();
    return (
      path.startsWith("/@") ||
      path.startsWith("/channel/") ||
      path.startsWith("/c/") ||
      path.startsWith("/user/")
    );
  } catch (_) {
    return false;
  }
}

function isRejectedHomepage(url = "") {
  const host = getHostname(url);
  const blocked = [
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
    "smartstore.naver.com",
    "search.shopping.naver.com",
    "play.google.com",
    "apps.apple.com",
    "namu.wiki"
  ];
  return blocked.some((d) => host === d || host.endsWith(`.${d}`));
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

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(`JSON parse failed: ${text.slice(0, 300)}`);
  }
}

async function googleSearch(query, num = 5) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    throw new Error("GOOGLE_SEARCH_API_KEY 또는 GOOGLE_SEARCH_ENGINE_ID 누락");
  }

  const url =
    `${GOOGLE_CSE_ENDPOINT}?key=${encodeURIComponent(apiKey)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(query)}` +
    `&num=${num}`;

  const data = await fetchJson(url);
  return (data.items || []).map(mapGoogleItem);
}

function pickBestHomepage(items = [], companyName = "", region = "") {
  const candidates = items
    .filter((item) => item.url && !isRejectedHomepage(item.url))
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);
      if (!isRejectedHomepage(item.url)) score += 10;
      if (/공식|official|홈페이지|회사|기업|서비스/i.test(`${item.title} ${item.snippet}`)) score += 8;
      return { ...item, matchScore: clamp(score, 0, 100) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  if (!candidates.length || candidates[0].matchScore < 35) return null;
  return candidates[0];
}

function pickBestInstagram(items = [], companyName = "", region = "") {
  const candidates = items
    .filter((item) => looksLikeInstagramProfile(item.url))
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);
      score += 15;
      return { ...item, matchScore: clamp(score, 0, 100) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  if (!candidates.length || candidates[0].matchScore < 30) return null;
  return candidates[0];
}

function pickBestYouTube(items = [], companyName = "", region = "") {
  const candidates = items
    .filter((item) => looksLikeYouTubeChannel(item.url))
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);
      score += 15;
      return { ...item, matchScore: clamp(score, 0, 100) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  if (!candidates.length || candidates[0].matchScore < 30) return null;
  return candidates[0];
}

function pickBestNaverStore(items = [], companyName = "", region = "") {
  const candidates = items
    .filter((item) => {
      const host = getHostname(item.url);
      return host.includes("smartstore.naver.com") || host.includes("search.shopping.naver.com");
    })
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);
      score += 20;
      return { ...item, matchScore: clamp(score, 0, 100) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  if (!candidates.length || candidates[0].matchScore < 25) return null;
  return candidates[0];
}

function pickBestMap(items = [], companyName = "", region = "") {
  const candidates = items
    .filter((item) => {
      const host = getHostname(item.url);
      return (
        host.includes("map.naver.com") ||
        host.includes("m.place.naver.com") ||
        host.includes("google.com") ||
        host.includes("g.page")
      );
    })
    .map((item) => {
      let score = scoreNameMatch(`${item.title} ${item.snippet} ${item.url}`, companyName, region);
      score += 18;
      return { ...item, matchScore: clamp(score, 0, 100) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  if (!candidates.length || candidates[0].matchScore < 25) return null;
  return candidates[0];
}

async function discoverGoogleAssets({ companyName, region }) {
  const jobs = [
    { key: "general", query: `${companyName} ${region}` },
    { key: "homepage", query: `${companyName} ${region} 공식 홈페이지` },
    { key: "instagram", query: `${companyName} ${region} site:instagram.com` },
    { key: "youtube", query: `${companyName} ${region} site:youtube.com` },
    { key: "naverStore", query: `${companyName} ${region} site:smartstore.naver.com` },
    { key: "map", query: `${companyName} ${region} 지도` }
  ];

  const settled = await Promise.allSettled(
    jobs.map((job) => googleSearch(job.query, 5))
  );

  const raw = {};
  const warnings = [];

  settled.forEach((result, index) => {
    const key = jobs[index].key;

    if (result.status === "fulfilled") {
      raw[key] = result.value || [];
    } else {
      raw[key] = [];
      warnings.push(`${key} 검색 실패`);
    }
  });

  const allGeneral = raw.general || [];
  const homepage = pickBestHomepage(
    uniqueBy([...(raw.homepage || []), ...allGeneral], (v) => v.url),
    companyName,
    region
  );

  const instagram = pickBestInstagram(
    uniqueBy([...(raw.instagram || []), ...allGeneral], (v) => v.url),
    companyName,
    region
  );

  const youtube = pickBestYouTube(
    uniqueBy([...(raw.youtube || []), ...allGeneral], (v) => v.url),
    companyName,
    region
  );

  const naverStore = pickBestNaverStore(
    uniqueBy([...(raw.naverStore || []), ...allGeneral], (v) => v.url),
    companyName,
    region
  );

  const map = pickBestMap(
    uniqueBy([...(raw.map || []), ...allGeneral], (v) => v.url),
    companyName,
    region
  );

  const evidence = [];
  if (homepage) {
    evidence.push({
      title: homepage.title || "공식 홈페이지 후보",
      platform: "Google Search",
      reason: `공식 홈페이지 후보가 발견되었습니다. 매칭 점수 ${homepage.matchScore}`,
      url: homepage.url
    });
  }
  if (instagram) {
    evidence.push({
      title: instagram.title || "Instagram 후보",
      platform: "Google Search",
      reason: `인스타그램 후보가 발견되었습니다. 매칭 점수 ${instagram.matchScore}`,
      url: instagram.url
    });
  }
  if (youtube) {
    evidence.push({
      title: youtube.title || "YouTube 후보",
      platform: "Google Search",
      reason: `유튜브 채널 후보가 발견되었습니다. 매칭 점수 ${youtube.matchScore}`,
      url: youtube.url
    });
  }
  if (naverStore) {
    evidence.push({
      title: naverStore.title || "NAVER 스토어 후보",
      platform: "Google Search",
      reason: `네이버 스토어 후보가 발견되었습니다. 매칭 점수 ${naverStore.matchScore}`,
      url: naverStore.url
    });
  }
  if (map) {
    evidence.push({
      title: map.title || "지도/플랫폼 후보",
      platform: "Google Search",
      reason: `지도성 노출 후보가 발견되었습니다. 매칭 점수 ${map.matchScore}`,
      url: map.url
    });
  }

  return {
    raw,
    warnings,
    assets: {
      homepage,
      instagram,
      youtube,
      naverStore,
      map
    },
    evidence
  };
}

function getIndustryLabel(industry = "") {
  const map = {
    it: "IT / B2B / SaaS",
    local: "소상공인 / 로컬 서비스",
    ecommerce: "이커머스 / 쇼핑몰",
    professional: "전문 서비스 / 컨설팅",
    creator: "지식형 / 콘텐츠형"
  };
  return map[industry] || "기타";
}

function calculateScores(discovery = {}, industry = "") {
  const assets = discovery.assets || {};

  const hasHomepage = !!assets.homepage;
  const hasInstagram = !!assets.instagram;
  const hasYoutube = !!assets.youtube;
  const hasStore = !!assets.naverStore;
  const hasMap = !!assets.map;

  let searchVisibility = 0;
  searchVisibility += hasHomepage ? 30 : 0;
  searchVisibility += hasMap ? 20 : 0;
  searchVisibility += hasStore ? 18 : 0;
  searchVisibility += hasInstagram ? 12 : 0;
  searchVisibility += hasYoutube ? 12 : 0;
  searchVisibility = clamp(searchVisibility, 0, 100);

  let contentPresence = 0;
  contentPresence += hasInstagram ? 35 : 0;
  contentPresence += hasYoutube ? 35 : 0;
  contentPresence += hasHomepage ? 15 : 0;
  contentPresence += hasStore ? 10 : 0;
  contentPresence = clamp(contentPresence, 0, 100);

  let localExposure = 0;
  localExposure += hasMap ? 45 : 0;
  localExposure += hasStore ? 20 : 0;
  localExposure += hasInstagram ? 10 : 0;
  localExposure += hasHomepage ? 10 : 0;
  localExposure = clamp(localExposure, 0, 100);

  let webQuality = 0;
  webQuality += hasHomepage ? 55 : 0;
  webQuality += hasInstagram ? 10 : 0;
  webQuality += hasYoutube ? 10 : 0;
  webQuality = clamp(webQuality, 0, 100);

  let overall = 0;

  switch (industry) {
    case "it":
      overall = Math.round(searchVisibility * 0.30 + contentPresence * 0.15 + localExposure * 0.05 + webQuality * 0.50);
      break;
    case "local":
      overall = Math.round(searchVisibility * 0.25 + contentPresence * 0.15 + localExposure * 0.40 + webQuality * 0.20);
      break;
    case "ecommerce":
      overall = Math.round(searchVisibility * 0.28 + contentPresence * 0.22 + localExposure * 0.12 + webQuality * 0.38);
      break;
    case "professional":
      overall = Math.round(searchVisibility * 0.30 + contentPresence * 0.12 + localExposure * 0.13 + webQuality * 0.45);
      break;
    case "creator":
      overall = Math.round(searchVisibility * 0.20 + contentPresence * 0.45 + localExposure * 0.05 + webQuality * 0.30);
      break;
    default:
      overall = Math.round(searchVisibility * 0.25 + contentPresence * 0.20 + localExposure * 0.15 + webQuality * 0.40);
      break;
  }

  return {
    overall: clamp(overall, 0, 100),
    searchVisibility,
    contentPresence,
    localExposure,
    webQuality
  };
}

function buildDiagnosis({ companyName, industry, region, discovery, scores }) {
  const assets = discovery.assets || {};
  const wins = [];
  const risks = [];
  const nextActions = [];
  const limits = [];

  const foundCount = [assets.homepage, assets.instagram, assets.youtube, assets.naverStore, assets.map].filter(Boolean).length;

  let confidence = "낮음";
  let confidenceDescription = "발견 자산 수가 적어 초기 후보 수준의 진단입니다.";

  if (foundCount >= 4) {
    confidence = "높음";
    confidenceDescription = "복수 플랫폼에서 브랜드 후보가 확인되어 신뢰도가 높은 편입니다.";
  } else if (foundCount >= 2) {
    confidence = "중간";
    confidenceDescription = "일부 핵심 자산이 발견되었지만 추가 확인이 필요합니다.";
  }

  if (assets.homepage) {
    wins.push("공식 홈페이지 후보가 확인되어 브랜드 검색 후 자사 자산으로 연결될 가능성이 있습니다.");
  } else {
    risks.push("공식 홈페이지 후보가 약해 검색 유입이 외부 플랫폼으로 분산될 수 있습니다.");
    nextActions.push("브랜드명 검색 시 바로 식별되는 공식 홈페이지/대표 랜딩페이지를 먼저 확보하세요.");
  }

  if (assets.instagram) {
    wins.push("Instagram 후보가 확인되어 소셜 접점이 존재합니다.");
  } else {
    risks.push("Instagram 후보가 뚜렷하지 않아 소셜 신뢰 자산이 약할 수 있습니다.");
    if (["local", "ecommerce", "creator"].includes(industry)) {
      nextActions.push("Instagram 계정명을 브랜드명과 최대한 일치시키고 프로필 링크를 정리하세요.");
    }
  }

  if (assets.youtube) {
    wins.push("YouTube 후보가 확인되어 검색형 콘텐츠 자산 확장 가능성이 있습니다.");
  } else {
    if (["it", "professional", "creator"].includes(industry)) {
      risks.push("YouTube 채널 후보가 없어 검색형/설명형 콘텐츠 자산이 부족할 수 있습니다.");
      nextActions.push("브랜드명 기준 YouTube 채널을 정리하고 대표 영상 몇 개를 먼저 축적하세요.");
    }
  }

  if (assets.naverStore) {
    wins.push("NAVER 스토어 후보가 확인되어 구매 연결 지점이 일부 보입니다.");
  } else if (industry === "ecommerce") {
    risks.push("이커머스 업종인데 NAVER 스토어/쇼핑 흔적이 약합니다.");
    nextActions.push("네이버 쇼핑/스토어 노출 경로를 우선 확보하세요.");
  }

  if (assets.map) {
    wins.push("지도/플랫폼 노출 후보가 확인되었습니다.");
  } else if (industry === "local") {
    risks.push("로컬 업종인데 지도성 노출 후보가 약합니다.");
    nextActions.push("지도/플랫폼 프로필과 지역 키워드 노출 구조를 먼저 정리하세요.");
  }

  if (!nextActions.length) {
    nextActions.push("다음 단계에서 NAVER API를 붙여 블로그/쇼핑/지역 데이터를 실제값으로 교체하세요.");
    nextActions.push("그 다음 YouTube Data API와 PageSpeed를 연결해 수치를 보강하세요.");
  }

  limits.push("현재 단계는 Google Search 기반 1차 탐색 결과입니다.");
  limits.push("NAVER 블로그/쇼핑/지역의 실제 API 데이터는 아직 반영되지 않았습니다.");
  limits.push("유튜브 통계, 홈페이지 속도, AI 서술 보강은 다음 단계에서 추가됩니다.");

  let executiveSummary = `${companyName}의 공개 웹 후보 자산을 바탕으로 초기 탐색을 완료했습니다.`;
  if (scores.overall >= 70) {
    executiveSummary = `${companyName}은(는) 공개 웹 기준 핵심 자산이 비교적 잘 드러나는 편입니다.`;
  } else if (scores.overall >= 45) {
    executiveSummary = `${companyName}은(는) 일부 자산은 보이지만 플랫폼 간 연결성과 노출 완성도는 아직 보강이 필요합니다.`;
  } else {
    executiveSummary = `${companyName}은(는) 공개 웹에서 핵심 브랜드 자산 노출이 아직 약한 편입니다.`;
  }

  return {
    industryLabel: getIndustryLabel(industry),
    confidence,
    confidenceDescription,
    executiveSummary,
    scores,
    wins,
    risks,
    nextActions,
    limits
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "method_not_allowed",
        message: "POST 요청만 허용됩니다."
      });
    }

    let body = req.body || {};
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { companyName, industry, region, email } = body;

    if (!companyName || !industry || !region || !email) {
      return res.status(400).json({
        error: "missing_fields",
        message: "업체명, 업종, 지역, 이메일을 모두 입력해주세요."
      });
    }

    const discovery = await discoverGoogleAssets({ companyName, region });
    const scores = calculateScores(discovery, industry);
    const diagnosis = buildDiagnosis({
      companyName,
      industry,
      region,
      discovery,
      scores
    });

    return res.status(200).json({
      input: {
        companyName,
        industry,
        region,
        email
      },
      discovery: {
        assets: discovery.assets,
        pageSpeed: null
      },
      diagnosis,
      evidence: discovery.evidence
    });
  } catch (error) {
    console.error("analyze.js crash:", error);

    return res.status(500).json({
      error: "server_crash",
      message: error.message || "unknown error"
    });
  }
}

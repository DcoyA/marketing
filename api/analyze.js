const NAVER_BLOG_API = "https://openapi.naver.com/v1/search/blog.json";
const NAVER_SHOPPING_API = "https://openapi.naver.com/v1/search/shop.json";
const NAVER_WEBKR_API = "https://openapi.naver.com/v1/search/webkr.json";

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
    if (path.startsWith("/p/")) return false;
    if (path.startsWith("/reel/")) return false;
    if (path.startsWith("/reels/")) return false;
    if (path.startsWith("/stories/")) return false;
    if (path.startsWith("/explore/")) return false;
    return true;
  } catch {
    return false;
  }
}

function isHomepageCandidateUrl(url = "") {
  const domain = extractDomain(url);
  if (!domain) return false;

  if (domain.includes("instagram.com")) return false;
  if (domain.includes("youtube.com")) return false;
  if (domain.includes("youtu.be")) return false;
  if (domain.includes("blog.naver.com")) return false;
  if (domain.includes("search.naver.com")) return false;
  if (domain.includes("cafe.naver.com")) return false;
  if (domain.includes("news.naver.com")) return false;
  if (domain.includes("facebook.com")) return false;
  if (domain.includes("x.com")) return false;
  if (domain.includes("twitter.com")) return false;
  if (domain.includes("tiktok.com")) return false;

  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.startsWith("/search")) return false;
    if (path.startsWith("/p/")) return false;
    if (path.startsWith("/reel/")) return false;
  } catch {
    return false;
  }

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
          reason: "stage 3: candidate only",
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
          reason: "stage 3: candidate only",
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
          reason: "stage 3: not connected",
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
          reason: "stage 3: candidate only",
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
          reason: "stage 3: not connected",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
      },
      pageSpeed: {
        ok: false,
        error: "stage 3: not connected",
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
        pageSpeed: {
          ...makeEmptyStatus(),
          error: "not connected",
        },
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
      confidenceDescription: "현재는 NAVER Blog + Shopping + WebKR 연결 여부만 확인하는 3단계 검증 모드입니다.",
      executiveSummary: "JSON 응답과 NAVER Blog/Shopping/WebKR 수집 여부를 점검하는 단계입니다.",
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
        "현재는 NAVER Blog + NAVER Shopping + NAVER WebKR(homepage/instagram 후보)만 연결된 3단계 버전입니다.",
      ],
    },
    evidence: [],
    prescription: {
      stage: {
        code: "naver-webkr-stage-3",
        title: "NAVER WebKR 연결 점검 단계",
        description: "JSON 반환과 NAVER Blog/Shopping/WebKR 결과 수집만 우선 검증합니다.",
      },
      priorityChannels: ["NAVER Blog", "NAVER Shopping", "NAVER WebKR"],
      thirtyDayPlan: [],
      ninetyDayPlan: [],
    },
    debug: {
      stage: "naver-webkr-stage-3",
      env: {
        naverClientId: false,
        naverClientSecret: false,
      },
      queries: {
        blog: [],
        shopping: [],
        homepage: [],
        instagram: [],
      },
      requestLog: [],
      candidates: {
        homepage: [],
        instagram: [],
      },
    },
  };
}

async function fetchNaverJson(url, headers) {
  const res = await fetch(url, { headers });
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
    const url =
      `${endpoint}?query=${encodeURIComponent(query)}&display=10&start=1&sort=sim`;

    const result = await fetchNaverJson(url, headers);
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

    rows.push({
      query,
      source: sourceLabel,
      ...result,
    });

    if (result.status === 429) break;
    await new Promise((r) => setTimeout(r, 250));
  }

  return rows;
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
          meta: {
            query,
            domain: extractDomain(url),
          },
        });
      }
    }
  }

  return uniqBy(
    out.sort((a, b) => b.score - a.score),
    (x) => x.url
  ).slice(0, 10);
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
          meta: {
            query,
            domain: extractDomain(url),
          },
        });
      }
    }
  }

  return uniqBy(
    out.sort((a, b) => b.score - a.score),
    (x) => x.url
  ).slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "naver-webkr-stage-3",
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

    response.debug.env.naverClientId = !!NAVER_CLIENT_ID;
    response.debug.env.naverClientSecret = !!NAVER_CLIENT_SECRET;

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

    response.debug.queries.blog = blogQueries;
    response.debug.queries.shopping = shoppingQueries;
    response.debug.queries.homepage = homepageQueries;
    response.debug.queries.instagram = instagramQueries;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      response.discovery.sourceStatus.naverBlog.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverBlog.errorCount = 1;

      response.discovery.sourceStatus.naverShopping.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverShopping.errorCount = 1;

      response.discovery.sourceStatus.naverWebHomepage.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverWebHomepage.errorCount = 1;

      response.discovery.sourceStatus.naverWebInstagram.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverWebInstagram.errorCount = 1;

      response.diagnosis.confidence = "매우 낮음";
      response.diagnosis.confidenceDescription =
        "NAVER 인증 정보가 없어 Blog/Shopping/WebKR 검색을 수행하지 못했습니다.";
      response.diagnosis.executiveSummary =
        "현재는 NAVER Blog + Shopping + WebKR 3단계 검증 모드이며, 인증 정보 누락으로 검색 결과를 가져오지 못했습니다.";
      response.diagnosis.risks = [
        "NAVER API 인증 정보가 없어 검색 결과를 수집하지 못했습니다.",
      ];
      response.diagnosis.nextActions = [
        "Vercel 환경변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET를 확인하세요.",
        "환경변수 수정 후 redeploy 하세요.",
      ];

      return res.status(200).json(response);
    }

    const headers = {
      "X-Naver-Client-Id": NAVER_CLIENT_ID,
      "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
    };

    const blogRows = await runNaverBatch({
      endpoint: NAVER_BLOG_API,
      queries: blogQueries,
      headers,
      sourceLabel: "naver-blog",
      debug: response.debug,
    });

    const shoppingRows = await runNaverBatch({
      endpoint: NAVER_SHOPPING_API,
      queries: shoppingQueries,
      headers,
      sourceLabel: "naver-shopping",
      debug: response.debug,
    });

    const homepageRows = await runNaverBatch({
      endpoint: NAVER_WEBKR_API,
      queries: homepageQueries,
      headers,
      sourceLabel: "naver-web-homepage",
      debug: response.debug,
    });

    const instagramRows = await runNaverBatch({
      endpoint: NAVER_WEBKR_API,
      queries: instagramQueries,
      headers,
      sourceLabel: "naver-web-instagram",
      debug: response.debug,
    });

    const blogEvidence = buildBlogEvidence(blogRows);
    const shoppingEvidence = buildShoppingEvidence(shoppingRows);
    const homepageCandidates = buildHomepageCandidates(homepageRows, input.companyName);
    const instagramCandidates = buildInstagramCandidates(instagramRows, input.companyName);

    response.debug.candidates.homepage = homepageCandidates.slice(0, 5);
    response.debug.candidates.instagram = instagramCandidates.slice(0, 5);

    response.discovery.sourceStatus.naverBlog = buildStatus(blogRows);
    response.discovery.sourceStatus.naverShopping = buildStatus(shoppingRows);
    response.discovery.sourceStatus.naverWebHomepage = buildStatus(homepageRows);
    response.discovery.sourceStatus.naverWebInstagram = buildStatus(instagramRows);

    response.discovery.counts.naverBlogItems = blogEvidence.length;
    response.discovery.counts.naverShoppingItems = shoppingEvidence.length;
    response.discovery.counts.naverWebHomepageItems = homepageCandidates.length;
    response.discovery.counts.naverWebInstagramItems = instagramCandidates.length;
    response.discovery.counts.regionHits = [...blogEvidence, ...shoppingEvidence].filter((x) =>
      s(x.title + " " + x.snippet).includes(input.region)
    ).length;

    response.discovery.rawCount.naverBlogFetched = blogEvidence.length;
    response.discovery.rawCount.naverShoppingFetched = shoppingEvidence.length;
    response.discovery.rawCount.naverWebHomepageFetched = homepageCandidates.length;
    response.discovery.rawCount.naverWebInstagramFetched = instagramCandidates.length;

    const selectedHomepage = homepageCandidates[0] || null;
    const selectedInstagram = instagramCandidates[0] || null;

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
        reason: "stage 3 homepage candidate",
        score: selectedHomepage.score,
        candidateCount: homepageCandidates.length,
        url: selectedHomepage.url,
        title: selectedHomepage.title,
      };
    } else {
      response.discovery.verified.homepage.candidateCount = 0;
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
        reason: "stage 3 instagram candidate",
        score: selectedInstagram.score,
        candidateCount: instagramCandidates.length,
        url: selectedInstagram.url,
        title: selectedInstagram.title,
      };
    } else {
      response.discovery.verified.instagram.candidateCount = 0;
      response.discovery.verified.instagram.reason = "instagram candidate not found";
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
    const hasHomepageCandidate = homepageCandidates.length > 0;
    const hasInstagramCandidate = instagramCandidates.length > 0;

    response.diagnosis.confidence =
      hasHomepageCandidate || hasInstagramCandidate || hasBlog || hasShopping
        ? "보통"
        : "낮음";

    response.diagnosis.confidenceDescription =
      hasHomepageCandidate || hasInstagramCandidate
        ? "NAVER WebKR에서 homepage 또는 instagram 후보가 수집되었습니다."
        : "JSON은 정상이나 WebKR 후보가 부족하거나 일부 요청이 실패했습니다.";

    response.diagnosis.executiveSummary =
      hasHomepageCandidate || hasInstagramCandidate
        ? `${input.companyName} 관련 NAVER Blog/Shopping 결과와 WebKR 기반 homepage·instagram 후보가 수집되었습니다.`
        : `${input.companyName} 관련 NAVER Blog/Shopping은 일부 수집되었으나 WebKR homepage·instagram 후보는 부족합니다.`;

    response.diagnosis.scores = {
      overall: hasHomepageCandidate || hasInstagramCandidate ? 32 : 20,
      searchVisibility:
        (hasBlog ? 15 : 0) +
        (hasShopping ? 15 : 0) +
        (hasHomepageCandidate ? 15 : 0) +
        (hasInstagramCandidate ? 10 : 0),
      contentPresence: 0,
      localExposure: response.discovery.counts.regionHits > 0 ? 12 : 0,
      webQuality: hasHomepageCandidate ? 10 : 0,
    };

    response.diagnosis.wins = [];
    if (hasBlog) {
      response.diagnosis.wins.push("NAVER Blog 검색 결과가 실제로 수집되고 있습니다.");
    }
    if (hasShopping) {
      response.diagnosis.wins.push("NAVER Shopping 검색 결과가 실제로 수집되고 있습니다.");
    }
    if (hasHomepageCandidate) {
      response.diagnosis.wins.push("NAVER WebKR에서 homepage 후보가 수집되고 있습니다.");
    }
    if (hasInstagramCandidate) {
      response.diagnosis.wins.push("NAVER WebKR에서 instagram 후보가 수집되고 있습니다.");
    }

    response.diagnosis.risks = [
      "현재 homepage/instagram은 WebKR 후보 단계이며 아직 공식성 검증은 하지 않습니다.",
      "YouTube, PageSpeed, 지도 자산은 아직 연결되지 않았습니다.",
    ];

    response.diagnosis.nextActions = [
      "이 단계가 정상이면 다음으로 YouTube 후보 수집을 붙이세요.",
      "프론트에서 discovery.assets.homepage, discovery.assets.instagram 값이 들어오는지 확인하세요.",
      "debug.candidates.homepage, debug.candidates.instagram 상위 후보가 기대한 값인지 확인하세요.",
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

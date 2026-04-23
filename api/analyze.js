const NAVER_BLOG_API = "https://openapi.naver.com/v1/search/blog.json";
const NAVER_SHOPPING_API = "https://openapi.naver.com/v1/search/shop.json";

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
          reason: "stage 2: not connected",
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
          reason: "stage 2: not connected",
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
          reason: "stage 2: not connected",
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
          reason: "stage 2: not connected",
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
          reason: "stage 2: not connected",
          score: 0,
          candidateCount: 0,
          url: null,
          title: null,
        },
      },
      pageSpeed: {
        ok: false,
        error: "stage 2: not connected",
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
      confidenceDescription: "현재는 NAVER Blog + Shopping 연결 여부만 확인하는 2단계 검증 모드입니다.",
      executiveSummary: "JSON 응답과 NAVER Blog/Shopping 수집 여부를 점검하는 단계입니다.",
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
        "현재는 NAVER Blog + NAVER Shopping만 연결된 2단계 버전입니다.",
      ],
    },
    evidence: [],
    prescription: {
      stage: {
        code: "naver-blog-shopping-stage-2",
        title: "NAVER Blog + Shopping 연결 점검 단계",
        description: "JSON 반환과 NAVER Blog/Shopping 수집만 우선 검증합니다.",
      },
      priorityChannels: ["NAVER Blog", "NAVER Shopping"],
      thirtyDayPlan: [],
      ninetyDayPlan: [],
    },
    debug: {
      stage: "naver-blog-shopping-stage-2",
      env: {
        naverClientId: false,
        naverClientSecret: false,
      },
      queries: {
        blog: [],
        shopping: [],
      },
      requestLog: [],
    },
  };
}

async function fetchNaverJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
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

    if (result.status === 429) {
      break;
    }

    await new Promise((r) => setTimeout(r, 250));
  }

  return rows;
}

function buildStatus(rows) {
  const list = rows || [];
  const rawItems = list.reduce((acc, row) => {
    const items = Array.isArray(row?.data?.items) ? row.data.items : [];
    return acc + items.length;
  }, 0);

  const total = list.reduce((acc, row) => acc + n(row?.data?.total), 0);
  const errors = list
    .map((row) => row?.error)
    .filter(Boolean);

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

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "naver-blog-shopping-stage-2",
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
      [
        input.companyName,
        [input.companyName, input.industry].filter(Boolean).join(" "),
      ].filter(Boolean),
      (x) => x
    );

    const shoppingQueries = uniqBy(
      [
        input.companyName,
        `${input.companyName} 공식`,
      ].filter(Boolean),
      (x) => x
    );

    response.debug.queries.blog = blogQueries;
    response.debug.queries.shopping = shoppingQueries;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      response.discovery.sourceStatus.naverBlog.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverBlog.errorCount = 1;
      response.discovery.sourceStatus.naverShopping.error =
        "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      response.discovery.sourceStatus.naverShopping.errorCount = 1;

      response.diagnosis.confidence = "매우 낮음";
      response.diagnosis.confidenceDescription =
        "NAVER 인증 정보가 없어 Blog/Shopping 검색을 수행하지 못했습니다.";
      response.diagnosis.executiveSummary =
        "현재는 NAVER Blog + Shopping 2단계 검증 모드이며, 인증 정보 누락으로 검색 결과를 가져오지 못했습니다.";
      response.diagnosis.risks = [
        "NAVER Blog API 인증 정보가 없어 검색 결과를 수집하지 못했습니다.",
        "NAVER Shopping API 인증 정보가 없어 검색 결과를 수집하지 못했습니다.",
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

    const blogEvidence = buildBlogEvidence(blogRows);
    const shoppingEvidence = buildShoppingEvidence(shoppingRows);
    const evidence = [...shoppingEvidence, ...blogEvidence];

    response.discovery.sourceStatus.naverBlog = buildStatus(blogRows);
    response.discovery.sourceStatus.naverShopping = buildStatus(shoppingRows);

    response.discovery.counts.naverBlogItems = blogEvidence.length;
    response.discovery.counts.naverShoppingItems = shoppingEvidence.length;
    response.discovery.counts.regionHits = evidence.filter((x) =>
      s(x.title + " " + x.snippet).includes(input.region)
    ).length;

    response.discovery.rawCount.naverBlogFetched = blogEvidence.length;
    response.discovery.rawCount.naverShoppingFetched = shoppingEvidence.length;
    response.discovery.rawCount.evidenceBuilt = evidence.length;

    response.evidence = evidence.slice(0, 12);

    const hasBlog = response.discovery.sourceStatus.naverBlog.rawItems > 0;
    const hasShopping = response.discovery.sourceStatus.naverShopping.rawItems > 0;
    const blogOk = response.discovery.sourceStatus.naverBlog.fetchOk;
    const shoppingOk = response.discovery.sourceStatus.naverShopping.fetchOk;

    response.diagnosis.confidence =
      hasBlog || hasShopping ? "보통" : "낮음";

    response.diagnosis.confidenceDescription =
      hasBlog || hasShopping
        ? "NAVER Blog 또는 Shopping 결과 수집이 정상적으로 수행되었습니다."
        : "JSON은 정상이나 NAVER Blog/Shopping 결과가 부족하거나 일부 요청이 실패했습니다.";

    response.diagnosis.executiveSummary =
      hasBlog || hasShopping
        ? `${input.companyName} 관련 NAVER Blog/Shopping 결과가 수집되었습니다. 현재는 Blog + Shopping만 연결된 2단계 검증 결과입니다.`
        : `${input.companyName} 관련 NAVER Blog/Shopping 결과가 비어 있거나 수집이 불안정합니다.`;

    response.diagnosis.scores = {
      overall: hasBlog || hasShopping ? 24 : 8,
      searchVisibility:
        (hasBlog ? 20 : 0) +
        (hasShopping ? 20 : 0),
      contentPresence: 0,
      localExposure: response.discovery.counts.regionHits > 0 ? 12 : 0,
      webQuality: 0,
    };

    response.diagnosis.wins = [];
    if (hasBlog) {
      response.diagnosis.wins.push("NAVER Blog 검색 결과가 실제로 수집되고 있습니다.");
    }
    if (hasShopping) {
      response.diagnosis.wins.push("NAVER Shopping 검색 결과가 실제로 수집되고 있습니다.");
    }

    response.diagnosis.risks = [
      "현재는 NAVER Blog + Shopping만 연결되어 있어 공식 홈페이지·인스타그램·유튜브 판별은 아직 불가능합니다.",
    ];

    if (!blogOk) {
      response.diagnosis.risks.push("NAVER Blog 요청 중 일부가 실패했을 수 있습니다.");
    }
    if (!shoppingOk) {
      response.diagnosis.risks.push("NAVER Shopping 요청 중 일부가 실패했을 수 있습니다.");
    }

    response.diagnosis.nextActions = [
      "이 단계가 정상이면 다음으로 NAVER WebKR(homepage/instagram 후보)을 붙이세요.",
      "프론트에서 sourceStatus.naverBlog, sourceStatus.naverShopping, evidence 배열이 보이는지 확인하세요.",
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

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8"
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function setHeaders(res) {
  Object.entries({ ...JSON_HEADERS, ...CORS_HEADERS }).forEach(([k, v]) => {
    res.setHeader(k, v);
  });
}

function safeString(v) {
  return String(v || "").trim();
}

function isEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function buildMockResponse(input) {
  return {
    ok: true,
    input,
    discovery: {
      assets: {
        homepage: null,
        instagram: null,
        youtube: null,
        naverStore: null,
        map: null
      },
      assetDetails: {
        homepage: null,
        instagram: null,
        youtube: null,
        naverStore: null,
        map: null
      },
      pageSpeed: null,
      counts: {
        naverBlogItems: 0,
        naverShoppingItems: 0,
        regionHits: 0,
        assetCount: 0
      },
      sourceStatus: {
        naverBlog: { ok: false, total: 0, errorCount: 0 },
        naverShopping: { ok: false, total: 0, errorCount: 0 },
        youtube: { ok: false, candidateCount: 0, error: null },
        pageSpeed: { ok: false }
      }
    },
    diagnosis: {
      industryLabel: input.industry || "일반",
      confidence: "낮음",
      confidenceDescription: "현재는 복구용 안전 응답입니다. 백엔드 연결과 프론트 렌더링만 확인하는 단계입니다.",
      executiveSummary: `${input.companyName || "업체"} 진단 API는 현재 정상적으로 JSON 응답을 반환하고 있습니다. 이제 외부 API를 단계적으로 다시 연결하면 됩니다.`,
      scores: {
        overall: 10,
        searchVisibility: 10,
        contentPresence: 10,
        localExposure: 10,
        webQuality: 10
      },
      wins: [
        "프론트와 백엔드 연결은 정상입니다.",
        "JSON 응답 형식이 복구되었습니다."
      ],
      risks: [
        "현재는 외부 검색 API가 아직 연결되지 않은 복구용 상태입니다."
      ],
      nextActions: [
        "이 상태에서 /api/analyze 응답이 정상인지 먼저 확인하세요.",
        "그 다음 NAVER → YouTube → PageSpeed 순으로 외부 API를 하나씩 붙이세요."
      ],
      limits: [
        "복구용 안전 버전입니다.",
        "실제 검색/추천 로직은 아직 포함하지 않았습니다."
      ]
    },
    evidence: [],
    prescription: {
      stage: {
        code: "recovery",
        title: "복구 단계",
        description: "먼저 API JSON 응답과 프론트 렌더링 정상화를 확인하는 단계입니다."
      },
      priorityChannels: ["백엔드 복구", "응답 스키마 검증"],
      channelPlaybooks: [],
      adPlan: {
        decision: "보류",
        priority: [],
        budgetGuide: "복구 후 검토",
        notes: ["현재는 마케팅 전략보다 기능 복구가 우선입니다."]
      },
      offlinePlan: {
        decision: "보류",
        priority: [],
        whenToUse: [],
        whenNotToUse: ["기능 미복구 상태"],
        budgetGuide: "복구 후 검토"
      },
      kpis: {
        first30Days: ["JSON 응답 정상화", "프론트 렌더링 정상화"],
        first90Days: ["외부 API 단계적 재연결"]
      },
      thirtyDayPlan: [
        {
          week: "즉시",
          action: "복구용 JSON 응답 확인",
          detail: "Network 탭에서 /api/analyze 응답이 JSON인지 확인"
        }
      ],
      ninetyDayPlan: []
    }
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
      mode: "safe-recovery"
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

    const response = buildMockResponse(input);
    return res.status(200).json(response);
  } catch (error) {
    console.error("analyze fatal error:", error);

    return res.status(500).json({
      ok: false,
      message: "analyze failed",
      error: error?.message || "unknown error"
    });
  }
}

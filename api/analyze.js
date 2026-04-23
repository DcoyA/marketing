export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "safe-recovery",
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
      companyName: String(body.companyName || "").trim(),
      industry: String(body.industry || "").trim(),
      region: String(body.region || "").trim(),
      email: String(body.email || "").trim(),
    };

    return res.status(200).json({
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
            reason: "safe recovery mode",
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
            reason: "safe recovery mode",
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
            reason: "safe recovery mode",
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
            reason: "safe recovery mode",
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
            reason: "safe recovery mode",
            score: 0,
            candidateCount: 0,
            url: null,
            title: null,
          },
        },
        pageSpeed: {
          ok: false,
          error: "safe recovery mode",
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
          naverBlog: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: null,
            errorCount: 0,
          },
          naverShopping: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: null,
            errorCount: 0,
          },
          naverWebHomepage: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: null,
            errorCount: 0,
          },
          naverWebInstagram: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: null,
            errorCount: 0,
          },
          youtube: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: null,
            errorCount: 0,
          },
          pageSpeed: {
            fetchOk: false,
            parseOk: false,
            candidateFound: false,
            verified: false,
            total: 0,
            rawItems: 0,
            status: null,
            error: "safe recovery mode",
            errorCount: 1,
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
        confidenceDescription: "안전 복구 모드입니다. 현재는 JSON 응답 복구만 확인합니다.",
        executiveSummary: "API 라우트가 정상적으로 JSON을 반환하는지 확인하기 위한 복구 모드입니다.",
        scores: {
          overall: 0,
          searchVisibility: 0,
          contentPresence: 0,
          localExposure: 0,
          webQuality: 0,
        },
        wins: [],
        risks: [],
        nextActions: [
          "이 응답이 보이면 백엔드 JSON 복구는 완료입니다.",
          "그 다음 NAVER Blog부터 단계적으로 다시 붙이세요.",
        ],
        limits: [
          "현재는 safe recovery mode 입니다.",
        ],
      },
      evidence: [],
      prescription: {
        stage: {
          code: "safe-recovery",
          title: "안전 복구 단계",
          description: "JSON 응답 복구 여부만 확인합니다.",
        },
        priorityChannels: [],
        thirtyDayPlan: [],
        ninetyDayPlan: [],
      },
      debug: {
        stage: "safe-recovery",
      },
    });
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

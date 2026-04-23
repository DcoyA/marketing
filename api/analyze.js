export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      mode: "naver-blog-stage-1",
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

    if (!input.companyName) {
      return res.status(400).json({
        ok: false,
        error: "companyName is required",
        input,
      });
    }

    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || "";
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || "";

    const queries = [
      input.companyName,
      [input.companyName, input.industry].filter(Boolean).join(" "),
      [input.companyName, "후기"].join(" "),
    ].filter(Boolean);

    const uniqueQueries = [...new Set(queries)];

    const sourceStatus = {
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
        error: "not connected",
        errorCount: 0,
      },
    };

    const debug = {
      stage: "naver-blog-stage-1",
      env: {
        naverClientId: !!NAVER_CLIENT_ID,
        naverClientSecret: !!NAVER_CLIENT_SECRET,
      },
      queries: uniqueQueries,
      requestLog: [],
    };

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      sourceStatus.naverBlog.error = "NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing";
      sourceStatus.naverBlog.errorCount = 1;

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
              reason: "stage 1: not connected",
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
              reason: "stage 1: not connected",
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
              reason: "stage 1: not connected",
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
              reason: "stage 1: not connected",
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
              reason: "stage 1: not connected",
              score: 0,
              candidateCount: 0,
              url: null,
              title: null,
            },
          },
          pageSpeed: {
            ok: false,
            error: "stage 1: not connected",
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
          sourceStatus,
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
          confidence: "매우 낮음",
          confidenceDescription: "NAVER Blog 인증 정보가 없어 실제 검색을 수행하지 못했습니다.",
          executiveSummary: "현재는 NAVER Blog 1단계 검증 모드이며, 인증 정보 누락으로 검색 결과를 가져오지 못했습니다.",
          scores: {
            overall: 0,
            searchVisibility: 0,
            contentPresence: 0,
            localExposure: 0,
            webQuality: 0,
          },
          wins: [],
          risks: [
            "NAVER Blog API 인증 정보가 없어 검색 결과를 수집하지 못했습니다.",
          ],
          nextActions: [
            "Vercel 환경변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET를 확인하세요.",
            "환경변수 수정 후 redeploy 하세요.",
          ],
          limits: [
            "현재는 NAVER Blog만 연결된 1단계 버전입니다.",
          ],
        },
        evidence: [],
        prescription: {
          stage: {
            code: "naver-blog-stage-1",
            title: "NAVER Blog 연결 점검 단계",
            description: "JSON 반환과 NAVER Blog 검색 연결만 우선 확인합니다.",
          },
          priorityChannels: ["NAVER Blog"],
          thirtyDayPlan: [],
          ninetyDayPlan: [],
        },
        debug,
      });
    }

    const allItems = [];
    let totalSum = 0;
    let errorCount = 0;
    let finalStatus = 200;
    let fetchOkAll = true;
    let parseOkAll = true;

    for (const query of uniqueQueries) {
      const url =
        "https://openapi.naver.com/v1/search/blog.json" +
        `?query=${encodeURIComponent(query)}&display=10&start=1&sort=sim`;

      const response = await fetch(url, {
        headers: {
          "X-Naver-Client-Id": NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
        },
      });

      finalStatus = response.status;

      let text = "";
      let data = null;

      try {
        text = await response.text();
      } catch (e) {
        text = "";
      }

      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = null;
        parseOkAll = false;
      }

      const items = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total || 0);

      debug.requestLog.push({
        query,
        status: response.status,
        ok: response.ok,
        itemCount: items.length,
        total,
        error:
          data?.errorMessage ||
          data?.error?.message ||
          null,
      });

      if (!response.ok) {
        fetchOkAll = false;
        errorCount += 1;
      }

      totalSum += total;

      for (const item of items) {
        allItems.push({
          query,
          title: String(item?.title || "").replace(/<[^>]*>/g, " ").trim(),
          url: String(item?.link || "").trim(),
          snippet: String(item?.description || "").replace(/<[^>]*>/g, " ").trim(),
          blogName: String(item?.bloggername || "").trim(),
          postDate: String(item?.postdate || "").trim(),
        });
      }
    }

    const deduped = [];
    const seen = new Set();

    for (const item of allItems) {
      const key = item.url;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }

    const evidence = deduped.slice(0, 10).map((item) => ({
      type: "brand-mention",
      source: "naver-blog",
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      score: 38,
      meta: {
        query: item.query,
        blogName: item.blogName,
        postDate: item.postDate,
      },
    }));

    sourceStatus.naverBlog.fetchOk = fetchOkAll;
    sourceStatus.naverBlog.parseOk = parseOkAll;
    sourceStatus.naverBlog.candidateFound = deduped.length > 0;
    sourceStatus.naverBlog.verified = false;
    sourceStatus.naverBlog.total = totalSum;
    sourceStatus.naverBlog.rawItems = deduped.length;
    sourceStatus.naverBlog.status = finalStatus;
    sourceStatus.naverBlog.error =
      errorCount > 0 ? "One or more NAVER Blog requests failed" : null;
    sourceStatus.naverBlog.errorCount = errorCount;

    const confidence =
      deduped.length > 0 && fetchOkAll ? "보통" : "낮음";

    const confidenceDescription =
      deduped.length > 0 && fetchOkAll
        ? "NAVER Blog 결과 수집이 정상적으로 수행되었습니다."
        : "JSON은 정상이나 NAVER Blog 결과가 부족하거나 일부 요청이 실패했습니다.";

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
            reason: "stage 1: not connected",
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
            reason: "stage 1: not connected",
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
            reason: "stage 1: not connected",
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
            reason: "stage 1: not connected",
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
            reason: "stage 1: not connected",
            score: 0,
            candidateCount: 0,
            url: null,
            title: null,
          },
        },
        pageSpeed: {
          ok: false,
          error: "stage 1: not connected",
        },
        counts: {
          naverBlogItems: deduped.length,
          naverShoppingItems: 0,
          naverWebHomepageItems: 0,
          naverWebInstagramItems: 0,
          youtubeItems: 0,
          regionHits: evidence.filter((x) =>
            String(x.title + " " + x.snippet).includes(input.region || "")
          ).length,
          assetCount: 0,
          verifiedAssetCount: 0,
        },
        sourceStatus,
        rawCount: {
          naverBlogFetched: deduped.length,
          naverShoppingFetched: 0,
          naverWebHomepageFetched: 0,
          naverWebInstagramFetched: 0,
          youtubeSearchFetched: 0,
          youtubeChannelFetched: 0,
          evidenceBuilt: evidence.length,
          verifiedAssets: 0,
        },
      },
      diagnosis: {
        industryLabel: input.industry,
        confidence,
        confidenceDescription,
        executiveSummary:
          deduped.length > 0
            ? `${input.companyName} 관련 NAVER Blog 언급이 수집되었습니다. 현재는 Blog만 연결된 1단계 검증 결과입니다.`
            : `${input.companyName} 관련 NAVER Blog 결과가 비어 있거나 수집이 불안정합니다.`,
        scores: {
          overall: deduped.length > 0 ? 18 : 5,
          searchVisibility: deduped.length > 0 ? 35 : 5,
          contentPresence: 0,
          localExposure: evidence.filter((x) =>
            String(x.title + " " + x.snippet).includes(input.region || "")
          ).length > 0 ? 12 : 0,
          webQuality: 0,
        },
        wins:
          deduped.length > 0
            ? ["NAVER Blog 검색 결과가 실제로 수집되고 있습니다."]
            : [],
        risks: [
          "현재는 NAVER Blog만 연결되어 있어 공식 홈페이지·인스타그램·스토어 판별은 아직 불가능합니다.",
        ],
        nextActions: [
          "이 단계가 정상이라면 다음으로 NAVER Shopping을 붙이세요.",
          "프론트에서 sourceStatus.naverBlog와 evidence 배열이 보이는지 확인하세요.",
        ],
        limits: [
          "현재는 NAVER Blog만 연결된 1단계 버전입니다.",
        ],
      },
      evidence,
      prescription: {
        stage: {
          code: "naver-blog-stage-1",
          title: "NAVER Blog 연결 점검 단계",
          description: "JSON 반환과 NAVER Blog 결과 수집만 우선 검증합니다.",
        },
        priorityChannels: ["NAVER Blog"],
        thirtyDayPlan: [],
        ninetyDayPlan: [],
      },
      debug,
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

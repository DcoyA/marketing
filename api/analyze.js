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

    const industryLabelMap = {
      it: "IT / B2B / SaaS",
      local: "소상공인 / 로컬 서비스",
      ecommerce: "이커머스 / 쇼핑몰",
      professional: "전문 서비스 / 컨설팅",
      creator: "지식형 / 콘텐츠형"
    };

    return res.status(200).json({
      input: {
        companyName,
        industry,
        region,
        email
      },
      discovery: {
        assets: {
          homepage: {
            title: `${companyName} 공식 홈페이지 후보`,
            snippet: `${companyName} 관련 대표 웹사이트 후보가 탐색되었습니다.`,
            url: "https://example.com"
          },
          instagram: {
            title: `${companyName} Instagram 후보`,
            snippet: "브랜드명과 유사한 인스타그램 계정 후보가 확인되었습니다.",
            url: "https://instagram.com/example"
          },
          youtube: {
            title: `${companyName} YouTube 채널 후보`,
            snippet: "브랜드 관련 유튜브 채널 후보가 탐색되었습니다.",
            url: "https://youtube.com/@example",
            stats: {
              subscriberCount: 1280,
              videoCount: 24,
              viewCount: 58200
            }
          },
          naverStore: {
            title: `${companyName} NAVER 쇼핑/스토어 후보`,
            snippet: "네이버 쇼핑 또는 스마트스토어 연결 가능성이 있는 후보입니다.",
            url: "https://smartstore.naver.com/example"
          },
          map: {
            title: `${companyName} 지도/플랫폼 후보`,
            snippet: "지역 기반 노출 후보가 확인되었습니다.",
            url: "https://map.naver.com"
          }
        },
        pageSpeed: {
          mobile: 67,
          desktop: 89
        }
      },
      diagnosis: {
        industryLabel: industryLabelMap[industry] || "기타",
        confidence: "중간",
        confidenceDescription: "현재는 프론트 연동 확인을 위한 테스트 진단 응답입니다.",
        executiveSummary: `${companyName}의 초기 진단 UI 연동은 정상이며, 다음 단계로 실제 검색/채널/API 데이터를 연결하면 됩니다.`,
        scores: {
          overall: 68,
          searchVisibility: 64,
          contentPresence: 71,
          localExposure: 55,
          webQuality: 82
        },
        wins: [
          "프론트와 백엔드 API 연결이 정상적으로 작동하고 있습니다.",
          "결과 화면에 필요한 핵심 스키마가 모두 전달됩니다.",
          "다음 단계에서 실제 검색/채널 데이터를 연결할 준비가 되었습니다."
        ],
        risks: [
          "현재 결과는 실제 외부 데이터가 아닌 테스트용 응답입니다.",
          "검색 노출, 유튜브, 네이버 데이터는 아직 실연동 전입니다.",
          "광고 예산 추정이나 전환 분석은 아직 포함되지 않습니다."
        ],
        nextActions: [
          "Google Search API를 먼저 연결해 공식 홈페이지 후보를 실제로 탐색하세요.",
          "NAVER 블로그/쇼핑/지역 API를 순서대로 연결하세요.",
          "YouTube Data API로 채널 통계를 실제 값으로 바꾸세요.",
          "마지막에 Gemini를 붙여 문장 품질을 높이세요."
        ],
        limits: [
          "현재 단계는 UI/라우트 연동 점검용 테스트 응답입니다.",
          "실제 진단 정확도는 외부 API 연동 후 올라갑니다.",
          "동명이인 업체 매칭 로직은 아직 미구현입니다."
        ]
      },
      evidence: [
        {
          title: "프론트-백엔드 연결 성공",
          platform: "System",
          reason: "테스트 응답이 정상적으로 결과 UI에 표시되고 있습니다.",
          url: ""
        },
        {
          title: "환경변수 연결 확인",
          platform: "Server",
          reason: "서버 함수가 정상 실행되며 JSON 응답을 반환합니다.",
          url: ""
        }
      ]
    });
  } catch (error) {
    console.error("mock analyze crash:", error);
    return res.status(500).json({
      error: "server_crash",
      message: error.message || "unknown error"
    });
  }
}

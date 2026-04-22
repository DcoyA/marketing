import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const categoryPrompts = {
  local: `
너는 한국 소상공인 마케팅 진단 전문가다.
분석 대상은 로컬 서비스형 업종이다.

중요하게 볼 기준:
- 지역 기반 검색 노출 가능성
- 대표 서비스 메시지 명확성
- 전화/예약/문의 전환 구조
- 채널 정보 일관성
- 오프라인 방문 유도 요소

반드시 현실적이고 실행 가능한 조언만 제시해라.
절대 이미 실제 외부 사이트 데이터를 읽은 것처럼 말하지 마라.
과장 금지.
`,
  professional: `
너는 한국의 고관여 전문직 마케팅 진단 전문가다.
분석 대상은 병원, 법률, 세무, 부동산 분양, 컨설팅 같은 신뢰 기반 업종이다.

중요하게 볼 기준:
- 전문성/권위 전달력
- 대표 분야 설명 명확성
- 신뢰 요소 존재 여부
- 상담 전환 구조
- 메시지 톤의 신뢰감

반드시 현실적이고 실행 가능한 조언만 제시해라.
절대 이미 실제 외부 사이트 데이터를 읽은 것처럼 말하지 마라.
과장 금지.
`,
  ecommerce: `
너는 한국 이커머스 마케팅 진단 전문가다.

중요하게 볼 기준:
- 상품/브랜드 메시지 명확성
- 구매 유도 구조
- 전환 요소 배치
- 채널 일관성
- 고객 신뢰 요소

반드시 현실적이고 실행 가능한 조언만 제시해라.
절대 이미 실제 외부 사이트 데이터를 읽은 것처럼 말하지 마라.
과장 금지.
`,
  b2b: `
너는 한국 B2B/IT 서비스 마케팅 진단 전문가다.

중요하게 볼 기준:
- 누구를 위한 서비스인지의 명확성
- 문제-해결 구조
- 리드 전환 흐름
- 검색/SEO 적합성
- 신뢰 요소

반드시 현실적이고 실행 가능한 조언만 제시해라.
절대 이미 실제 외부 사이트 데이터를 읽은 것처럼 말하지 마라.
과장 금지.
`,
  knowledge: `
너는 한국 무형 자산/지식 창업형 비즈니스 마케팅 진단 전문가다.

중요하게 볼 기준:
- 브랜드 캐릭터와 메시지
- 팬 전환 구조
- 리드 수집 구조
- 반복 방문 유도 요소
- 채널 일관성

반드시 현실적이고 실행 가능한 조언만 제시해라.
절대 이미 실제 외부 사이트 데이터를 읽은 것처럼 말하지 마라.
과장 금지.
`,
};

const categoryLabelMap = {
  local: "로컬 서비스형",
  professional: "고관여 전문직형",
  ecommerce: "이커머스형",
  b2b: "B2B/IT 서비스형",
  knowledge: "무형 자산/지식 창업형",
};

function cleanJsonText(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function normalizeArray(value, fallback) {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 3);

  if (cleaned.length === 3) return cleaned;
  return fallback;
}

function buildFallback(category, company) {
  const label = categoryLabelMap[category] || "기타";

  return {
    score: 70,
    summaryTitle: `${label} 기준 초기 진단 결과가 생성되었습니다`,
    summaryText: `${company}의 입력 정보 기준으로 보았을 때, 현재는 대표 메시지와 전환 흐름을 우선 정리하는 것이 적절해 보입니다. 실제 채널 데이터 연결 전 단계이므로 초기 방향성 점검 수준으로 이해하는 것이 좋습니다.`,
    messageScore: 68,
    conversionScore: 64,
    consistencyScore: 71,
    issues: [
      "대표 강점이 한 문장으로 명확히 정리되지 않았을 가능성이 있습니다.",
      "문의 또는 전환 유도 흐름이 분산되어 있을 수 있습니다.",
      "채널별 메시지 표현 방식의 일관성이 부족할 수 있습니다."
    ],
    actions: [
      "대표 메시지를 한 줄 가치 제안으로 먼저 정리하세요.",
      "문의·상담·예약 동선을 한 흐름으로 단순화하세요.",
      "홈페이지와 대표 채널의 소개 문구를 동일 기준으로 맞추세요."
    ]
  };
}

function normalizeResult(parsed, category, company) {
  const fallback = buildFallback(category, company);

  return {
    score: clampNumber(parsed?.score, 55, 85, fallback.score),
    summaryTitle: String(parsed?.summaryTitle || fallback.summaryTitle).trim(),
    summaryText: String(parsed?.summaryText || fallback.summaryText).trim(),
    messageScore: clampNumber(parsed?.messageScore, 50, 90, fallback.messageScore),
    conversionScore: clampNumber(parsed?.conversionScore, 50, 90, fallback.conversionScore),
    consistencyScore: clampNumber(parsed?.consistencyScore, 50, 90, fallback.consistencyScore),
    issues: normalizeArray(parsed?.issues, fallback.issues),
    actions: normalizeArray(parsed?.actions, fallback.actions),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const { company, email, url, category } = body;

    if (!company || !email || !url || !category) {
      return res.status(400).json({
        error: "필수 입력값이 누락되었습니다.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY가 설정되지 않았습니다.",
      });
    }

    const categoryPrompt =
      categoryPrompts[category] ||
      `
너는 한국 사업자를 위한 마케팅 진단 전문가다.
실행 가능한 조언만 제시해라.
과장 금지.
절대 이미 외부 데이터를 읽은 것처럼 말하지 마라.
`;

    const prompt = `
${categoryPrompt}

다음 입력값을 바탕으로 "초기 진단" 수준의 마케팅 분석 결과를 작성해라.

[입력 정보]
업체명: ${company}
이메일: ${email}
대표 URL: ${url}
업종 카테고리: ${categoryLabelMap[category] || "기타"}

반드시 아래 JSON 형식으로만 답해라.
JSON 외 텍스트, 설명, 코드블록, 마크다운 절대 금지.

{
  "score": 숫자,
  "summaryTitle": "한 줄 요약 제목",
  "summaryText": "2~3문장 설명",
  "messageScore": 숫자,
  "conversionScore": 숫자,
  "consistencyScore": 숫자,
  "issues": ["문제1", "문제2", "문제3"],
  "actions": ["실행1", "실행2", "실행3"]
}

규칙:
- 모든 값은 한국어
- score는 55~85 사이의 현실적인 숫자
- messageScore, conversionScore, consistencyScore는 50~90 사이 정수
- issues는 정확히 3개
- actions는 정확히 3개
- "실제 사이트를 직접 분석했다", "검색 데이터를 확인했다", "크롤링했다" 같은 표현 금지
- 현재 단계는 URL과 업종을 참고한 초기 진단임을 전제로 작성
- 말투는 실무적이고 간결하게
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: "application/json",
      },
    });

    const rawText = cleanJsonText(response.text || "");

    if (!rawText) {
      const fallback = buildFallback(category, company);
      return res.status(200).json(fallback);
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      const fallback = buildFallback(category, company);
      return res.status(200).json(fallback);
    }

    const normalized = normalizeResult(parsed, category, company);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Gemini analyze error:", error);

    return res.status(500).json({
      error: "분석 중 오류가 발생했습니다.",
    });
  }
}

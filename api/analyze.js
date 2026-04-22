import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
과장 금지.
`,
  professional: `
너는 한국의 고관여 전문직 마케팅 진단 전문가다.
분석 대상은 병원, 법률, 세무, 컨설팅 같은 신뢰 기반 업종이다.
중요하게 볼 기준:
- 전문성/권위 전달력
- 대표 분야 설명 명확성
- 신뢰 요소 존재 여부
- 상담 전환 구조
- 메시지 톤의 신뢰감

반드시 현실적이고 실행 가능한 조언만 제시해라.
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
과장 금지.
`,
};

function getFallbackCategoryLabel(category) {
  const map = {
    local: "로컬 서비스형",
    professional: "고관여 전문직형",
    ecommerce: "이커머스형",
    b2b: "B2B/IT 서비스형",
    knowledge: "무형 자산/지식 창업형",
  };
  return map[category] || "기타";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { company, email, url, category } = req.body || {};

    if (!company || !email || !url || !category) {
      return res.status(400).json({
        error: "필수 입력값이 누락되었습니다.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY가 설정되지 않았습니다.",
      });
    }

    const systemPrompt = categoryPrompts[category] || `
너는 한국 사업자를 위한 마케팅 진단 전문가다.
실행 가능한 조언만 제시해라.
과장 금지.
`;

    const userPrompt = `
다음 사업 정보를 바탕으로 마케팅 진단 결과를 JSON으로만 출력해라.

[입력 정보]
업체명: ${company}
이메일: ${email}
대표 URL: ${url}
업종 카테고리: ${getFallbackCategoryLabel(category)}

반드시 아래 JSON 형식으로만 출력:
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
- 세부 점수(messageScore, conversionScore, consistencyScore)는 50~90 사이 정수
- issues는 정확히 3개
- actions는 정확히 3개
- 마치 이미 외부 API를 크롤링한 것처럼 거짓말하지 마라
- URL과 업종을 참고한 '초기 진단' 수준으로 솔직하게 작성해라
- "추정", "가능성", "우선", "보강 필요" 같은 표현을 사용해도 좋다
- JSON 외 텍스트 절대 출력 금지
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return res.status(500).json({
        error: "AI 응답이 비어 있습니다.",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({
        error: "AI 응답 JSON 파싱에 실패했습니다.",
        raw: text,
      });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    console.error("analyze error:", error);

    return res.status(500).json({
      error: "분석 중 오류가 발생했습니다.",
    });
  }
}

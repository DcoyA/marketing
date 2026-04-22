/* =============================================================
   AI 마케팅 도우미 — main.js
   업종별 분석 로직 · 점수 산출 · PDF · 심층분석
   ============================================================= */

'use strict';

/* ─── 업종 메타데이터 ─────────────────────────────────────── */
const CATEGORIES = {
  local: {
    label: '로컬 서비스형',
    sub: '네이버 지도 기반',
    icon: 'fa-map-location-dot',
    color: '#10B981',
    scoreWeights: {
      '온라인 존재감':   { max: 25, hint: '네이버 지도 · 스마트플레이스 등록 및 최적화 상태' },
      '콘텐츠 활동성':  { max: 20, hint: '블로그 · 인스타 포스팅 주기 및 품질' },
      '리뷰 신뢰도':    { max: 20, hint: '네이버 리뷰 수 · 평점 · 답변율' },
      '전환 장치':      { max: 20, hint: '예약 버튼 · 문의 채널 · 지도 연결 여부' },
      '채널 일관성':    { max: 15, hint: '채널 간 정보 통일 여부 · 브랜드 톤' },
    },
    researchProcess: [
      '네이버 스마트플레이스 등록 여부 및 사진 품질 확인',
      '블로그 포스팅 빈도 · 키워드 최적화 분석',
      '네이버 지도 리뷰 수 · 평점 · 오너 답변율 수집',
      '인스타그램 계정 팔로워 · 최근 활동성 확인',
      '예약 버튼 / 전화 연결 / 카카오 채널 세팅 여부 점검',
    ],
    apiTools: ['Naver Places API', 'Naver Blog Search API', 'Instagram Graph API'],
    problems: {
      low: [
        { title: '스마트플레이스 미최적화', desc: '네이버 지도 상위 노출이 안 되면 로컬 검색 유입이 거의 없습니다.' },
        { title: '리뷰 관리 부재', desc: '리뷰에 답변이 없거나 수가 적으면 신뢰도가 크게 하락합니다.' },
        { title: '예약·문의 동선 부재', desc: '방문 의사가 있어도 바로 행동하게 하는 CTA가 없어 이탈합니다.' },
      ],
      mid: [
        { title: '콘텐츠 주기 불규칙', desc: '포스팅 간격이 고르지 않아 노출 알고리즘에서 낮은 순위를 받습니다.' },
        { title: '리뷰 답변 미흡', desc: '오너 답변이 있는 가게는 재방문율이 평균 23% 높습니다.' },
        { title: '경쟁사 대비 포토 품질 낮음', desc: '첫 이미지 품질이 클릭률에 직결됩니다.' },
      ],
      high: [
        { title: '콘텐츠 다양성 부족', desc: '단일 채널 의존도가 높아 알고리즘 변경에 취약합니다.' },
        { title: '시즌 마케팅 미흡', desc: '계절·이벤트 연계 프로모션이 없어 특수 수요를 놓칩니다.' },
        { title: '채널 간 정보 불일치', desc: '네이버 · 인스타 · 카카오 정보가 달라 소비자 혼란을 야기합니다.' },
      ],
    },
    strategies: {
      short: [
        { title: '스마트플레이스 사진 10장 교체', detail: '밝고 실제 환경을 보여주는 사진으로 교체. 클릭률 최대 40% 개선.' },
        { title: '리뷰 요청 문자 발송', detail: '최근 방문 고객 20명에게 정중한 리뷰 요청 문자 발송.' },
        { title: '예약 링크 추가', detail: '네이버 예약 또는 카카오 예약 연결. 즉시 전환 가능한 동선 확보.' },
      ],
      mid: [
        { title: '주 2회 블로그 포스팅 (지역 키워드 포함)', detail: '"강남 미용실 추천", "홍대 카페 가볼만한 곳" 등 롱테일 키워드 공략.' },
        { title: '인스타 릴스 주 1편', detail: '시술 과정, 제품 언박싱 등 짧은 영상 콘텐츠로 알고리즘 노출 확대.' },
        { title: '단골 리워드 프로그램 시작', detail: '재방문 할인 쿠폰, 도장 카드 등 리텐션 도구 도입.' },
      ],
      long: [
        { title: '블로그 체험단·협찬 기자단 운영', detail: '월 3~5명 체험단 모집으로 콘텐츠 자산 확보 및 SEO 강화.' },
        { title: '지역 인플루언서 협력', detail: '팔로워 1만 이하 로컬 마이크로 인플루언서 협업으로 진정성 높은 노출.' },
        { title: '브랜드 스토리텔링 계정 육성', detail: '대표 or 직원 얼굴이 등장하는 콘텐츠로 팬덤형 충성 고객 형성.' },
      ],
    },
  },

  professional: {
    label: '고관여 전문직형',
    sub: '신뢰 및 권위 기반',
    icon: 'fa-user-tie',
    color: '#4F46E5',
    scoreWeights: {
      '전문성 노출':    { max: 25, hint: '논문·자격·수상·미디어 노출 등 권위 증거' },
      '신뢰 콘텐츠':   { max: 22, hint: '사례 후기 · 비포애프터 · 설명 영상 품질' },
      '온라인 존재감': { max: 18, hint: '공식 사이트 · 구글 검색 노출 여부' },
      '전환 장치':     { max: 20, hint: '상담 예약 · 전화 연결 · 카카오 채널' },
      '채널 일관성':   { max: 15, hint: '홈페이지·블로그·인스타 톤앤매너 통일' },
    },
    researchProcess: [
      '홈페이지 의료진/전문가 소개 및 자격증 노출 확인',
      '구글 및 네이버 검색 브랜드명 노출 상태 분석',
      '블로그 의료 정보 콘텐츠 품질 및 업데이트 빈도',
      '인스타 사례 포스팅 · 후기 갱신 주기',
      '상담 예약 페이지 존재 여부 및 UX 점검',
    ],
    apiTools: ['Google Search Console API', 'Naver Blog API', 'Instagram Graph API'],
    problems: {
      low: [
        { title: '전문성 증거 부족', desc: '자격·수상·논문 등이 노출되지 않으면 신뢰도가 크게 떨어집니다.' },
        { title: '상담 진입 장벽 높음', desc: '첫 상담 신청 버튼이 없거나 복잡하면 잠재 고객이 이탈합니다.' },
        { title: '사례·후기 콘텐츠 부재', desc: '실제 결과를 보여주는 비포애프터·상세 후기가 없습니다.' },
      ],
      mid: [
        { title: '콘텐츠 전문성 낮음', desc: '피상적인 정보성 글은 전문가 이미지 강화에 기여하지 못합니다.' },
        { title: 'SEO 최적화 미흡', desc: '"서울 피부과 추천" 같은 핵심 키워드 상위 노출이 안 됩니다.' },
        { title: '채널 간 톤 불일치', desc: '홈페이지는 정중한데 인스타는 캐주얼하면 브랜드 신뢰가 낮아집니다.' },
      ],
      high: [
        { title: '미디어 노출 전략 없음', desc: '인터뷰·기고·방송 출연 등 외부 권위 획득 채널이 없습니다.' },
        { title: '리뷰 응대 전략 부재', desc: '부정 리뷰에 미대응하거나 방어적 답변은 이미지를 악화합니다.' },
        { title: '차별화 메시지 부재', desc: '"전문가"라는 공통 주장만 있고 왜 당신인지 설득이 없습니다.' },
      ],
    },
    strategies: {
      short: [
        { title: '전문가 소개 페이지 개선', detail: '학력·자격·경력·수상 이력을 정리한 전문가 프로필 페이지 구성.' },
        { title: '무료 상담 진입점 추가', detail: '상단 고정 "무료 상담 신청" 버튼으로 즉각 전환 유도.' },
        { title: '대표 사례 3건 콘텐츠화', detail: '상세한 사례 포스팅 3편 제작. 비포애프터, 프로세스 포함.' },
      ],
      mid: [
        { title: '전문가 칼럼형 블로그 주 1편', detail: '실제 환자·의뢰인 사례 기반의 정보성 콘텐츠로 검색 노출 강화.' },
        { title: '유튜브 Q&A 영상 시리즈', detail: '"가장 많이 받는 질문 TOP 5" 형식의 영상으로 신뢰도 구축.' },
        { title: '구글 마이 비즈니스 최적화', detail: '영문 검색 노출을 위한 구글 계정 완전 세팅 및 영어 리뷰 요청.' },
      ],
      long: [
        { title: '미디어 기고 및 인터뷰 기획', detail: '전문 매체, 유튜브 채널 출연으로 외부 권위 자산 구축.' },
        { title: '북 챕터 or 전자책 출판', detail: '업계 지식을 담은 소책자로 리드 확보 및 전문성 강화.' },
        { title: '학술·연구 콘텐츠 시리즈', detail: '논문 요약, 최신 연구 리뷰 등으로 업계 KOL(Key Opinion Leader) 포지셔닝.' },
      ],
    },
  },

  ecommerce: {
    label: '이커머스형',
    sub: '비주얼 및 성과 광고 기반',
    icon: 'fa-bag-shopping',
    color: '#F59E0B',
    scoreWeights: {
      '광고 성과':       { max: 25, hint: 'Meta · 구글 · 네이버 광고 집행 여부 및 ROAS' },
      '비주얼 콘텐츠':   { max: 22, hint: '상세페이지 · 숏폼 · UGC 품질 및 양' },
      '리뷰 신뢰도':     { max: 18, hint: '리뷰 수 · 실사 후기 · 별점' },
      '전환 최적화':     { max: 20, hint: '장바구니 이탈률 · 반응 속도 · 모바일 UX' },
      '채널 다각화':     { max: 15, hint: '자사몰·스마트스토어·쿠팡 동시 운영 여부' },
    },
    researchProcess: [
      '스마트스토어·쿠팡 등 주요 플랫폼 등록 상태 및 리뷰 수 확인',
      '인스타·페이스북 광고 크리에이티브 분석 (공개 라이브러리)',
      '상세페이지 UX · 모바일 최적화 여부 체크',
      '실제 구매 후기 품질 및 셀러 응답 여부 확인',
      'UGC · 숏폼 콘텐츠 존재 여부 및 조회수 파악',
    ],
    apiTools: ['Meta Ad Library API', 'Naver Commerce API', 'Instagram Graph API'],
    problems: {
      low: [
        { title: '상세페이지 비주얼 품질 부족', desc: '첫 이미지가 약하면 클릭해도 구매로 이어지지 않습니다.' },
        { title: '광고 집행 없음', desc: '유입 채널이 없으면 SEO만으로는 성장에 한계가 있습니다.' },
        { title: '리뷰 수 부족', desc: '리뷰 20개 이하 제품은 전환율이 60% 이상 낮습니다.' },
      ],
      mid: [
        { title: 'UGC 콘텐츠 부재', desc: '실제 사용자 영상·사진이 없으면 신뢰도가 낮습니다.' },
        { title: '광고 ROAS 불명확', desc: '광고 성과를 추적하지 않으면 예산 낭비가 발생합니다.' },
        { title: '모바일 UX 미최적화', desc: '모바일에서 구매 흐름이 복잡하면 이탈률이 급증합니다.' },
      ],
      high: [
        { title: '광고 크리에이티브 소재 부족', desc: '단일 소재 광고는 피로도 누적으로 빠르게 효율이 떨어집니다.' },
        { title: '재구매율 제고 전략 없음', desc: '신규 고객 확보 비용이 재구매 유도 비용의 5~7배입니다.' },
        { title: '채널 단일화 리스크', desc: '단일 플랫폼 의존은 알고리즘 변경에 취약합니다.' },
      ],
    },
    strategies: {
      short: [
        { title: '대표 상품 상세페이지 리뉴얼', detail: '주력 제품 1개의 상세페이지 이미지·카피 전면 교체. ROAS 직결 요소.' },
        { title: '리뷰 요청 자동화', detail: '구매 후 7일 자동 문자로 리뷰 요청 발송. 후기 수 빠른 확보.' },
        { title: 'Meta 광고 테스트 집행', detail: '5만원으로 후킹 문구 3가지 A/B 테스트. 승리 소재 파악 후 확대.' },
      ],
      mid: [
        { title: 'UGC 제작 캠페인', detail: '구매 고객 대상 인증샷 이벤트. 실사 콘텐츠 확보 및 광고 소재화.' },
        { title: '숏폼 광고 소재 월 4편', detail: '15~30초 상품 소개 영상 정기 제작. 숏폼은 일반 이미지보다 CTR 2.5배.' },
        { title: '쿠팡 · 스마트스토어 동시 입점', detail: '플랫폼 다각화로 알고리즘 의존도 낮추고 수익원 분산.' },
      ],
      long: [
        { title: '자사몰 구축 및 이메일 마케팅', detail: '플랫폼 수수료 없는 자사몰 구축 + DB 마케팅으로 LTV 증가.' },
        { title: '인플루언서 제휴 프로그램', detail: '상품 제공 + 수익 분배 구조로 지속적 UGC 생산 체계 구축.' },
        { title: '정기 구독 모델 도입', detail: '건강기능식품·화장품 정기 배송으로 재구매율 및 예측 매출 확보.' },
      ],
    },
  },

  b2b: {
    label: 'B2B / IT 서비스형',
    sub: '논리 및 SEO 기반',
    icon: 'fa-building',
    color: '#06B6D4',
    scoreWeights: {
      'SEO 노출':        { max: 25, hint: '구글·네이버 검색 노출 및 콘텐츠 양' },
      '신뢰 자산':       { max: 22, hint: '케이스스터디 · 고객사 로고 · 수상 이력' },
      '영업 퍼널':       { max: 20, hint: '리드 캡처 양식 · 데모 신청 · 세일즈 팀 정보' },
      '콘텐츠 마케팅':   { max: 18, hint: '블로그·백서·웨비나 등 리드 너처링 콘텐츠' },
      '채널 전문성':     { max: 15, hint: 'LinkedIn · 유튜브 · 뉴스레터 운영 여부' },
    },
    researchProcess: [
      '구글 검색 핵심 키워드 순위 분석 (Google Search Console)',
      '홈페이지 케이스스터디 · 고객사 로고 노출 여부',
      '리드 캡처 양식 · 데모 신청 · 자료 다운로드 흐름 확인',
      'LinkedIn 기업 페이지 팔로워 · 포스팅 주기',
      '블로그·뉴스레터 발행 빈도 및 전문성 수준 분석',
    ],
    apiTools: ['Google Search Console API', 'LinkedIn Marketing API', 'SemRush API (유료)'],
    problems: {
      low: [
        { title: 'SEO 기반 없음', desc: '핵심 키워드 검색 노출이 없으면 B2B 인바운드 리드가 발생하지 않습니다.' },
        { title: '케이스스터디 부재', desc: '도입 사례와 결과 수치가 없으면 의사결정자 설득이 어렵습니다.' },
        { title: '리드 캡처 동선 없음', desc: '방문자가 자료를 받거나 데모를 신청할 수 없습니다.' },
      ],
      mid: [
        { title: '콘텐츠 마케팅 미흡', desc: '블로그·뉴스레터가 없으면 리드 너처링이 불가능합니다.' },
        { title: 'LinkedIn 운영 없음', desc: 'B2B에서 LinkedIn은 최고 ROI 채널임에도 활용이 없습니다.' },
        { title: '가격·패키지 정보 불투명', desc: '가격 정보가 없으면 구매 검토 단계에서 이탈합니다.' },
      ],
      high: [
        { title: '사고 리더십 콘텐츠 부재', desc: '업계 인사이트 공유 없이는 전문 기업 이미지 구축이 어렵습니다.' },
        { title: '파트너십·채널 세일즈 전략 없음', desc: '직접 영업만으로는 성장에 한계가 있습니다.' },
        { title: '영업 자동화 도구 미도입', detail: 'CRM·자동 이메일 시퀀스 없이 수작업 영업은 확장이 불가합니다.' },
      ],
    },
    strategies: {
      short: [
        { title: '고객사 로고 및 후기 섹션 추가', detail: '3~5곳 도입 기업 로고 + 담당자 인용 추가. 즉각적 신뢰도 상승.' },
        { title: '무료 자료 리드 캡처 구축', detail: '"업계 리포트 PDF" 무료 다운로드 대신 이메일 수집. 리드 확보 시작.' },
        { title: '핵심 키워드 3개 블로그 포스팅', detail: '"[솔루션명] 도입 효과", "중소기업 [기능] 자동화" 등 롱테일 SEO 공략.' },
      ],
      mid: [
        { title: '케이스스터디 월 1편', detail: '도입 전후 데이터 비교, 고객사 인터뷰 포함. SEO 및 영업 자료 활용.' },
        { title: 'LinkedIn 기업 페이지 주 3회 포스팅', detail: '업계 인사이트, 팁, 뒤이야기 공유. B2B 구매자 82%가 LinkedIn 활용.' },
        { title: '이메일 너처링 시퀀스 구축', detail: '리드 수집 후 자동 5~7편 교육 이메일 발송으로 구매 준비도 향상.' },
      ],
      long: [
        { title: '웨비나 · 온라인 세미나 정기 개최', detail: '월 1회 업계 주제 웨비나. 리드 확보 + 브랜드 권위 동시 달성.' },
        { title: '파트너·리셀러 프로그램 구축', detail: '관련 업계 파트너를 통한 간접 채널 세일즈로 확장.' },
        { title: 'G2 · 크라우드리뷰 등록', detail: '소프트웨어 리뷰 플랫폼 등록으로 글로벌 인바운드 리드 확보.' },
      ],
    },
  },

  knowledge: {
    label: '무형 자산 / 지식 창업형',
    sub: '팬덤 기반',
    icon: 'fa-lightbulb',
    color: '#8B5CF6',
    scoreWeights: {
      '팬덤 규모':       { max: 25, hint: '팔로워 수 · 구독자 수 · 커뮤니티 참여율' },
      '콘텐츠 품질':    { max: 22, hint: '조회수 · 저장수 · 공유수 · 댓글 밀도' },
      '수익화 구조':    { max: 20, hint: '상품·강의·멤버십 등 수익 채널 다양성' },
      '이메일 리스트':  { max: 18, hint: 'DB 확보 여부 · 뉴스레터 오픈율' },
      '채널 집중도':    { max: 15, hint: '주력 채널 선택과 집중 여부' },
    },
    researchProcess: [
      '유튜브·인스타·블로그 팔로워 및 평균 조회수 확인',
      '최근 3개월 포스팅 저장수·공유수·댓글 수 분석',
      '강의·전자책·멤버십 등 수익 상품 구성 확인',
      '이메일 뉴스레터 발행 여부 및 구독자 수',
      '커뮤니티(오픈채팅·카페·Discord) 운영 여부',
    ],
    apiTools: ['YouTube Data API', 'Instagram Graph API', 'Substack API (비공식)'],
    problems: {
      low: [
        { title: '팔로워 대비 참여율 낮음', desc: '팔로워는 있어도 좋아요·댓글·저장이 없으면 팬덤이 아닙니다.' },
        { title: '수익화 상품 없음', desc: '팔로워를 고객으로 전환할 수 있는 상품이 없습니다.' },
        { title: '이메일 DB 미확보', desc: '플랫폼 알고리즘 변경 시 전체 팬덤을 잃을 수 있습니다.' },
      ],
      mid: [
        { title: '콘텐츠 주제 일관성 부족', desc: '주제가 흩어지면 타겟 팬덤을 구축하기 어렵습니다.' },
        { title: '단일 채널 의존', desc: '유튜브 혹은 인스타만 운영하면 알고리즘 위험에 노출됩니다.' },
        { title: '수익 단일화', desc: '하나의 수익 상품만 있으면 매출 변동 폭이 매우 큽니다.' },
      ],
      high: [
        { title: '커뮤니티 없음', desc: '팬들이 서로 교류할 공간이 없으면 충성도 구축에 한계가 있습니다.' },
        { title: '콜라보·협업 전략 부재', desc: '다른 크리에이터와 협업하지 않으면 새 팔로워 유입이 느립니다.' },
        { title: 'IP(지식재산) 확장 없음', desc: '콘텐츠를 상품화·도서화·라이선스화하는 전략이 없습니다.' },
      ],
    },
    strategies: {
      short: [
        { title: '이메일 뉴스레터 무료 구독 시작', detail: '스티비·메일리 등으로 주 1회 뉴스레터 발행. DB 확보의 첫 단계.' },
        { title: '시그니처 콘텐츠 3편 제작', detail: '저장·공유가 많이 될 "완성형 정보" 콘텐츠로 알고리즘 타기 시작.' },
        { title: '저가형 디지털 상품 출시', detail: '3만원대 전자책 또는 템플릿으로 수익화 첫 경험 + 고객 DB 확보.' },
      ],
      mid: [
        { title: '멤버십 또는 오픈채팅 커뮤니티', detail: '월 9,900~29,000원 멤버십으로 꾸준한 수익과 팬덤 결속.' },
        { title: '유튜브·인스타 크로스포스팅', detail: '하나의 콘텐츠를 숏폼·카드뉴스·블로그로 재가공. 노출 3배 확대.' },
        { title: '콜라보 기획 월 1회', detail: '비슷한 규모 크리에이터와 교차 노출. 팔로워 공유 효과.' },
      ],
      long: [
        { title: '온라인 강의 론칭', detail: '팔로워 피드백 기반의 강의 기획 후 론칭. 고가 수익 모델 구축.' },
        { title: '브랜드·기업 협찬 체계화', detail: '미디어 킷 제작 후 브랜드 제안 능동 접촉으로 협찬 수익 안정화.' },
        { title: '책 출판 또는 전자책 시리즈화', detail: '전문성을 도서로 집약. 오프라인 강연 진출 및 미디어 노출 확대.' },
      ],
    },
  },
};

/* ─── DOM 참조 ───────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const catCards      = document.querySelectorAll('.cat-card');
const btnOptional   = $('btn-optional');
const optionalSec   = $('optional-section');
const btnAnalyze    = $('btn-analyze');
const step1         = $('step-1');
const stepAnalyzing = $('step-analyzing');
const stepResult    = $('step-result');
const btnPdf        = $('btn-pdf');
const btnDeep       = $('btn-deep');
const btnReset      = $('btn-reset');
const modalDeep     = $('modal-deep');
const modalClose    = $('modal-close');
const btnModalSub   = $('btn-modal-submit');

let selectedCat = null;
let analysisResult = null;
let scoreChartInstance = null;

/* ─── 업종 카드 선택 ─────────────────────────────────────── */
catCards.forEach((card) => {
  card.addEventListener('click', () => selectCat(card));
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') selectCat(card); });
});

function selectCat(card) {
  catCards.forEach((c) => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedCat = card.dataset.cat;
}

/* ─── 추가 정보 토글 ─────────────────────────────────────── */
btnOptional.addEventListener('click', () => {
  const visible = optionalSec.style.display !== 'none';
  optionalSec.style.display = visible ? 'none' : 'block';
  btnOptional.innerHTML = visible
    ? '<i class="fa-solid fa-plus"></i> 추가 정보 입력 (선택)'
    : '<i class="fa-solid fa-minus"></i> 추가 정보 닫기';
});

/* ─── 분석 시작 ──────────────────────────────────────────── */
btnAnalyze.addEventListener('click', startAnalysis);

function startAnalysis() {
  const name  = $('biz-name').value.trim();
  const email = $('biz-email').value.trim();

  if (!name) { showError('biz-name', '업체명을 입력해주세요.'); return; }
  if (!email || !isValidEmail(email)) { showError('biz-email', '올바른 이메일을 입력해주세요.'); return; }
  if (!selectedCat) { alert('업종 카테고리를 선택해주세요.'); return; }

  // 1일 1회 제한 (localStorage)
  const today = new Date().toDateString();
  const lastUsed = localStorage.getItem('ai_marketing_last_used');
  if (lastUsed === today) {
    const bypass = confirm('오늘 이미 진단을 사용하셨습니다.\n(개발/테스트 모드) 다시 진행할까요?');
    if (!bypass) return;
  }
  localStorage.setItem('ai_marketing_last_used', today);

  // 화면 전환
  step1.style.display = 'none';
  stepAnalyzing.style.display = 'block';
  stepResult.style.display = 'none';

  // 분석 시뮬레이션
  runAnalysis(name, email, selectedCat);
}

function showError(fieldId, msg) {
  const el = $(fieldId);
  el.style.borderColor = '#EF4444';
  el.placeholder = msg;
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; el.placeholder = ''; }, 3000);
}

function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ─── 분석 프로세스 시뮬레이션 ───────────────────────────── */
async function runAnalysis(name, email, catKey) {
  const steps = [
    { id: 'astep-1', msg: '업종 기준 데이터 로드 중...', progress: 20 },
    { id: 'astep-2', msg: '채널 현황 진단 중...', progress: 50 },
    { id: 'astep-3', msg: '마케팅 점수 산출 중...', progress: 78 },
    { id: 'astep-4', msg: '전략 리포트 생성 중...', progress: 100 },
  ];

  const progressBar   = $('progress-bar');
  const analyzingStatus = $('analyzing-status');

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    analyzingStatus.textContent = s.msg;
    progressBar.style.width = s.progress + '%';

    // 이전 완료
    if (i > 0) {
      const prev = $(steps[i - 1].id);
      prev.classList.add('done');
      prev.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${prev.textContent.replace(/^.*?\s/, '')}`;
    }

    // 현재 활성
    const cur = $(s.id);
    cur.classList.remove('pending');
    cur.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${cur.textContent.replace(/^.*?\s/, '')}`;

    await sleep(900 + Math.random() * 600);
  }

  // 마지막 완료
  const last = $('astep-4');
  last.classList.add('done');
  last.innerHTML = `<i class="fa-solid fa-circle-check"></i> 전략 리포트 생성`;

  await sleep(400);

  // 결과 계산 및 저장
  analysisResult = computeResult(name, email, catKey);

  // DB 저장
  saveToTable(analysisResult);

  // 화면 전환
  stepAnalyzing.style.display = 'none';
  renderResult(analysisResult);
  stepResult.style.display = 'block';
  stepResult.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ─── 점수 계산 ──────────────────────────────────────────── */
function computeResult(name, email, catKey) {
  const cat = CATEGORIES[catKey];
  const weights = cat.scoreWeights;

  // 업종별 기준치 ± 랜덤 (현실적 시뮬레이션)
  const baseRanges = {
    local:        [45, 70],
    professional: [40, 65],
    ecommerce:    [50, 75],
    b2b:          [35, 60],
    knowledge:    [40, 68],
  };
  const [lo, hi] = baseRanges[catKey];
  const totalScore = Math.round(lo + Math.random() * (hi - lo));

  // 항목별 점수 배분
  const breakdown = {};
  let remaining = totalScore;
  const keys = Object.keys(weights);
  keys.forEach((k, i) => {
    const maxPossible = weights[k].max;
    if (i === keys.length - 1) {
      breakdown[k] = { score: Math.max(0, remaining), max: maxPossible };
    } else {
      const ratio = totalScore / 100;
      const base = Math.round(maxPossible * ratio);
      const variance = Math.round((Math.random() - 0.5) * maxPossible * 0.3);
      const score = Math.max(0, Math.min(maxPossible, base + variance));
      breakdown[k] = { score, max: maxPossible };
      remaining -= score;
    }
  });

  // 문제 선택
  let problemSet;
  if (totalScore < 45) problemSet = cat.problems.low;
  else if (totalScore < 65) problemSet = cat.problems.mid;
  else problemSet = cat.problems.high;

  return {
    name, email, catKey,
    catLabel: cat.label,
    catSub: cat.sub,
    color: cat.color,
    totalScore,
    breakdown,
    problems: problemSet,
    strategies: cat.strategies,
    date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

/* ─── 결과 렌더링 ────────────────────────────────────────── */
function renderResult(r) {
  // 기본 정보
  $('result-biz-name').textContent = r.name;
  $('result-cat-label').textContent = `${r.catLabel} · ${r.catSub}`;
  $('result-date').textContent = `진단일: ${r.date}`;

  // 점수 배지
  const badge = $('result-badge');
  badge.textContent = r.totalScore >= 70 ? '✅ 양호' : r.totalScore >= 50 ? '⚠️ 개선 필요' : '🔴 즉시 개선 필요';
  badge.style.background = r.totalScore >= 70 ? '#10B981' : r.totalScore >= 50 ? '#F59E0B' : '#EF4444';

  // 도넛 차트
  renderScoreChart(r.totalScore, r.color);

  // 항목별 점수
  renderBreakdown(r.breakdown, r.color);

  // 핵심 문제
  renderProblems(r.problems);

  // 전략
  renderStrategy('short', r.strategies);

  // 전략 탭 이벤트
  document.querySelectorAll('.stab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.stab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderStrategy(btn.dataset.tab, r.strategies);
    });
  });
}

function renderScoreChart(score, color) {
  const canvas = $('scoreChart');
  if (scoreChartInstance) { scoreChartInstance.destroy(); }

  const remaining = 100 - score;
  scoreChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [score, remaining],
        backgroundColor: [color, '#F3F4F6'],
        borderWidth: 0,
        circumference: 360,
      }],
    },
    options: {
      cutout: '74%',
      animation: { duration: 1200, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
    },
  });

  // 숫자 카운트 애니메이션
  animateCount($('score-num'), 0, score, 1200);
}

function animateCount(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    el.textContent = Math.round(from + (to - from) * easeOutQuart(progress));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function renderBreakdown(breakdown, color) {
  const grid = $('breakdown-grid');
  grid.innerHTML = '';
  Object.entries(breakdown).forEach(([key, val]) => {
    const pct = Math.round((val.score / val.max) * 100);
    const barColor = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
    grid.innerHTML += `
      <div class="breakdown-item">
        <span class="breakdown-label">${key}</span>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${pct}%;background:${barColor};"></div>
        </div>
        <span class="breakdown-score">${val.score}<small>/${val.max}</small></span>
      </div>`;
  });
}

function renderProblems(problems) {
  const grid = $('problems-grid');
  grid.innerHTML = '';
  problems.forEach((p, i) => {
    grid.innerHTML += `
      <div class="problem-card">
        <div class="problem-num">PROBLEM ${i + 1}</div>
        <div class="problem-title">${p.title}</div>
        <div class="problem-desc">${p.desc}</div>
      </div>`;
  });
}

function renderStrategy(tab, strategies) {
  const content = $('strategy-content');
  content.innerHTML = '';
  const icons = { short: 'fa-bolt', mid: 'fa-chart-line', long: 'fa-rocket' };
  strategies[tab].forEach((s) => {
    content.innerHTML += `
      <div class="strategy-item">
        <i class="fa-solid ${icons[tab]}"></i>
        <div class="strategy-item-text">
          <strong>${s.title}</strong>
          <span>${s.detail}</span>
        </div>
      </div>`;
  });
}

/* ─── DB 저장 (Table API) ────────────────────────────────── */
async function saveToTable(r) {
  try {
    await fetch('tables/marketing_diagnoses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biz_name:    r.name,
        email:       r.email,
        category:    r.catKey,
        cat_label:   r.catLabel,
        total_score: r.totalScore,
        diagnosis_date: r.date,
      }),
    });
  } catch (e) {
    // 저장 실패해도 UX에 영향 없음
    console.warn('DB 저장 실패:', e);
  }
}

/* ─── PDF 내려받기 ───────────────────────────────────────── */
btnPdf.addEventListener('click', generatePDF);

async function generatePDF() {
  if (!analysisResult) return;
  const r = analysisResult;

  btnPdf.disabled = true;
  btnPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PDF 생성 중...';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = 210;
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 20;

    // 헬퍼
    const line = (thickness = 0.3, color = [220, 220, 220]) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(thickness);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    };
    const text = (str, x, size, style = 'normal', color = [31, 41, 55]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      doc.setTextColor(...color);
      doc.text(str, x, y);
    };
    const nextLine = (n = 6) => { y += n; };

    // ─ 헤더
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('AI Marketing Report', margin, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('AI Marketing Assistant — Powered by HelloMedia', margin, 24);

    y = 40;

    // ─ 기본 정보
    text(`Business: ${r.name}`, margin, 13, 'bold', [31, 41, 55]);
    nextLine(7);
    text(`Category: ${r.catLabel}`, margin, 10, 'normal', [75, 85, 99]);
    nextLine(6);
    text(`Date: ${r.date}`, margin, 10, 'normal', [75, 85, 99]);
    nextLine(8);
    line();

    // ─ 총점
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y, contentW, 22, 4, 4, 'F');
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(79, 70, 229);
    doc.text(`${r.totalScore}`, margin + 8, y + 15);
    doc.setFontSize(11);
    doc.setTextColor(75, 85, 99);
    doc.text('/ 100  Marketing Score', margin + 26, y + 15);
    y += 28;
    line();

    // ─ 항목별
    text('Score Breakdown', margin, 12, 'bold', [31, 41, 55]);
    nextLine(7);
    Object.entries(r.breakdown).forEach(([k, v]) => {
      const pct = Math.round((v.score / v.max) * 100);
      const barColor = pct >= 70 ? [16, 185, 129] : pct >= 50 ? [245, 158, 11] : [239, 68, 68];
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text(k, margin, y);
      doc.text(`${v.score}/${v.max}`, pageW - margin - 14, y);
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(margin + 56, y - 3.5, contentW - 70, 5, 2, 2, 'F');
      doc.setFillColor(...barColor);
      doc.roundedRect(margin + 56, y - 3.5, (contentW - 70) * (pct / 100), 5, 2, 2, 'F');
      y += 8;
    });
    nextLine(4);
    line();

    // ─ 핵심 문제
    text('Key Problems', margin, 12, 'bold', [31, 41, 55]);
    nextLine(7);
    r.problems.forEach((p, i) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(239, 68, 68);
      doc.text(`${i + 1}. ${p.title}`, margin, y);
      nextLine(5.5);
      const desc = doc.splitTextToSize(p.desc, contentW - 8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text(desc, margin + 4, y);
      y += desc.length * 5 + 3;
    });
    line();

    // ─ 전략 (단기)
    text('Short-term Strategy (2 weeks)', margin, 12, 'bold', [31, 41, 55]);
    nextLine(7);
    r.strategies.short.forEach((s) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(`• ${s.title}`, margin, y);
      nextLine(5.5);
      const det = doc.splitTextToSize(s.detail, contentW - 8);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(75, 85, 99);
      doc.text(det, margin + 4, y);
      y += det.length * 5 + 4;
      if (y > 270) { doc.addPage(); y = 20; }
    });

    // ─ 푸터
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`AI Marketing Assistant | Page ${i} of ${total}`, margin, 292);
    }

    doc.save(`마케팅진단_${r.name}_${r.date}.pdf`);
  } catch (err) {
    console.error(err);
    alert('PDF 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    btnPdf.disabled = false;
    btnPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF 리포트 내려받기';
  }
}

/* ─── 심층 분석 모달 ─────────────────────────────────────── */
btnDeep.addEventListener('click', () => { modalDeep.style.display = 'flex'; });
modalClose.addEventListener('click', closeModal);
modalDeep.addEventListener('click', (e) => { if (e.target === modalDeep) closeModal(); });
function closeModal() {
  modalDeep.style.display = 'none';
  $('modal-success').style.display = 'none';
  document.querySelector('.modal-form').style.display = 'flex';
}

btnModalSub.addEventListener('click', async () => {
  if (!analysisResult) return;
  btnModalSub.disabled = true;
  btnModalSub.textContent = '신청 중...';

  try {
    await fetch('tables/deep_analysis_requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biz_name:  analysisResult.name,
        email:     analysisResult.email,
        category:  analysisResult.catLabel,
        score:     analysisResult.totalScore,
        phone:     $('modal-phone').value.trim(),
        message:   $('modal-message').value.trim(),
        requested_at: new Date().toISOString(),
      }),
    });
  } catch (e) { console.warn('심층분석 저장 실패:', e); }

  document.querySelector('.modal-form').style.display = 'none';
  $('modal-success').style.display = 'block';
  btnModalSub.disabled = false;
  btnModalSub.textContent = '심층 분석 신청';
});

/* ─── 초기화 ─────────────────────────────────────────────── */
btnReset.addEventListener('click', () => {
  step1.style.display = 'block';
  stepAnalyzing.style.display = 'none';
  stepResult.style.display = 'none';
  analysisResult = null;
  selectedCat = null;
  catCards.forEach((c) => c.classList.remove('selected'));
  $('biz-name').value = '';
  $('biz-email').value = '';
  $('biz-url').value = '';
  $('biz-concern').value = '';
  optionalSec.style.display = 'none';
  btnOptional.innerHTML = '<i class="fa-solid fa-plus"></i> 추가 정보 입력 (선택)';

  // 분석 단계 리셋
  ['astep-1','astep-2','astep-3','astep-4'].forEach((id, i) => {
    const labels = ['업종 기준 데이터 로드', '채널 현황 진단', '마케팅 점수 산출', '전략 리포트 생성'];
    const el = $(id);
    el.className = 'astep' + (i > 0 ? ' pending' : '');
    el.innerHTML = i === 0
      ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${labels[i]}`
      : `<i class="fa-regular fa-circle"></i> ${labels[i]}`;
  });

  step1.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

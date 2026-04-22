# AI 마케팅 도우미

> 소상공인·개인 사업자를 위한 60초 AI 마케팅 진단 서비스  
> 로그인 없이, 업체명·이메일·업종만 입력하면 마케팅 점수 + 핵심 문제 + 실행 전략 + PDF 리포트를 즉시 제공합니다.

---

## ✅ 현재 완성된 기능

| 기능 | 설명 |
|------|------|
| **업종 카드 선택 UI** | 5개 카테고리 아이콘 카드 (로컬서비스형, 고관여전문직형, 이커머스형, B2B/IT, 지식창업형) |
| **입력 폼** | 업체명, 이메일 (필수), URL·고민 (선택) |
| **분석 프로세스** | 4단계 시각적 진행 애니메이션 + 진행률 바 |
| **마케팅 점수** | 도넛 차트 + 카운터 애니메이션 (100점 기준) |
| **항목별 점수** | 업종별 가중치 적용 점수 바 |
| **핵심 문제 3개** | 점수 구간별 맞춤 문제 출력 |
| **단기/중기/장기 전략** | 탭 전환형 맞춤 실행 전략 |
| **PDF 내려받기** | jsPDF 기반 A4 리포트 즉시 생성 |
| **심층 분석 요청** | 모달 → DB 저장 |
| **1일 1회 제한** | localStorage 기반 |
| **DB 저장** | 진단 결과 및 심층분석 신청 Table API 연동 |

---

## 📁 파일 구조

```
index.html          ← 메인 실행 페이지 (입력→분석→결과 올인원)
css/style.css       ← 흰색 배경 미니멀 스타일 (인디고 계열 포인트)
js/main.js          ← 전체 비즈니스 로직
README.md           ← 이 파일
```

---

## 🔗 주요 엔드포인트

| 경로 | 역할 |
|------|------|
| `GET /`              | 메인 진단 페이지 |
| `POST tables/marketing_diagnoses`       | 진단 결과 저장 |
| `POST tables/deep_analysis_requests`    | 심층분석 신청 저장 |
| `GET  tables/marketing_diagnoses`       | 관리자용 데이터 조회 |

---

## 📊 데이터 모델

### `marketing_diagnoses`
| 필드 | 타입 | 설명 |
|------|------|------|
| id | text | UUID |
| biz_name | text | 업체명 |
| email | text | 이메일 |
| category | text | local / professional / ecommerce / b2b / knowledge |
| cat_label | text | 업종 한글명 |
| total_score | number | 0~100 |
| diagnosis_date | text | 진단 날짜 |

### `deep_analysis_requests`
| 필드 | 타입 | 설명 |
|------|------|------|
| id | text | UUID |
| biz_name | text | 업체명 |
| email | text | 이메일 |
| category | text | 업종 카테고리 |
| score | number | 진단 점수 |
| phone | text | 연락처 (선택) |
| message | text | 추가 메시지 (선택) |
| requested_at | datetime | 신청 시각 |

---

## 🔌 실제 서비스 전환 시 API 연결 방식

### 업종별 리서치 프로세스 및 권장 API

#### 1. 로컬 서비스형 (식당·카페·미용실·헬스장 등)
**목표:** 네이버 지도 중심의 로컬 온라인 존재감 진단

| 분석 항목 | 사용 API/도구 | 비고 |
|-----------|--------------|------|
| 스마트플레이스 등록/리뷰 | **Naver Places API** | 공식 제공, 검색 노출 및 리뷰 수 |
| 블로그 포스팅 현황 | **Naver Blog Search API** | 업체명 검색 결과 수 파악 |
| 인스타 팔로워/활동성 | **Instagram Graph API** | 프로페셔널 계정 필요 |
| 구글 지도 리뷰 | **Google Places API** | 리뷰 수·평점 |

**구현 예시 (백엔드 필요):**
```javascript
// 네이버 장소 검색 (서버사이드)
const naverSearch = await fetch(
  `https://openapi.naver.com/v1/search/local.json?query=${bizName}`,
  { headers: { 'X-Naver-Client-Id': CLIENT_ID, 'X-Naver-Client-Secret': SECRET } }
);
```

---

#### 2. 고관여 전문직형 (병원·법률·세무·부동산)
**목표:** 전문성·신뢰도 기반의 검색 노출 및 권위 자산 진단

| 분석 항목 | 사용 API/도구 | 비고 |
|-----------|--------------|------|
| 구글 검색 노출 | **Google Search Console API** | 소유권 확인 필요 |
| 홈페이지 품질 분석 | **PageSpeed Insights API** | 무료, 키 불필요 |
| 블로그 콘텐츠 | **Naver Blog API** | 키워드 노출 빈도 |
| 인스타 팔로워/후기 | **Instagram Graph API** | — |

---

#### 3. 이커머스형 (의류·화장품·건강기능식품)
**목표:** 광고 크리에이티브·리뷰·전환 최적화 진단

| 분석 항목 | 사용 API/도구 | 비고 |
|-----------|--------------|------|
| Meta 광고 집행 현황 | **Meta Ad Library API** | 무료, 공개 데이터 |
| 스마트스토어 리뷰 | **Naver Commerce API** | 파트너 신청 필요 |
| 인스타 UGC 현황 | **Instagram Graph API** | — |
| 상세페이지 UX | **PageSpeed Insights API** | 모바일 점수 체크 |

**Meta Ad Library 예시 (클라이언트사이드 가능):**
```javascript
const res = await fetch(
  `https://graph.facebook.com/v18.0/ads_archive?search_terms=${encodeURIComponent(bizName)}&ad_type=ALL&access_token=${TOKEN}`
);
```

---

#### 4. B2B / IT 서비스형 (SaaS·제조·대행사)
**목표:** SEO 노출·리드 캡처·신뢰 자산 진단

| 분석 항목 | 사용 API/도구 | 비고 |
|-----------|--------------|------|
| 구글 검색 순위 | **Google Search Console API** | 소유권 확인 필요 |
| 도메인 권위도 | **Moz API / SEMrush API** | 유료 |
| LinkedIn 팔로워 | **LinkedIn Marketing API** | 광고 계정 필요 |
| 사이트 기술 분석 | **BuiltWith API** | 유료 |

---

#### 5. 무형 자산 / 지식 창업형 (유튜버·강의·전자책)
**목표:** 팔로워 품질·수익화 구조·콘텐츠 참여율 진단

| 분석 항목 | 사용 API/도구 | 비고 |
|-----------|--------------|------|
| 유튜브 구독자/조회수 | **YouTube Data API v3** | 무료 할당량 있음 |
| 인스타 참여율 | **Instagram Graph API** | 프로페셔널 계정 |
| 뉴스레터 지표 | 스티비/메일리 API | 플랫폼별 상이 |
| 강의 플랫폼 리뷰 | 클래스101/탈잉 크롤링 | 비공식 |

---

### 현재 구현 방식 (MVP)
현재는 백엔드 없이 **규칙 기반 점수 시뮬레이션**으로 동작합니다.
업종별 기준치 범위에 랜덤 변동을 적용하여 현실적인 점수와 맞춤 전략을 생성합니다.

실제 서비스 전환 시 흐름:
```
사용자 입력 (업체명, URL) 
  → [서버] URL 크롤링 + 외부 API 호출 
  → 실제 데이터 기반 점수 계산 
  → 프론트엔드로 JSON 결과 반환 
  → 결과 렌더링 + PDF 생성
```

---

## 🚀 미구현 / 다음 단계

- [ ] 실제 외부 API 연동 (Naver, Google, Instagram, Meta)
- [ ] URL 입력 시 OG 태그·메타 정보 자동 수집
- [ ] 이메일 자동 발송 (리포트 PDF 첨부)
- [ ] 관리자 대시보드 (진단 이력 조회)
- [ ] Cloudflare Turnstile 봇 차단 강화
- [ ] IP 기반 서버사이드 1일 1회 제한
- [ ] 심층 분석 결과 자동 이메일 전송 알림

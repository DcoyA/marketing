const categoryCards = document.querySelectorAll(".category-card");
const form = document.getElementById("analysisForm");

const idleState = document.getElementById("idleState");
const loadingState = document.getElementById("loadingState");
const resultState = document.getElementById("resultState");

const statusBadge = document.getElementById("statusBadge");
const loadingText = document.getElementById("loadingText");
const progressFill = document.getElementById("progressFill");
const progressPercent = document.getElementById("progressPercent");

const scoreValue = document.getElementById("scoreValue");
const scoreRing = document.getElementById("scoreRing");

const selectedCategoryText = document.getElementById("selectedCategoryText");
const summaryTitle = document.getElementById("summaryTitle");
const summaryText = document.getElementById("summaryText");

const issueList = document.getElementById("issueList");
const actionList = document.getElementById("actionList");
const scopeList = document.getElementById("scopeList");
const upgradeList = document.getElementById("upgradeList");
const connectionTags = document.getElementById("connectionTags");

const barMessage = document.getElementById("barMessage");
const barConversion = document.getElementById("barConversion");
const barConsistency = document.getElementById("barConsistency");

const numMessage = document.getElementById("numMessage");
const numConversion = document.getElementById("numConversion");
const numConsistency = document.getElementById("numConsistency");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");

const connectChannelBtn = document.getElementById("connectChannelBtn");
const connectWebBtn = document.getElementById("connectWebBtn");
const deepBtn = document.getElementById("deepBtn");

let selectedCategory = "";

const categoryLabelMap = {
  local: "로컬 서비스형",
  professional: "고관여 전문직형",
  ecommerce: "이커머스형",
  b2b: "B2B/IT 서비스형",
  knowledge: "무형 자산/지식 창업형",
};

const connectionMap = {
  local: [
    "Google Business Profile",
    "Instagram",
    "GA4",
    "Search Console",
    "홈페이지"
  ],
  professional: [
    "홈페이지",
    "GA4",
    "Search Console",
    "YouTube",
    "Instagram"
  ],
  ecommerce: [
    "쇼핑몰 URL",
    "GA4",
    "Google Ads",
    "Meta Ads",
    "Instagram",
    "YouTube"
  ],
  b2b: [
    "홈페이지",
    "GA4",
    "Search Console",
    "YouTube",
    "Instagram",
    "Google Ads",
    "Meta Ads"
  ],
  knowledge: [
    "홈페이지",
    "YouTube",
    "Instagram",
    "GA4",
    "Search Console"
  ],
};

const currentScopeMap = {
  local: [
    "입력한 업체명과 업종 기준의 초기 방향성 확인",
    "로컬 서비스형에 적합한 기본 메시지/전환 구조 가설 제시",
    "현재 단계에서 필요한 정밀 분석 연결 항목 안내"
  ],
  professional: [
    "신뢰/권위 기반 업종에 맞는 초기 메시지 구조 가설 제시",
    "상담 전환 구조 관점의 1차 점검",
    "정밀 분석 전 필요한 웹/채널 연결 항목 안내"
  ],
  ecommerce: [
    "이커머스 업종에 맞는 초기 전환 구조 가설 제시",
    "상품/브랜드 메시지 방향에 대한 1차 점검",
    "광고/웹/채널 연동 전 단계의 우선순위 안내"
  ],
  b2b: [
    "B2B/IT 서비스 기준의 초기 메시지/전환 흐름 가설 제시",
    "검색/리드 관점의 1차 정비 포인트 제안",
    "정밀 운영 진단에 필요한 연결 항목 안내"
  ],
  knowledge: [
    "지식형 비즈니스 기준의 초기 브랜드/전환 구조 가설 제시",
    "콘텐츠-리드 연결 관점의 1차 점검",
    "정밀 분석 전 채널 연결 우선순위 안내"
  ],
};

const upgradeScopeMap = {
  local: [
    "지도/프로필 노출 상태",
    "리뷰/행동 전환 지표",
    "예약·전화·웹사이트 클릭 구조",
    "지역 검색 기반 확장 전략"
  ],
  professional: [
    "검색 유입/랜딩 구조",
    "상담 전환 흐름",
    "콘텐츠/채널 신뢰도 평가",
    "광고·리드 확장 전략"
  ],
  ecommerce: [
    "광고 채널별 효율",
    "전환 흐름과 장바구니/구매 구조",
    "채널별 반응과 상세페이지 문제",
    "예산 시나리오 기반 확장 전략"
  ],
  b2b: [
    "YouTube/Instagram 운영 여부 및 성과 비교",
    "검색 유입과 리드 구조",
    "광고 예산 시뮬레이션",
    "콘텐츠 효율과 성장성 판단"
  ],
  knowledge: [
    "채널별 조회/반응 구조",
    "콘텐츠 성과와 반복 소비 구조",
    "리드/구독 전환 흐름",
    "성장성 및 확장 전략"
  ],
};

categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    categoryCards.forEach((el) => el.classList.remove("selected"));
    card.classList.add("selected");
    selectedCategory = card.dataset.category;
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const company = document.getElementById("company").value.trim();
  const email = document.getElementById("email").value.trim();
  const url = document.getElementById("url").value.trim();

  if (!company) {
    alert("업체명을 입력하세요.");
    return;
  }

  if (!email) {
    alert("이메일을 입력하세요.");
    return;
  }

  if (!isValidEmail(email)) {
    alert("올바른 이메일 형식을 입력하세요.");
    return;
  }

  if (!url) {
    alert("웹사이트 또는 대표 채널 URL을 입력하세요.");
    return;
  }

  if (!selectedCategory) {
    alert("업종 카테고리를 선택하세요.");
    return;
  }

  showLoading();

  try {
    fakeProgressSequence();

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company,
        email,
        url,
        category: selectedCategory,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "진단 요청에 실패했습니다.");
    }

    renderResult(company, selectedCategory, data);
  } catch (error) {
    console.error(error);
    loadingState.classList.add("hidden");
    idleState.classList.remove("hidden");
    statusBadge.textContent = "오류";
    alert(error.message || "오류가 발생했습니다.");
  }
});

function showLoading() {
  idleState.classList.add("hidden");
  resultState.classList.add("hidden");
  loadingState.classList.remove("hidden");

  statusBadge.textContent = "진단 중";
  resetSteps();
  updateProgress(8, "입력값을 확인하고 있습니다...");
}

function fakeProgressSequence() {
  const steps = [
    { percent: 18, text: "입력 정보 검증 중...", active: 1, delay: 300 },
    { percent: 42, text: "업종 기준 초기 진단 준비 중...", active: 2, delay: 900 },
    { percent: 70, text: "초기 진단 결과를 구성 중...", active: 3, delay: 1600 },
    { percent: 92, text: "정밀 분석 준비 항목을 정리 중...", active: 4, delay: 2300 },
  ];

  steps.forEach((item) => {
    setTimeout(() => {
      updateProgress(item.percent, item.text);
      setActiveStep(item.active);
    }, item.delay);
  });
}

function renderResult(company, categoryKey, data) {
  loadingState.classList.add("hidden");
  resultState.classList.remove("hidden");

  statusBadge.textContent = "완료";
  selectedCategoryText.textContent = categoryLabelMap[categoryKey] || "기타";

  summaryTitle.textContent =
    data.summaryTitle || "초기 진단 결과가 생성되었습니다";
  summaryText.textContent =
    data.summaryText ||
    "입력한 정보 기준으로 현재 단계에서 가능한 초기 진단 결과를 생성했습니다.";

  issueList.innerHTML = "";
  actionList.innerHTML = "";
  scopeList.innerHTML = "";
  upgradeList.innerHTML = "";
  connectionTags.innerHTML = "";

  (data.issues || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    issueList.appendChild(li);
  });

  (data.actions || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    actionList.appendChild(li);
  });

  (currentScopeMap[categoryKey] || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    scopeList.appendChild(li);
  });

  (upgradeScopeMap[categoryKey] || []).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    upgradeList.appendChild(li);
  });

  (connectionMap[categoryKey] || []).forEach((item) => {
    const tag = document.createElement("div");
    tag.className = "connection-tag";
    tag.textContent = item;
    connectionTags.appendChild(tag);
  });

  const score = safeNumber(data.score, 70);
  const messageScore = safeNumber(data.messageScore, 68);
  const conversionScore = safeNumber(data.conversionScore, 64);
  const consistencyScore = safeNumber(data.consistencyScore, 71);

  animateNumber(scoreValue, 0, score, 700);
  setScoreRing(score);

  setBar(barMessage, numMessage, messageScore);
  setBar(barConversion, numConversion, conversionScore);
  setBar(barConsistency, numConsistency, consistencyScore);

  resultState.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  loadingText.textContent = text;
}

function resetSteps() {
  [step1, step2, step3, step4].forEach((step) => step.classList.remove("active"));
  step1.classList.add("active");
}

function setActiveStep(stepNumber) {
  [step1, step2, step3, step4].forEach((step) => step.classList.remove("active"));

  if (stepNumber >= 1) step1.classList.add("active");
  if (stepNumber >= 2) step2.classList.add("active");
  if (stepNumber >= 3) step3.classList.add("active");
  if (stepNumber >= 4) step4.classList.add("active");
}

function setScoreRing(score) {
  const deg = Math.round((score / 100) * 360);
  scoreRing.style.background = `conic-gradient(#2563eb ${deg}deg, #dbeafe ${deg}deg)`;
}

function setBar(barEl, numEl, score) {
  numEl.textContent = score;
  setTimeout(() => {
    barEl.style.width = `${score}%`;
  }, 100);
}

function animateNumber(el, start, end, duration) {
  let startTimestamp = null;

  function step(timestamp) {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    el.textContent = value;

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = end;
    }
  }

  window.requestAnimationFrame(step);
}

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function safeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

connectChannelBtn.addEventListener("click", () => {
  alert("다음 단계에서 YouTube/Instagram 연결 화면으로 확장합니다.");
});

connectWebBtn.addEventListener("click", () => {
  alert("다음 단계에서 GA4/Search Console 연결 기능을 붙입니다.");
});

deepBtn.addEventListener("click", () => {
  alert("다음 단계에서 심층 분석 요청 폼을 연결합니다.");
});

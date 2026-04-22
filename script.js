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

const barMessage = document.getElementById("barMessage");
const barConversion = document.getElementById("barConversion");
const barConsistency = document.getElementById("barConsistency");

const numMessage = document.getElementById("numMessage");
const numConversion = document.getElementById("numConversion");
const numConsistency = document.getElementById("numConsistency");

const sheetCompany = document.getElementById("sheetCompany");
const sheetCategory = document.getElementById("sheetCategory");
const sheetScore = document.getElementById("sheetScore");

const pdfBtn = document.getElementById("pdfBtn");
const deepBtn = document.getElementById("deepBtn");

const step1 = document.getElementById("step1");
const step2 = document.getElementById("step2");
const step3 = document.getElementById("step3");
const step4 = document.getElementById("step4");

let selectedCategory = "";

const categoryData = {
  local: {
    label: "로컬 서비스형",
    score: 74,
    message: 72,
    conversion: 66,
    consistency: 70,
    title: "로컬 검색 노출과 전환 흐름은 있으나 메시지 정리가 더 필요합니다",
    summary:
      "지도·검색 기반 업종 특성상 첫 인상과 문의 동선이 중요합니다. 현재 구조에서는 대표 강점과 전환 유도가 조금 더 선명해질 필요가 있습니다.",
    issues: [
      "업체의 대표 강점이 첫 화면에서 바로 읽히지 않습니다.",
      "문의·예약·전화 유도 요소가 분산되어 있을 가능성이 있습니다.",
      "지역 키워드 관점의 메시지 정리 여지가 보입니다."
    ],
    actions: [
      "대표 서비스와 핵심 지역 키워드를 한 문장으로 정리하세요.",
      "전화·예약·상담 버튼을 한 흐름으로 통합하세요.",
      "채널별 소개 문구를 동일한 기준으로 맞추세요."
    ]
  },
  professional: {
    label: "고관여 전문직형",
    score: 69,
    message: 65,
    conversion: 61,
    consistency: 72,
    title: "신뢰 요소는 중요하지만 현재는 설명 구조와 권위 표현 보강이 우선입니다",
    summary:
      "고관여 업종은 전문성, 사례, 신뢰 구조가 중요합니다. 현재는 메시지 명확성과 전환 구조를 조금 더 정돈해야 설득력이 높아질 수 있습니다.",
    issues: [
      "전문성을 보여주는 표현과 구조가 충분히 강조되지 않을 수 있습니다.",
      "상담 전환 경로가 직관적이지 않을 가능성이 있습니다.",
      "대표 분야와 강점이 한눈에 이해되지 않을 수 있습니다."
    ],
    actions: [
      "대표 전문 분야를 첫 화면과 소개 문구에서 분명히 하세요.",
      "상담 신청 흐름을 한 단계 줄여 진입 장벽을 낮추세요.",
      "신뢰를 높이는 사례·이력·설명 구조를 앞쪽에 배치하세요."
    ]
  },
  ecommerce: {
    label: "이커머스형",
    score: 78,
    message: 74,
    conversion: 81,
    consistency: 69,
    title: "구매 유도 구조는 강하지만 브랜드 메시지와 채널 일관성 보강이 필요합니다",
    summary:
      "이커머스형은 전환 구조가 핵심입니다. 현재 구조는 비교적 좋지만 상품 메시지의 명확성과 채널별 표현 정렬이 이루어지면 효율이 더 높아질 수 있습니다.",
    issues: [
      "상품 강점이 한 문장으로 정리되어 있지 않을 수 있습니다.",
      "채널마다 표현 방식이 달라 브랜드 인식이 분산될 수 있습니다.",
      "구매 전 신뢰 요소 배치가 조금 더 체계적이면 좋습니다."
    ],
    actions: [
      "대표 상품 메시지를 한 줄 가치 제안으로 정리하세요.",
      "상세/홈/채널 소개 문구를 하나의 기준으로 통일하세요.",
      "후기, 혜택, 배송/환불 정보를 더 명확히 구조화하세요."
    ]
  },
  b2b: {
    label: "B2B/IT 서비스형",
    score: 71,
    message: 69,
    conversion: 63,
    consistency: 76,
    title: "논리 구조는 괜찮지만 리드 전환 장치와 메시지 선명도가 더 필요합니다",
    summary:
      "B2B/IT 업종은 누구를 위한 어떤 해결책인지가 가장 중요합니다. 현재는 기본 틀은 있으나 문제-해결-전환 흐름을 더 또렷하게 만드는 작업이 필요합니다.",
    issues: [
      "대상 고객이 누구인지 첫 화면에서 즉시 읽히지 않을 수 있습니다.",
      "도입 문의나 데모 요청 동선이 약할 가능성이 있습니다.",
      "SEO 관점에서 서비스 설명 페이지 구조가 부족할 수 있습니다."
    ],
    actions: [
      "고객군과 해결 문제를 첫 화면에서 한 문장으로 제시하세요.",
      "문의/데모/상담 CTA를 더 자주 노출하세요.",
      "서비스별 설명 페이지와 검색형 콘텐츠 구조를 보강하세요."
    ]
  },
  knowledge: {
    label: "무형 자산/지식 창업형",
    score: 73,
    message: 75,
    conversion: 62,
    consistency: 74,
    title: "브랜드 메시지는 비교적 좋지만 팬 전환 구조와 리드 수집 흐름 보강이 필요합니다",
    summary:
      "지식형 비즈니스는 브랜드 캐릭터와 반복 접점이 중요합니다. 현재는 메시지는 괜찮지만 구독·문의·리드 수집 장치가 더 선명해야 합니다.",
    issues: [
      "무료 콘텐츠에서 유료 전환으로 이어지는 구조가 약할 수 있습니다.",
      "채널 구독·이메일 수집 등의 리드 장치가 부족할 수 있습니다.",
      "콘텐츠 메시지가 브랜드 자산으로 축적되는 구조가 더 필요합니다."
    ],
    actions: [
      "무료 콘텐츠 → 리드 확보 → 제안 구조를 명확히 만드세요.",
      "채널별 CTA를 구독/문의/자료요청으로 분리 설계하세요.",
      "대표 세계관과 핵심 주제를 일관되게 반복하세요."
    ]
  }
};

categoryCards.forEach((card) => {
  card.addEventListener("click", () => {
    categoryCards.forEach((el) => el.classList.remove("selected"));
    card.classList.add("selected");
    selectedCategory = card.dataset.category;
  });
});

form.addEventListener("submit", (e) => {
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
  simulateAnalysis(company, url, selectedCategory);
});

function showLoading() {
  idleState.classList.add("hidden");
  resultState.classList.add("hidden");
  loadingState.classList.remove("hidden");

  statusBadge.textContent = "분석 중";
  resetSteps();
  updateProgress(6, "입력값을 확인하고 있습니다...");
}

function simulateAnalysis(company, url, categoryKey) {
  const data = categoryData[categoryKey];
  const urlHint = getUrlHint(url);

  const progressSteps = [
    { percent: 18, text: "입력값을 확인하고 있습니다...", active: 1 },
    { percent: 42, text: `${data.label} 기준으로 분석 항목을 정리하고 있습니다...`, active: 2 },
    { percent: 71, text: `${urlHint} 구조를 바탕으로 요약 결과를 생성하고 있습니다...`, active: 3 },
    { percent: 96, text: "리포트 미리보기를 구성하고 있습니다...", active: 4 }
  ];

  progressSteps.forEach((item, index) => {
    setTimeout(() => {
      updateProgress(item.percent, item.text);
      setActiveStep(item.active);
    }, 700 * (index + 1));
  });

  setTimeout(() => {
    renderResult(company, data);
  }, 3300);
}

function renderResult(company, data) {
  loadingState.classList.add("hidden");
  resultState.classList.remove("hidden");

  statusBadge.textContent = "완료";
  selectedCategoryText.textContent = data.label;
  summaryTitle.textContent = data.title;
  summaryText.textContent = data.summary;

  issueList.innerHTML = "";
  actionList.innerHTML = "";

  data.issues.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    issueList.appendChild(li);
  });

  data.actions.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    actionList.appendChild(li);
  });

  animateNumber(scoreValue, 0, data.score, 700);
  setScoreRing(data.score);

  setBar(barMessage, numMessage, data.message);
  setBar(barConversion, numConversion, data.conversion);
  setBar(barConsistency, numConsistency, data.consistency);

  sheetCompany.textContent = company;
  sheetCategory.textContent = data.label;
  sheetScore.textContent = `${data.score}점`;

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
  }, 200);
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

function getUrlHint(url) {
  const lower = url.toLowerCase();

  if (lower.includes("instagram")) return "SNS 채널";
  if (lower.includes("youtube")) return "영상 채널";
  if (lower.includes("smartstore")) return "커머스 채널";
  if (lower.includes("naver")) return "포털/네이버 채널";
  return "입력된 URL";
}

pdfBtn.addEventListener("click", () => {
  alert("다음 단계에서 실제 PDF 생성 API를 연결합니다.");
});

deepBtn.addEventListener("click", () => {
  alert("다음 단계에서 심층분석 요청 폼 또는 상담 접수 기능을 연결합니다.");
});

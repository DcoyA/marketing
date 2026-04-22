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

const categoryLabelMap = {
  local: "로컬 서비스형",
  professional: "고관여 전문직형",
  ecommerce: "이커머스형",
  b2b: "B2B/IT 서비스형",
  knowledge: "무형 자산/지식 창업형",
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
      throw new Error(data.error || "분석 요청에 실패했습니다.");
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

  statusBadge.textContent = "분석 중";
  resetSteps();
  updateProgress(8, "입력값을 확인하고 있습니다...");
}

function fakeProgressSequence() {
  const steps = [
    { percent: 18, text: "입력 정보 검증 중...", active: 1, delay: 300 },
    { percent: 42, text: "업종 기준 분석 준비 중...", active: 2, delay: 900 },
    { percent: 70, text: "AI가 진단 초안을 구성 중...", active: 3, delay: 1600 },
    { percent: 92, text: "결과 화면을 정리하고 있습니다...", active: 4, delay: 2300 },
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

  summaryTitle.textContent = data.summaryTitle || "초기 진단 결과가 생성되었습니다";
  summaryText.textContent = data.summaryText || "입력한 정보 기준으로 초기 분석 결과를 생성했습니다.";

  issueList.innerHTML = "";
  actionList.innerHTML = "";

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

  const score = safeNumber(data.score, 70);
  const messageScore = safeNumber(data.messageScore, 68);
  const conversionScore = safeNumber(data.conversionScore, 64);
  const consistencyScore = safeNumber(data.consistencyScore, 71);

  animateNumber(scoreValue, 0, score, 700);
  setScoreRing(score);

  setBar(barMessage, numMessage, messageScore);
  setBar(barConversion, numConversion, conversionScore);
  setBar(barConsistency, numConsistency, consistencyScore);

  sheetCompany.textContent = company;
  sheetCategory.textContent = categoryLabelMap[categoryKey] || "기타";
  sheetScore.textContent = `${score}점`;

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

pdfBtn.addEventListener("click", () => {
  alert("다음 단계에서 실제 PDF 생성 기능을 연결합니다.");
});

deepBtn.addEventListener("click", () => {
  alert("다음 단계에서 심층분석 요청 기능을 연결합니다.");
});

const form = document.getElementById("diagnosisForm");
const submitBtn = document.getElementById("submitBtn");

const loadingBox = document.getElementById("loadingBox");
const resultSection = document.getElementById("resultSection");
const progressBar = document.getElementById("progressBar");
const loadingText = document.getElementById("loadingText");

const stepDiscovery = document.getElementById("step-discovery");
const stepMatching = document.getElementById("step-matching");
const stepAnalysis = document.getElementById("step-analysis");

const resultMeta = document.getElementById("resultMeta");
const overallScore = document.getElementById("overallScore");
const confidenceText = document.getElementById("confidenceText");
const confidenceDesc = document.getElementById("confidenceDesc");
const executiveSummary = document.getElementById("executiveSummary");
const scoreList = document.getElementById("scoreList");
const assetList = document.getElementById("assetList");
const winsList = document.getElementById("winsList");
const risksList = document.getElementById("risksList");
const actionsList = document.getElementById("actionsList");
const evidenceList = document.getElementById("evidenceList");
const limitsList = document.getElementById("limitsList");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLoading() {
  resultSection.classList.add("hidden");
  loadingBox.classList.remove("hidden");

  progressBar.style.width = "8%";
  stepDiscovery.className = "loading-step active";
  stepMatching.className = "loading-step";
  stepAnalysis.className = "loading-step";
  loadingText.textContent = "업체명을 기반으로 공개 웹을 탐색하고 있습니다...";
}

function setStage(stage) {
  if (stage === 1) {
    progressBar.style.width = "28%";
    stepDiscovery.className = "loading-step active";
    stepMatching.className = "loading-step";
    stepAnalysis.className = "loading-step";
    loadingText.textContent = "검색 결과에서 홈페이지·SNS·지도·스토어 후보를 찾는 중입니다...";
  }

  if (stage === 2) {
    progressBar.style.width = "62%";
    stepDiscovery.className = "loading-step done";
    stepMatching.className = "loading-step active";
    stepAnalysis.className = "loading-step";
    loadingText.textContent = "업체명 유사도와 지역 일치도를 기준으로 후보를 매칭하고 있습니다...";
  }

  if (stage === 3) {
    progressBar.style.width = "88%";
    stepDiscovery.className = "loading-step done";
    stepMatching.className = "loading-step done";
    stepAnalysis.className = "loading-step active";
    loadingText.textContent = "발견 자산을 바탕으로 초기 진단을 생성하고 있습니다...";
  }

  if (stage === 4) {
    progressBar.style.width = "100%";
    stepDiscovery.className = "loading-step done";
    stepMatching.className = "loading-step done";
    stepAnalysis.className = "loading-step done";
    loadingText.textContent = "진단 완료";
  }
}

function renderScores(scores = {}) {
  const labelMap = {
    overall: "종합",
    searchVisibility: "검색 노출",
    contentPresence: "콘텐츠 존재감",
    localExposure: "로컬/플랫폼 노출",
    webQuality: "웹 품질"
  };

  const order = ["searchVisibility", "contentPresence", "localExposure", "webQuality"];
  scoreList.innerHTML = order.map((key) => {
    const value = Number(scores[key] || 0);
    return `
      <div class="score-row">
        <label>${labelMap[key]}</label>
        <div class="score-bar-wrap">
          <div class="score-bar" style="width:${value}%"></div>
        </div>
        <div class="score-value">${value}</div>
      </div>
    `;
  }).join("");
}

function renderAssets(discovery = {}) {
  const assets = discovery.assets || {};
  const cards = [];

  const pushCard = (title, badge, obj, extra = "") => {
    if (!obj) {
      cards.push(`
        <div class="asset-card">
          <div class="asset-top">
            <div>
              <h4>${title}</h4>
              <p>발견되지 않음</p>
            </div>
            <span class="asset-badge">${badge}</span>
          </div>
        </div>
      `);
      return;
    }

    cards.push(`
      <div class="asset-card">
        <div class="asset-top">
          <div>
            <h4>${escapeHtml(obj.title || title)}</h4>
            <p>${escapeHtml(obj.snippet || obj.description || "발견된 후보 자산")}</p>
            ${obj.url ? `<p style="margin-top:8px;"><a href="${escapeHtml(obj.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(obj.url)}</a></p>` : ""}
            ${extra}
          </div>
          <span class="asset-badge">${badge}</span>
        </div>
      </div>
    `);
  };

  const youtubeExtra = assets.youtube?.stats
    ? `
      <p style="margin-top:8px;">
        구독자 ${Number(assets.youtube.stats.subscriberCount || 0).toLocaleString()} ·
        영상 ${Number(assets.youtube.stats.videoCount || 0).toLocaleString()}개 ·
        누적조회 ${Number(assets.youtube.stats.viewCount || 0).toLocaleString()}
      </p>
    `
    : "";

  const pageSpeedExtra = discovery.pageSpeed
    ? `
      <p style="margin-top:8px;">
        PageSpeed 모바일 ${discovery.pageSpeed.mobile ?? "-"} / 데스크톱 ${discovery.pageSpeed.desktop ?? "-"}
      </p>
    `
    : "";

  pushCard("공식 홈페이지 후보", "홈페이지", assets.homepage, pageSpeedExtra);
  pushCard("인스타그램 후보", "인스타", assets.instagram);
  pushCard("유튜브 채널 후보", "유튜브", assets.youtube, youtubeExtra);
  pushCard("네이버 스토어/쇼핑 후보", "스토어", assets.naverStore);
  pushCard("지도/플랫폼 후보", "지도", assets.map);

  assetList.innerHTML = cards.join("");
}

function renderList(element, items = [], ordered = false) {
  if (!items.length) {
    element.innerHTML = `<li>해당 사항이 아직 충분히 발견되지 않았습니다.</li>`;
    return;
  }

  element.innerHTML = items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderEvidence(evidence = []) {
  if (!evidence.length) {
    evidenceList.innerHTML = `<div class="evidence-card"><p>표시할 탐색 근거가 없습니다.</p></div>`;
    return;
  }

  evidenceList.innerHTML = evidence.map((item) => `
    <div class="evidence-card">
      <div class="evidence-top">
        <div>
          <h4>${escapeHtml(item.title || "탐색 결과")}</h4>
          <p>${escapeHtml(item.reason || item.snippet || "")}</p>
          ${item.url ? `<p style="margin-top:8px;"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a></p>` : ""}
        </div>
        <span class="asset-badge">${escapeHtml(item.platform || item.source || "근거")}</span>
      </div>
    </div>
  `).join("");
}

function renderResult(data) {
  const { input, discovery, diagnosis } = data;

  resultMeta.textContent = `${input.companyName} · ${input.region} · ${diagnosis.industryLabel}`;
  overallScore.textContent = Number(diagnosis.scores?.overall || 0);
  confidenceText.textContent = diagnosis.confidence || "-";
  confidenceDesc.textContent = diagnosis.confidenceDescription || "-";
  executiveSummary.textContent = diagnosis.executiveSummary || "-";

  renderScores(diagnosis.scores || {});
  renderAssets(discovery || {});
  renderList(winsList, diagnosis.wins || []);
  renderList(risksList, diagnosis.risks || []);
  renderList(actionsList, diagnosis.nextActions || [], true);
  renderEvidence(data.evidence || []);
  renderList(limitsList, diagnosis.limits || []);

  loadingBox.classList.add("hidden");
  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    companyName: document.getElementById("companyName").value.trim(),
    industry: document.getElementById("industry").value,
    region: document.getElementById("region").value.trim(),
    email: document.getElementById("email").value.trim()
  };

  if (!payload.companyName || !payload.industry || !payload.region || !payload.email) {
    alert("업체명, 업종, 지역, 이메일을 모두 입력해주세요.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "진단 중...";
  showLoading();

  const stageTimers = 

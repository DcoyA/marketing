window.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const form = $("diagnosisForm");
  const submitBtn = $("submitBtn");

  const loadingBox = $("loadingBox");
  const resultSection = $("resultSection");
  const progressBar = $("progressBar");
  const loadingText = $("loadingText");

  const stepDiscovery = $("step-discovery");
  const stepMatching = $("step-matching");
  const stepAnalysis = $("step-analysis");

  const resultMeta = $("resultMeta");
  const overallScore = $("overallScore");
  const confidenceText = $("confidenceText");
  const confidenceDesc = $("confidenceDesc");
  const executiveSummary = $("executiveSummary");
  const scoreList = $("scoreList");
  const assetList = $("assetList");
  const winsList = $("winsList");
  const risksList = $("risksList");
  const actionsList = $("actionsList");
  const evidenceList = $("evidenceList");
  const limitsList = $("limitsList");

  console.log("script loaded");
  console.log("form exists:", !!form);

  if (!form) {
    console.error("diagnosisForm not found");
    return;
  }

  function escapeHtml(value = "") {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(el, text) {
    if (el) el.textContent = text ?? "";
  }

  function setHTML(el, html) {
    if (el) el.innerHTML = html ?? "";
  }

  function showLoading() {
    if (resultSection) resultSection.classList.add("hidden");
    if (loadingBox) loadingBox.classList.remove("hidden");

    if (progressBar) progressBar.style.width = "10%";

    if (stepDiscovery) stepDiscovery.className = "loading-step active";
    if (stepMatching) stepMatching.className = "loading-step";
    if (stepAnalysis) stepAnalysis.className = "loading-step";

    setText(loadingText, "업체 정보를 바탕으로 진단을 준비하고 있습니다...");
  }

  function setStage(stage) {
    if (stage === 1) {
      if (progressBar) progressBar.style.width = "28%";
      if (stepDiscovery) stepDiscovery.className = "loading-step active";
      if (stepMatching) stepMatching.className = "loading-step";
      if (stepAnalysis) stepAnalysis.className = "loading-step";
      setText(loadingText, "관련 자산을 탐색하고 있습니다...");
    }

    if (stage === 2) {
      if (progressBar) progressBar.style.width = "62%";
      if (stepDiscovery) stepDiscovery.className = "loading-step done";
      if (stepMatching) stepMatching.className = "loading-step active";
      if (stepAnalysis) stepAnalysis.className = "loading-step";
      setText(loadingText, "후보를 정리하고 있습니다...");
    }

    if (stage === 3) {
      if (progressBar) progressBar.style.width = "88%";
      if (stepDiscovery) stepDiscovery.className = "loading-step done";
      if (stepMatching) stepMatching.className = "loading-step done";
      if (stepAnalysis) stepAnalysis.className = "loading-step active";
      setText(loadingText, "초기 진단을 생성하고 있습니다...");
    }

    if (stage === 4) {
      if (progressBar) progressBar.style.width = "100%";
      if (stepDiscovery) stepDiscovery.className = "loading-step done";
      if (stepMatching) stepMatching.className = "loading-step done";
      if (stepAnalysis) stepAnalysis.className = "loading-step done";
      setText(loadingText, "진단 완료");
    }
  }

  function renderScores(scores = {}) {
    const rows = [
      { key: "searchVisibility", label: "검색 노출" },
      { key: "contentPresence", label: "콘텐츠 존재감" },
      { key: "localExposure", label: "로컬/플랫폼 노출" },
      { key: "webQuality", label: "웹 품질" }
    ];

    const html = rows.map((row) => {
      const value = Number(scores[row.key] || 0);
      return `
        <div class="score-row">
          <label>${row.label}</label>
          <div class="score-bar-wrap">
            <div class="score-bar" style="width:${value}%"></div>
          </div>
          <div class="score-value">${value}</div>
        </div>
      `;
    }).join("");

    setHTML(scoreList, html);
  }

  function renderAssets(discovery = {}) {
    const assets = discovery.assets || {};
    const cards = [];

    const addCard = (label, badge, item, extra = "") => {
      if (!item) {
        cards.push(`
          <div class="asset-card">
            <div class="asset-top">
              <div>
                <h4>${label}</h4>
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
              <h4>${escapeHtml(item.title || label)}</h4>
              <p>${escapeHtml(item.snippet || item.description || "발견된 후보 자산")}</p>
              ${item.url ? `<p style="margin-top:8px;"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a></p>` : ""}
              ${extra}
            </div>
            <span class="asset-badge">${badge}</span>
          </div>
        </div>
      `);
    };

    const youtubeExtra = assets.youtube?.stats
      ? `<p style="margin-top:8px;">구독자 ${Number(assets.youtube.stats.subscriberCount || 0).toLocaleString()} · 영상 ${Number(assets.youtube.stats.videoCount || 0).toLocaleString()}개 · 누적조회 ${Number(assets.youtube.stats.viewCount || 0).toLocaleString()}</p>`
      : "";

    const pageSpeedExtra = discovery.pageSpeed
      ? `<p style="margin-top:8px;">PageSpeed 모바일 ${discovery.pageSpeed.mobile ?? "-"} / 데스크톱 ${discovery.pageSpeed.desktop ?? "-"}</p>`
      : "";

    addCard("공식 홈페이지 후보", "홈페이지", assets.homepage, pageSpeedExtra);
    addCard("Instagram 후보", "인스타", assets.instagram);
    addCard("YouTube 채널 후보", "유튜브", assets.youtube, youtubeExtra);
    addCard("NAVER 쇼핑/스토어 후보", "스토어", assets.naverStore);
    addCard("지도/플랫폼 후보", "지도", assets.map);

    setHTML(assetList, cards.join(""));
  }

  function renderBulletList(el, items = []) {
    if (!el) return;
    if (!Array.isArray(items) || !items.length) {
      el.innerHTML = "<li>표시할 내용이 없습니다.</li>";
      return;
    }
    el.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function renderEvidence(items = []) {
    if (!evidenceList) return;
    if (!Array.isArray(items) || !items.length) {
      evidenceList.innerHTML = `<div class="evidence-card"><p>탐색 근거가 없습니다.</p></div>`;
      return;
    }

    evidenceList.innerHTML = items.map((item) => `
      <div class="evidence-card">
        <div class="evidence-top">
          <div>
            <h4>${escapeHtml(item.title || "탐색 결과")}</h4>
            <p>${escapeHtml(item.reason || "")}</p>
            ${item.url ? `<p style="margin-top:8px;"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a></p>` : ""}
          </div>
          <span class="asset-badge">${escapeHtml(item.platform || "근거")}</span>
        </div>
      </div>
    `).join("");
  }

  function renderResult(data) {
    console.log("renderResult data:", data);

    const input = data?.input || {};
    const discovery = data?.discovery || {};
    const diagnosis = data?.diagnosis || {};
    const scores = diagnosis?.scores || {};

    setText(resultMeta, `${input.companyName || "-"} · ${input.region || "-"} · ${diagnosis.industryLabel || "-"}`);
    setText(overallScore, String(scores.overall ?? 0));
    setText(confidenceText, diagnosis.confidence || "-");
    setText(confidenceDesc, diagnosis.confidenceDescription || "-");
    setText(executiveSummary, diagnosis.executiveSummary || "-");

    renderScores(scores);
    renderAssets(discovery);
    renderBulletList(winsList, diagnosis.wins || []);
    renderBulletList(risksList, diagnosis.risks || []);
    renderBulletList(actionsList, diagnosis.nextActions || []);
    renderBulletList(limitsList, diagnosis.limits || []);
    renderEvidence(data.evidence || []);

    if (loadingBox) loadingBox.classList.add("hidden");
    if (resultSection) resultSection.classList.remove("hidden");

    if (resultSection) {
      resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log("submit intercepted");

    const payload = {
      companyName: $("companyName")?.value?.trim() || "",
      industry: $("industry")?.value || "",
      region: $("region")?.value?.trim() || "",
      email: $("email")?.value?.trim() || ""
    };

    console.log("payload:", payload);

    if (!payload.companyName || !payload.industry || !payload.region || !payload.email) {
      alert("업체명, 업종, 지역, 이메일을 모두 입력해주세요.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "진단 중...";
    }

    showLoading();

    const timers = [
      setTimeout(() => setStage(1), 200),
      setTimeout(() => setStage(2), 900),
      setTimeout(() => setStage(3), 1800)
    ];

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      console.log("response status:", response.status);

      const rawText = await response.text();
      console.log("raw response:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        throw new Error("API 응답이 JSON 형식이 아닙니다.");
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "분석 요청 실패");
      }

      setStage(4);
      renderResult(data);
    } catch (error) {
      console.error("submit error:", error);

      if (loadingBox) loadingBox.classList.add("hidden");

      alert(`분석 중 오류가 발생했습니다.\n\n${error.message}`);
    } finally {
      timers.forEach(clearTimeout);

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "진단하기";
      }
    }
  });
});

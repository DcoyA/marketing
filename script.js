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
  console.log("submitBtn exists:", !!submitBtn);

  window.addEventListener("error", (e) => {
    console.error("window error:", e.message, e.error);
  });

  window.addEventListener("unhandledrejection", (e) => {
    console.error("unhandled promise rejection:", e.reason);
  });

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
      { key: "webQuality", label: "웹 품질" },
    ];

    const html = rows
      .map((row) => {
        const value = Number(scores?.[row.key] ?? 0);
        return `
          <div class="score-row">
            <label>${row.label}</label>
            <div class="score-bar-wrap">
              <div class="score-bar" style="width:${Math.max(0, Math.min(100, value))}%"></div>
            </div>
            <div class="score-value">${value}</div>
          </div>
        `;
      })
      .join("");

    setHTML(scoreList, html);
  }

  function renderAssets(discovery = {}) {
    const verified = discovery?.verified || {};
    const pageSpeed = discovery?.pageSpeed || {};
    const cards = [];

    const addCard = (label, badge, item, extra = "") => {
      if (!item || !item.found) {
        cards.push(`
          <div class="asset-card">
            <div class="asset-top">
              <div>
                <h4>${escapeHtml(label)}</h4>
                <p>발견되지 않음</p>
              </div>
              <span class="asset-badge">${escapeHtml(badge)}</span>
            </div>
          </div>
        `);
        return;
      }

      const title = item.title || label;
      const description =
        item.reason === "ok"
          ? "발견된 후보 자산"
          : item.reason || "발견된 후보 자산";

      cards.push(`
        <div class="asset-card">
          <div class="asset-top">
            <div>
              <h4>${escapeHtml(title)}</h4>
              <p>${escapeHtml(description)}</p>
              ${
                item.url
                  ? `<p style="margin-top:8px;"><a href="${escapeHtml(
                      item.url
                    )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                      item.url
                    )}</a></p>`
                  : ""
              }
              <p style="margin-top:8px;">신뢰도 ${escapeHtml(
                item.confidence || "-"
              )} · 점수 ${Number(item.score ?? 0)}</p>
              ${extra}
            </div>
            <span class="asset-badge">${escapeHtml(badge)}</span>
          </div>
        </div>
      `);
    };

    const pageSpeedExtra = pageSpeed?.ok
      ? `<p style="margin-top:8px;">PageSpeed 성능 ${Number(
          pageSpeed.performanceScore ?? 0
        )} / 접근성 ${Number(pageSpeed.accessibilityScore ?? 0)} / 권장사항 ${Number(
          pageSpeed.bestPracticesScore ?? 0
        )} / SEO ${Number(pageSpeed.seoScore ?? 0)}</p>`
      : `<p style="margin-top:8px;">PageSpeed ${escapeHtml(
          pageSpeed?.error || "-"
        )}</p>`;

    addCard("공식 홈페이지 후보", "홈페이지", verified.homepage, pageSpeedExtra);
    addCard("Instagram 후보", "인스타", verified.instagram);
    addCard("YouTube 채널 후보", "유튜브", verified.youtube);
    addCard("NAVER 쇼핑/스토어 후보", "스토어", verified.naverStore);
    addCard("지도/플랫폼 후보", "지도", verified.map);

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

    evidenceList.innerHTML = items
      .map((item) => {
        const badge = item.source || item.type || "근거";
        const descParts = [];

        if (item.mallName) descParts.push(`스토어: ${item.mallName}`);
        if (typeof item.subscriberCount === "number")
          descParts.push(`구독자 ${item.subscriberCount.toLocaleString()}`);
        if (item.type) descParts.push(`유형: ${item.type}`);

        return `
          <div class="evidence-card">
            <div class="evidence-top">
              <div>
                <h4>${escapeHtml(item.title || "탐색 결과")}</h4>
                <p>${escapeHtml(descParts.join(" · "))}</p>
                ${
                  item.url
                    ? `<p style="margin-top:8px;"><a href="${escapeHtml(
                        item.url
                      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                        item.url
                      )}</a></p>`
                    : ""
                }
              </div>
              <span class="asset-badge">${escapeHtml(badge)}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function ensureUiPatchStyles() {
    if (document.getElementById("helloMediaUiPatchStyles")) return;

    const style = document.createElement("style");
    style.id = "helloMediaUiPatchStyles";
    style.textContent = `
      .deep-analysis-section {
        margin-top: 28px;
        padding: 28px;
        border-radius: 24px;
        background: rgba(255,255,255,0.75);
        border: 1px solid rgba(240, 160, 190, 0.25);
        box-shadow: 0 10px 30px rgba(230, 180, 200, 0.12);
      }

      .deep-analysis-title {
        margin: 0 0 10px;
        font-size: 28px;
        font-weight: 800;
        color: #1f1f1f;
      }

      .deep-analysis-desc {
        margin: 0 0 18px;
        color: #5f5f6f;
        line-height: 1.7;
      }

      .deep-analysis-note {
        width: 100%;
        min-height: 120px;
        border-radius: 16px;
        border: 1px solid rgba(220, 160, 185, 0.35);
        background: #fff;
        padding: 16px 18px;
        font-size: 15px;
        line-height: 1.6;
        outline: none;
        resize: vertical;
        box-sizing: border-box;
      }

      .deep-analysis-note:focus {
        border-color: #e85d8f;
        box-shadow: 0 0 0 4px rgba(232, 93, 143, 0.12);
      }

      .deep-analysis-actions {
        margin-top: 16px;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }

      .deep-analysis-btn {
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, #ea5b90, #ff7da8);
        color: #fff;
        padding: 14px 22px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(234, 91, 144, 0.22);
      }

      .deep-analysis-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .deep-analysis-status {
        font-size: 14px;
        color: #5f5f6f;
      }

      .hello-media-footer {
        margin: 42px 0 12px;
        padding: 18px 12px 6px;
        text-align: center;
        color: #6d6d79;
        font-size: 14px;
        line-height: 1.8;
      }

      .hello-media-footer a {
        color: #e85d8f;
        text-decoration: none;
      }

      .hello-media-footer a:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(style);
  }

  function hideLimitsSection() {
    if (!limitsList) return;

    const candidateContainer =
      limitsList.closest(
        '[data-role="limits-section"], .result-card, .content-card, .dashboard-card, .panel, .card, section, article'
      ) || limitsList.parentElement;

    if (candidateContainer && candidateContainer !== resultSection) {
      candidateContainer.style.display = "none";
    } else if (limitsList.parentElement) {
      limitsList.parentElement.style.display = "none";
    }

    document.querySelectorAll("h1,h2,h3,h4,h5,p,span,div").forEach((el) => {
      const text = (el.textContent || "").trim();
      if (text === "현재 단계의 한계") {
        const box =
          el.closest(
            '.result-card, .content-card, .dashboard-card, .panel, .card, section, article'
          ) || el.parentElement;
        if (box && box !== resultSection) {
          box.style.display = "none";
        } else {
          el.style.display = "none";
        }
      }
    });
  }

  function ensureFooter() {
    ensureUiPatchStyles();

    let footer = document.getElementById("helloMediaFooter");
    if (!footer) {
      footer = document.createElement("footer");
      footer.id = "helloMediaFooter";
      footer.className = "hello-media-footer";
      footer.innerHTML = `
        <div>HelloMedia All rights reserved</div>
        <div><a href="mailto:iamborghini5757@gmail.com">iamborghini5757@gmail.com</a></div>
      `;
      (resultSection?.parentElement || document.body).appendChild(footer);
    }
  }

  function getDeepAnalysisSection() {
    ensureUiPatchStyles();

    let section = document.getElementById("deepAnalysisSection");
    if (section) return section;

    section = document.createElement("section");
    section.id = "deepAnalysisSection";
    section.className = "deep-analysis-section";
    section.innerHTML = `
      <h3 class="deep-analysis-title">심층분석 요청하기</h3>
      <p class="deep-analysis-desc">
        현재 진단 결과를 바탕으로 더 구체적인 마케팅 전략, 예산 설계, 채널 운영 방향이 필요하다면 심층분석을 요청할 수 있습니다.
      </p>
      <textarea
        id="deepAnalysisNote"
        class="deep-analysis-note"
        placeholder="추가로 보고 싶은 내용이나 상담 희망 사항을 적어주세요. 예: 경쟁사 비교, 광고 예산안, 네이버/메타 운영 방향, 브랜드 검색 전략 등"
      ></textarea>
      <div class="deep-analysis-actions">
        <button id="deepAnalysisBtn" class="deep-analysis-btn" type="button">심층분석 요청하기</button>
        <span id="deepAnalysisStatus" class="deep-analysis-status"></span>
      </div>
    `;

    if (resultSection) {
      resultSection.appendChild(section);
    } else {
      document.body.appendChild(section);
    }

    return section;
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let data = null;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error("API 응답이 JSON 형식이 아닙니다.");
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || "요청 처리 실패");
    }

    return data;
  }

  function bindDeepAnalysisButton(data) {
    const section = getDeepAnalysisSection();
    const noteEl = section.querySelector("#deepAnalysisNote");
    const buttonEl = section.querySelector("#deepAnalysisBtn");
    const statusEl = section.querySelector("#deepAnalysisStatus");

    if (!buttonEl) return;

    buttonEl.onclick = async () => {
      try {
        const payload = {
          companyName: data?.input?.companyName || "",
          industry: data?.input?.industry || "",
          region: data?.input?.region || "",
          email: data?.input?.email || "",
          homepage: data?.discovery?.assets?.homepage || "",
          instagram: data?.discovery?.assets?.instagram || "",
          youtube: data?.discovery?.assets?.youtube || "",
          note: noteEl?.value?.trim() || "",
          requested_from: "website",
        };

        if (!payload.companyName || !payload.email) {
          throw new Error("업체명 또는 이메일 정보가 없어 심층분석 요청을 보낼 수 없습니다.");
        }

        buttonEl.disabled = true;
        buttonEl.textContent = "접수 중...";
        if (statusEl) statusEl.textContent = "심층분석 요청을 저장하고 있습니다...";

        const result = await postJson("/api/deep-analysis-request", payload);

        if (statusEl) {
          statusEl.textContent = `접수 완료되었습니다. 담당자가 확인 후 연락드리겠습니다.${
            result?.rowNumber ? ` (접수번호: ${result.rowNumber})` : ""
          }`;
        }

        buttonEl.textContent = "접수 완료";
      } catch (error) {
        console.error("deep analysis request error:", error);
        if (statusEl) {
          statusEl.textContent = `접수 실패: ${error.message}`;
        }
        buttonEl.disabled = false;
        buttonEl.textContent = "심층분석 요청하기";
      }
    };
  }

  function renderResult(data) {
    console.log("renderResult data:", data);

    const input = data?.input || {};
    const discovery = data?.discovery || {};
    const diagnosis = data?.diagnosis || {};

    const scores = diagnosis?.score || {};

    const overall = Number(scores?.overall ?? 0);
    const confidence = diagnosis?.confidence ?? "-";
    const confidenceDescription =
      diagnosis?.confidenceDescription ||
      `현재 탐색 신뢰도는 ${confidence}입니다.`;
    const metaIndustry = input?.industry || "-";

    setText(
      resultMeta,
      `${input.companyName || "-"} · ${input.region || "-"} · ${metaIndustry}`
    );
    setText(overallScore, String(overall));
    setText(confidenceText, confidence);
    setText(confidenceDesc, confidenceDescription);
    setText(executiveSummary, diagnosis?.executiveSummary || "-");

    renderScores(scores);
    renderAssets(discovery);
    renderBulletList(winsList, diagnosis?.wins || []);
    renderBulletList(risksList, diagnosis?.risks || []);
    renderBulletList(actionsList, diagnosis?.nextActions || []);
    renderEvidence(data?.evidence || []);

    hideLimitsSection();
    bindDeepAnalysisButton(data);
    ensureFooter();

    if (loadingBox) loadingBox.classList.add("hidden");
    if (resultSection) resultSection.classList.remove("hidden");
    resultSection?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runDiagnosis() {
    console.log("button click intercepted");

    const payload = {
      companyName: $("companyName")?.value?.trim() || "",
      industry: $("industry")?.value || "",
      region: $("region")?.value?.trim() || "",
      email: $("email")?.value?.trim() || "",
    };

    console.log("payload:", payload);

    if (!payload.companyName || !payload.industry || !payload.region || !payload.email) {
      alert("업체명, 업종, 지역, 이메일을 모두 입력해주세요.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "진단 중...";

    showLoading();

    const timers = [
      setTimeout(() => setStage(1), 200),
      setTimeout(() => setStage(2), 900),
      setTimeout(() => setStage(3), 1800),
    ];

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log("response status:", response.status);

      const rawText = await response.text();
      console.log("raw response:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error("API 응답이 JSON 형식이 아닙니다.");
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "분석 요청 실패");
      }

      setStage(4);
      renderResult(data);
    } catch (error) {
      console.error("runDiagnosis error:", error);
      loadingBox?.classList.add("hidden");
      alert(`분석 중 오류가 발생했습니다.\n\n${error.message}`);
    } finally {
      timers.forEach(clearTimeout);
      submitBtn.disabled = false;
      submitBtn.textContent = "진단하기";
    }
  }

  submitBtn?.addEventListener("click", runDiagnosis);
});

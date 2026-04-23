const NAVER = {
  blog: "https://openapi.naver.com/v1/search/blog.json",
  shop: "https://openapi.naver.com/v1/search/shop.json",
  web: "https://openapi.naver.com/v1/search/webkr.json",
};
const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_CHANNELS = "https://www.googleapis.com/youtube/v3/channels";
const PSI = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

const T = { homepage: 68, instagram: 72, youtube: 84, naverStore: 70 };
const NOISY = ["blog.naver.com", "m.blog.naver.com", "cafe.naver.com", "kin.naver.com", "post.naver.com"];
const SOCIAL = ["instagram.com", "www.instagram.com", "youtube.com", "www.youtube.com", "youtu.be", "facebook.com", "x.com", "twitter.com", "tiktok.com"];
const LOCATION_WORDS = ["지점", "매장", "센터", "대리점", "총판", "지사"];
const OFFICIAL_RE = /(공식|official|브랜드|본사|정식|official channel|official account)/i;

const env = (...keys) => keys.map(k => process.env[k]).find(Boolean) || "";
const s = v => (v == null ? "" : String(v)).trim();
const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, n(x)));
const uniqBy = (arr, fn) => Array.from(new Map(arr.map(x => [fn(x), x])).values());
const stripHtml = t => s(t).replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const normText = t => stripHtml(t).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const normUrl = u => {
  try {
    const x = new URL(/^https?:\/\//i.test(s(u)) ? s(u) : `https://${s(u)}`);
    x.hash = "";
    ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(k => x.searchParams.delete(k));
    return x.toString().replace(/\/$/, "");
  } catch { return s(u); }
};
const hostOf = u => { try { return new URL(normUrl(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };
const pathOf = u => { try { return new URL(normUrl(u)).pathname.toLowerCase(); } catch { return ""; } };
const scoreToConfidence = sc => sc >= 80 ? "높음" : sc >= 50 ? "중간" : "낮음";

function makeStatus() {
  return {
    fetchOk: false, parseOk: false, candidateFound: false, verified: false,
    total: 0, rawItems: 0, status: null, error: null, errorCount: 0,
  };
}

function tokenizeBrand(companyName, industry = "", aliases = []) {
  const seed = [companyName, industry, ...aliases].map(normText).filter(Boolean);
  const set = new Set();
  for (const x of seed) {
    set.add(x);
    x.split(/[^a-z0-9가-힣]+/).filter(v => v.length >= 2).forEach(v => set.add(v));
    if (x.includes("marketkurly")) { set.add("kurly"); set.add("마켓컬리"); set.add("컬리"); }
    if (x.includes("kurly")) { set.add("marketkurly"); set.add("마켓컬리"); set.add("컬리"); }
    if (x.includes("마켓컬리")) { set.add("kurly"); set.add("marketkurly"); set.add("컬리"); }
  }
  return Array.from(set).filter(v => v.length >= 2);
}

function brandMatch(text, tokens) {
  const z = normText(text);
  const matched = tokens.filter(t => z.includes(t));
  let score = 0;
  for (const t of matched) score += t.length >= 8 ? 24 : t.length >= 5 ? 18 : 12;
  return { matched, score: clamp(score, 0, 45) };
}

function hasBrandGate(text, url, tokens) {
  const b = brandMatch(`${text} ${url}`, tokens);
  const h = hostOf(url), p = pathOf(url);
  const hostHit = tokens.some(t => normText(h).includes(t) || normText(p).includes(t));
  return b.score > 0 || hostHit;
}

function noisePenalty(text) {
  const z = `${text}`.toLowerCase();
  let p = 0;
  if (LOCATION_WORDS.some(w => z.includes(w))) p += 10;
  if (/후기|리뷰|추천|맛집|체험단|중고|구매후기/i.test(z)) p += 8;
  return p;
}
function cleanBrandTokens(tokens = []) {
  return uniqBy(
    (tokens || [])
      .filter(Boolean)
      .filter(t => !/^https?/i.test(t))
      .filter(t => !/\.(com|co\.kr|kr|org|net)/i.test(t))
      .filter(t => String(t).length >= 2 && String(t).length <= 30),
    x => x
  );
}

function pathDepth(url = "") {
  return pathOf(url).split("/").filter(Boolean).length;
}

function isThirdPartyHomepageHost(host = "") {
  return /(tableau\.com|wikipedia\.org|namu\.wiki|blog\.naver\.com|m\.blog\.naver\.com|tv\.naver\.com|post\.naver\.com|news|press)/i.test(host);
}

function hasHostBrandHit(url = "", tokens = []) {
  const h = normText(hostOf(url));
  const cleaned = cleanBrandTokens(tokens);
  return cleaned.some(t => t.length >= 5 && h.includes(normText(t)));
}

function hasStrictStoreBrand(text = "", url = "", companyName = "") {
  const joined = normText(`${text} ${url}`);
  const company = normText(companyName);

  // 스토어는 '컬리' 같은 일반 단어 매칭 금지
  return !!(
    (company && joined.includes(company)) ||
    joined.includes("marketkurly") ||
    pathOf(url).includes("marketkurly")
  );
}

function scoreHomepage(c, tokens) {
  const title = stripHtml(c.title);
  const desc = stripHtml(c.description);
  const url = normUrl(c.link || c.url);
  const h = hostOf(url);
  const depth = pathDepth(url);
  const b = brandMatch(`${title} ${desc} ${url}`, tokens);

  if (!url || SOCIAL.includes(h) || NOISY.includes(h)) {
    return { score: 0, pass: false, reason: "noisy/social" };
  }

  if (b.score <= 0) {
    return { score: 0, pass: false, reason: "brand-gate" };
  }

  let score = 20 + b.score;

  // 공식 도메인처럼 보이면 강한 가점
  if (hasHostBrandHit(url, tokens)) score += 22;

  // 루트 홈페이지 우대
  if (depth === 0) score += 18;
  else if (depth >= 3) score -= 12;

  // 일반 회사 도메인 우대
  if (/\.(co\.kr|com|kr)$/i.test(h)) score += 8;

  // 3rd-party 강한 감점
  if (isThirdPartyHomepageHost(h)) score -= 45;

  // 공식 키워드는 자사 도메인 쪽에서만 의미 있게 반영
  if (OFFICIAL_RE.test(`${title} ${desc}`) && !isThirdPartyHomepageHost(h)) {
    score += 12;
  }

  score -= noisePenalty(`${title} ${desc} ${url}`);

  return {
    score: clamp(score),
    pass: clamp(score) >= T.homepage,
    reason: "ok"
  };
}


function scoreInstagram(c, tokens) {
  const title = stripHtml(c.title), desc = stripHtml(c.description), url = normUrl(c.link || c.url);
  const h = hostOf(url), p = pathOf(url);
  if (!/instagram\.com$/i.test(h)) return { score: 0, pass: false, reason: "not-instagram" };
  if (!hasBrandGate(`${title} ${desc}`, url, tokens)) return { score: 0, pass: false, reason: "brand-gate" };
  let score = 24 + brandMatch(`${title} ${desc} ${url}`, tokens).score;
  if (OFFICIAL_RE.test(`${title} ${desc} ${p}`)) score += 12;
  if (p.split("/").filter(Boolean).length === 1) score += 12;
  score -= noisePenalty(`${title} ${desc} ${url}`);
  return { score: clamp(score), pass: score >= T.instagram, reason: "ok" };
}

function scoreStore(c, tokens, companyName = "") {
  const title = stripHtml(c.title);
  const mall = stripHtml(c.mallName);
  const desc = stripHtml(c.description);
  const url = normUrl(c.link || c.url);
  const h = hostOf(url);
  const p = pathOf(url);

  // 스토어는 회사명/marketkurly 직접 매치만 허용
  if (!hasStrictStoreBrand(`${title} ${mall} ${desc}`, url, companyName)) {
    return { score: 0, pass: false, reason: "strict-brand-gate" };
  }

  // 검색 카탈로그 상세는 공식 스토어로 보지 않음
  if (/search\.shopping\.naver\.com$/i.test(h)) {
    return { score: 0, pass: false, reason: "catalog-page" };
  }

  // smartstore의 /main/products/ 단건 상세는 공식 스토어로 보지 않음
  if (/smartstore\.naver\.com$/i.test(h) && /^\/main\/products\//i.test(p)) {
    return { score: 0, pass: false, reason: "product-detail" };
  }

  let score = 24 + brandMatch(`${title} ${mall} ${desc} ${url}`, cleanBrandTokens(tokens)).score;

  if (/공식스토어|공식몰|브랜드스토어/i.test(`${title} ${mall}`)) score += 16;
  if (/brand\.naver\.com$/i.test(h)) score += 28;

  // smartstore seller root 형태만 우대
  if (/smartstore\.naver\.com$/i.test(h) && p.split("/").filter(Boolean).length === 1) {
    score += 18;
  }

  score -= noisePenalty(`${title} ${mall} ${url}`);

  return {
    score: clamp(score),
    pass: clamp(score) >= T.naverStore,
    reason: "ok"
  };
}


function scoreYoutube(c, tokens) {
  const title = stripHtml(c.title), desc = stripHtml(c.description), url = normUrl(c.url);
  if (!hasBrandGate(`${title} ${desc}`, url, tokens)) return { score: 0, pass: false, reason: "brand-gate" };
  let score = 22 + brandMatch(`${title} ${desc} ${url}`, tokens).score;
  if (OFFICIAL_RE.test(`${title} ${desc}`)) score += 14;
  if (/\/@/.test(url)) score += 8;
  score += Math.min(12, Math.floor(Math.log10((n(c.subscriberCount) || 1)) * 4));
  score -= noisePenalty(`${title} ${desc} ${url}`);
  return { score: clamp(score), pass: score >= T.youtube, reason: "ok" };
}

function chooseBest(list, threshold) {
  const arr = [...list].sort((a, b) => b.score - a.score);
  const top = arr[0] || null;
  return { top, chosen: top && top.score >= threshold ? top : null, threshold };
}

function summarizeVerifiedAsset(type, chosen) {
  return {
    found: !!chosen,
    verified: !!chosen,
    score: chosen?.score || 0,
    confidence: scoreToConfidence(chosen?.score || 0),
    reason: chosen?.reason || null,
    url: chosen?.url || null,
    title: chosen?.title || null,
    type,
  };
}

async function fetchJson(url, headers = {}, timeout = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const text = await r.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
    return { ok: r.ok, status: r.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: "", error: e?.message || "fetch failed" };
  } finally { clearTimeout(id); }
}

async function runNaver(endpoint, queries, creds) {
  const out = { items: [], requestLog: [], status: makeStatus() };
  if (!creds.id || !creds.secret) {
    out.status.error = "missing NAVER credentials";
    return out;
  }
  for (const q of uniqBy(queries.filter(Boolean), x => x)) {
    const url = `${endpoint}?query=${encodeURIComponent(q)}&display=10&sort=sim`;
    const r = await fetchJson(url, {
      "X-Naver-Client-Id": creds.id,
      "X-Naver-Client-Secret": creds.secret,
    });
    out.requestLog.push({ q, status: r.status, ok: r.ok });
    if (r.status === 429) { out.status.error = "naver rate limit"; out.status.errorCount++; break; }
    if (!r.ok || !r.json) { out.status.error = r.error || `status ${r.status}`; out.status.errorCount++; continue; }
    out.status.fetchOk = true; out.status.parseOk = Array.isArray(r.json.items);
    out.items.push(...(r.json.items || []));
  }
  out.items = uniqBy(out.items, x => normUrl(x.link || x.url));
  out.status.total = out.items.length;
  out.status.rawItems = out.items.length;
  return out;
}

async function runYoutube(queries, apiKey) {
  const status = makeStatus(), items = [], logs = [];
  if (!apiKey) { status.error = "missing YOUTUBE_API_KEY"; return { items, channels: [], requestLog: logs, status }; }

  for (const q of uniqBy(queries.filter(Boolean), x => x)) {
    const url = `${YT_SEARCH}?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const r = await fetchJson(url);
    logs.push({ q, status: r.status, ok: r.ok });
    if (!r.ok || !r.json) { status.error = r.error || `status ${r.status}`; status.errorCount++; continue; }
    status.fetchOk = true; status.parseOk = Array.isArray(r.json.items);
    items.push(...(r.json.items || []));
  }

  const ids = uniqBy(items.map(x => x?.snippet?.channelId).filter(Boolean), x => x);
  if (!ids.length) { status.total = 0; status.rawItems = 0; return { items, channels: [], requestLog: logs, status }; }

  const url = `${YT_CHANNELS}?part=snippet,statistics&id=${ids.join(",")}&key=${apiKey}`;
  const r2 = await fetchJson(url);
  if (!r2.ok || !r2.json) { status.error = r2.error || `status ${r2.status}`; status.errorCount++; return { items, channels: [], requestLog: logs, status }; }

  const channels = (r2.json.items || []).map(x => ({
    id: x.id,
    title: x.snippet?.title || "",
    description: x.snippet?.description || "",
    customUrl: x.snippet?.customUrl || "",
    publishedAt: x.snippet?.publishedAt || "",
    subscriberCount: n(x.statistics?.subscriberCount),
    videoCount: n(x.statistics?.videoCount),
    url: x.snippet?.customUrl ? `https://www.youtube.com/${x.snippet.customUrl}` : `https://www.youtube.com/channel/${x.id}`,
  }));
  status.total = channels.length; status.rawItems = channels.length;
  return { items, channels, requestLog: logs, status };
}

async function fetchPageSpeed(url, apiKey) {
  if (!url) return { ok: false, error: "homepage missing" };
  if (!apiKey) return { ok: false, error: "missing PAGESPEED_API_KEY" };
  const api = `${PSI}?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`;
  const r = await fetchJson(api);
  if (!r.ok || !r.json) return { ok: false, error: r.error || `status ${r.status}` };
  const cats = r.json?.lighthouseResult?.categories || {};
  const to100 = x => clamp(Math.round((n(x) || 0) * 100));
  return {
    ok: true,
    performanceScore: to100(cats.performance?.score),
    accessibilityScore: to100(cats.accessibility?.score),
    bestPracticesScore: to100(cats["best-practices"]?.score),
    seoScore: to100(cats.seo?.score),
  };
}
function compactEvidenceForLLM(evidence = []) {
  return (Array.isArray(evidence) ? evidence : []).slice(0, 14).map((x) => ({
    type: x?.type || null,
    title: stripHtml(x?.title || ""),
    url: normUrl(x?.url || ""),
    source: x?.source || null,
    mallName: x?.mallName || null,
    subscriberCount: Number.isFinite(Number(x?.subscriberCount)) ? Number(x.subscriberCount) : null,
  }));
}

async function generateStrategicDiagnosisLLM({
  companyName,
  industry,
  region,
  discovery,
  score,
  evidence,
}) {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return null;

  const model = env("OPENAI_MODEL") || "gpt-4.1-mini";

  const inputPayload = {
    company: { companyName, industry, region },
    score,
    assets: discovery?.assets || {},
    verified: discovery?.verified || {},
    pageSpeed: discovery?.pageSpeed || {},
    sourceStatus: discovery?.sourceStatus || {},
    rawCount: discovery?.rawCount || {},
    evidence: compactEvidenceForLLM(evidence),
  };

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      executiveSummary: { type: "string" },
      wins: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      risks: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      nextActions: {
        type: "array",
        items: { type: "string" },
        maxItems: 6
      },
      limits: {
        type: "array",
        items: { type: "string" },
        maxItems: 4
      },
      priorities: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            rank: { type: "integer" },
            title: { type: "string" },
            whyNow: { type: "string" },
            channels: {
              type: "array",
              items: { type: "string" },
              maxItems: 6
            },
            actions: {
              type: "array",
              items: { type: "string" },
              maxItems: 6
            },
            budgetKRW: { type: "string" },
            expectedOutcome: { type: "string" },
            expectedROI: { type: "string" },
            kpis: {
              type: "array",
              items: { type: "string" },
              maxItems: 8
            }
          },
          required: [
            "rank",
            "title",
            "whyNow",
            "channels",
            "actions",
            "budgetKRW",
            "expectedOutcome",
            "expectedROI",
            "kpis"
          ]
        }
      }
    },
    required: [
      "executiveSummary",
      "wins",
      "risks",
      "nextActions",
      "limits",
      "priorities"
    ]
  };

  const systemPrompt = [
    "You are a senior Korean digital marketing strategist for ecommerce brands.",
    "Use ONLY the provided collected facts.",
    "Do NOT invent official assets that were not verified.",
    "If PageSpeed failed, treat site performance as unknown, not automatically bad.",
    "If NAVER Store is missing, explain lower-funnel weakness and NAVER defense need.",
    "Give practical channel-specific strategy for Korea.",
    "Budget must be monthly KRW ranges, conservative and realistic.",
    "ROI/ROAS must be ranges with assumptions, not guarantees.",
    "Make output insightful, not generic."
  ].join(" ");

  const userPrompt = `
아래 수집 결과를 바탕으로 마케팅 전략을 재분석하세요.

반드시 지켜야 할 규칙:
1. verified=true 인 자산만 '확인된 공식 자산'으로 취급
2. verified=false 인 자산은 "후보" 또는 "미확인"으로 표현
3. 점수(score)는 사실로 받아들이되, 의미를 해석해서 우선순위를 정할 것
4. 예산은 월 기준 KRW 범위로 제시
5. expectedROI 는 "직접 ROAS", "blended ROI", "CPA 개선" 같은 보수적 표현으로 제시
6. nextActions 는 운영자가 바로 실행 가능한 문장으로 작성
7. priorities 는 rank 1~4로 작성
8. 너무 짧게 쓰지 말고, 근거 기반으로 구체적으로 작성

입력 데이터:
${JSON.stringify(inputPayload, null, 2)}
`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "marketing_reanalysis",
            strict: true,
            schema
          }
        },
        temperature: 0.4
      })
    });

    const json = await r.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!r.ok || !content) {
      return null;
    }

    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

function buildEvidence(blogItems, shopItems, webHome, webIg, ytCh) {
  const a = [];
  blogItems.slice(0, 4).forEach(x => a.push({ type: "blog", title: stripHtml(x.title), url: normUrl(x.link), source: "NAVER Blog" }));
  shopItems.slice(0, 4).forEach(x => a.push({ type: "shopping", title: stripHtml(x.title), url: normUrl(x.link), source: "NAVER Shopping", mallName: stripHtml(x.mallName) }));
  webHome.slice(0, 2).forEach(x => a.push({ type: "homepage-candidate", title: stripHtml(x.title), url: normUrl(x.link), source: "NAVER WebKR" }));
  webIg.slice(0, 2).forEach(x => a.push({ type: "instagram-candidate", title: stripHtml(x.title), url: normUrl(x.link), source: "NAVER WebKR" }));
  ytCh.slice(0, 2).forEach(x => a.push({ type: "youtube-candidate", title: x.title, url: normUrl(x.url), source: "YouTube", subscriberCount: x.subscriberCount }));
  return a;
}

function analyzeScores({ verified, pageSpeed, counts }) {
  const searchVisibility = clamp(
    (verified.homepage.verified ? 28 : 0) +
    (verified.instagram.verified ? 20 : 0) +
    (verified.youtube.verified ? 18 : 0) +
    Math.min(22, counts.blog * 2)
  );
  const contentPresence = clamp(
    Math.min(26, counts.blog * 2) +
    (verified.instagram.verified ? 22 : 0) +
    (verified.youtube.verified ? 22 : 0)
  );
  const localExposure = clamp(
    (verified.naverStore.verified ? 60 : 0) +
    Math.min(20, counts.shopping * 2)
  );
  const webQuality = clamp(pageSpeed?.ok ? Math.round(
    (n(pageSpeed.performanceScore) + n(pageSpeed.accessibilityScore) + n(pageSpeed.bestPracticesScore) + n(pageSpeed.seoScore)) / 4
  ) : 0);
  const overall = clamp(Math.round(searchVisibility * 0.3 + contentPresence * 0.25 + localExposure * 0.15 + webQuality * 0.3));
  return { overall, searchVisibility, contentPresence, localExposure, webQuality };
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "analyze route works", mode: "6-step-compact" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const companyName = s(body.companyName);
    const industry = s(body.industry);
    const region = s(body.region);
    const email = s(body.email);

    if (!companyName) {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }

    const naverCreds = {
      id: env("NAVER_CLIENT_ID", "NAVER_SEARCH_CLIENT_ID"),
      secret: env("NAVER_CLIENT_SECRET", "NAVER_SEARCH_CLIENT_SECRET"),
    };
    const youtubeKey = env("YOUTUBE_API_KEY");
    const pageSpeedKey = env("PAGESPEED_API_KEY", "GOOGLE_PAGESPEED_API_KEY");

    const q = {
      blog: [companyName, `${companyName} ${industry}`.trim(), `${companyName} ${region}`.trim()],
      shop: [companyName, `${companyName} 공식`, `${companyName} ${industry}`.trim()],
      webHome: [companyName, `${companyName} 공식`, `${companyName} 홈페이지`.trim()],
      webIg: [`${companyName} 인스타`, `${companyName} instagram`, `${companyName} 공식 인스타`],
      yt: [`${companyName} 유튜브`, `${companyName} youtube`, `${companyName} 공식 채널`],
    };

    // 1) 수집: NAVER 순차 + YouTube
    const blogR = await runNaver(NAVER.blog, q.blog, naverCreds);
    const shopR = await runNaver(NAVER.shop, q.shop, naverCreds);
    const webHomeR = await runNaver(NAVER.web, q.webHome, naverCreds);
    const webIgR = await runNaver(NAVER.web, q.webIg, naverCreds);
    const ytR = await runYoutube(q.yt, youtubeKey);

    // 2) 브랜드 토큰
    const aliasSeed = [
      ...webHomeR.items.map(x => x.link),
      ...webIgR.items.map(x => x.link),
      ...shopR.items.map(x => `${x.title} ${x.mallName}`),
      ...ytR.channels.map(x => `${x.title} ${x.customUrl || ""}`),
    ].filter(Boolean);
    const tokens = tokenizeBrand(companyName, industry, aliasSeed);

    // 3) 후보 생성
    const homepageCandidates = webHomeR.items.map(x => {
      const r = scoreHomepage(x, tokens);
      return { type: "homepage", title: stripHtml(x.title), description: stripHtml(x.description), url: normUrl(x.link), score: r.score, reason: r.reason };
    }).filter(x => x.score > 0);

    const instagramCandidates = webIgR.items.map(x => {
      const r = scoreInstagram(x, tokens);
      return { type: "instagram", title: stripHtml(x.title), description: stripHtml(x.description), url: normUrl(x.link), score: r.score, reason: r.reason };
    }).filter(x => x.score > 0);

    const storeCandidates = shopR.items.map(x => {
  const r = scoreStore(x, tokens, companyName);
  return {
    type: "naverStore",
    title: stripHtml(x.title),
    mallName: stripHtml(x.mallName),
    description: stripHtml(x.description),
    url: normUrl(x.link),
    score: r.score,
    reason: r.reason
  };
}).filter(x => x.score > 0);


    const youtubeCandidates = ytR.channels.map(x => {
      const r = scoreYoutube(x, tokens);
      return { type: "youtube", title: x.title, description: x.description, url: normUrl(x.url), subscriberCount: x.subscriberCount, videoCount: x.videoCount, score: r.score, reason: r.reason };
    }).filter(x => x.score > 0);

    // 4) 점수화 + 후보 선택
    const homePick = chooseBest(homepageCandidates, T.homepage);
    const igPick = chooseBest(instagramCandidates, T.instagram);
    const storePick = chooseBest(storeCandidates, T.naverStore);
    const ytPick = chooseBest(youtubeCandidates, T.youtube);

// homepage: 3rd-party가 최종 선택되면 제외하고 재선택
if (homePick.chosen && isThirdPartyHomepageHost(hostOf(homePick.chosen.url))) {
  homePick.chosen =
    [...homepageCandidates]
      .filter(x => !isThirdPartyHomepageHost(hostOf(x.url)))
      .sort((a, b) => b.score - a.score)[0] || null;
}

// naverStore: product detail 이 최종 선택되면 무효화
if (storePick.chosen && /^\/main\/products\//i.test(pathOf(storePick.chosen.url))) {
  storePick.chosen =
    [...storeCandidates]
      .filter(x => !/^\/main\/products\//i.test(pathOf(x.url)))
      .sort((a, b) => b.score - a.score)[0] || null;
}


    // 5) 검증 / 신뢰도
    const pageSpeed = await fetchPageSpeed(homePick.chosen?.url || "", pageSpeedKey);
    const verified = {
      homepage: summarizeVerifiedAsset("homepage", homePick.chosen),
      instagram: summarizeVerifiedAsset("instagram", igPick.chosen),
      youtube: summarizeVerifiedAsset("youtube", ytPick.chosen),
      naverStore: summarizeVerifiedAsset("naverStore", storePick.chosen),
      map: { found: false, verified: false, score: 0, confidence: "낮음", reason: null, url: null, title: null, type: "map" },
    };

    const sourceStatus = {
      naverBlog: { ...blogR.status, candidateFound: blogR.items.length > 0, verified: blogR.items.length > 0 },
      naverShopping: { ...shopR.status, candidateFound: !!storePick.top, verified: !!storePick.chosen },
      naverWebHomepage: { ...webHomeR.status, candidateFound: !!homePick.top, verified: !!homePick.chosen },
      naverWebInstagram: { ...webIgR.status, candidateFound: !!igPick.top, verified: !!igPick.chosen },
      youtube: { ...ytR.status, candidateFound: !!ytPick.top, verified: !!ytPick.chosen },
      pageSpeed: {
        fetchOk: !!pageSpeed.ok, parseOk: !!pageSpeed.ok, candidateFound: !!homePick.chosen, verified: !!pageSpeed.ok,
        total: pageSpeed.ok ? 1 : 0, rawItems: pageSpeed.ok ? 1 : 0, status: pageSpeed.ok ? 200 : null, error: pageSpeed.error || null, errorCount: pageSpeed.ok ? 0 : 1,
      },
    };

    const evidence = buildEvidence(blogR.items, shopR.items, webHomeR.items, webIgR.items, ytR.channels);
    const rawCount = {
      naverBlog: blogR.items.length,
      naverShopping: shopR.items.length,
      naverWebHomepage: webHomeR.items.length,
      naverWebInstagram: webIgR.items.length,
      youtube: ytR.channels.length,
      evidence: evidence.length,
    };

    // 6) 진단 / 처방
    const score = analyzeScores({
      verified,
      pageSpeed,
      counts: { blog: rawCount.naverBlog, shopping: rawCount.naverShopping },
    });

    const discovery = {
      assets: {
        homepage: homePick.chosen?.url || null,
        instagram: igPick.chosen?.url || null,
        youtube: ytPick.chosen?.url || null,
        naverStore: storePick.chosen?.url || null,
        map: null,
      },
      verified,
      pageSpeed,
      sourceStatus,
      rawCount,
    };

        let diagnosis = {
      confidence: scoreToConfidence(score.overall),
      score,
      executiveSummary:
        score.overall >= 70 ? "공식 자산 확인이 비교적 안정적입니다." :
        score.overall >= 45 ? "일부 공식 자산은 보이지만 검증 일관성이 부족합니다." :
        "브랜드 공식 자산 신호가 약하거나 후보 점수가 임계값에 미달합니다.",
      wins: [
        verified.homepage.verified ? "홈페이지 후보 검증 성공" : null,
        verified.instagram.verified ? "인스타그램 후보 검증 성공" : null,
        verified.youtube.verified ? "유튜브 후보 검증 성공" : null,
        verified.naverStore.verified ? "네이버 쇼핑/스토어 후보 검증 성공" : null,
      ].filter(Boolean),
      risks: [
        !verified.homepage.verified ? "홈페이지 공식성 부족" : null,
        !verified.instagram.verified ? "인스타그램 브랜드 일치 부족" : null,
        !verified.youtube.verified ? "유튜브 공식 채널 일치 부족" : null,
        sourceStatus.naverShopping.error ? "NAVER Shopping 수집 오류" : null,
        !pageSpeed.ok ? "PageSpeed 미수집 또는 홈페이지 부재" : null,
      ].filter(Boolean),
      nextActions: [
        "공식 랜딩 URL 1개로 통일",
        "인스타/유튜브 핸들에 브랜드 토큰 일치",
        "NAVER Shopping 노출/브랜드스토어 정비",
        "홈페이지 확인 후 PageSpeed 재측정",
      ],
      limits: [
        "현재 답변은 룰 기반 요약이며 상세 전략·예산은 보수적으로 해석해야 합니다."
      ]
    };

    let prescription = {
      stage: { code: "6-step-compact", name: "점수·신뢰도·후보 선별 정리본" },
      priorities: [],
      budgetSummary: null,
      assumptions: [],
      kpi: [
        "브랜드 검색량",
        "공식 랜딩 CTR",
        "인스타 프로필 방문→클릭률",
        "유튜브 유입률",
        "NAVER Shopping 유입/전환",
      ],
    };

    const aiStrategy = await generateStrategicDiagnosisLLM({
      companyName,
      industry,
      region,
      discovery,
      score,
      evidence,
    });

    if (aiStrategy) {
      diagnosis = {
        ...diagnosis,
        executiveSummary: aiStrategy.executiveSummary || diagnosis.executiveSummary,
        wins: Array.isArray(aiStrategy.wins) && aiStrategy.wins.length ? aiStrategy.wins : diagnosis.wins,
        risks: Array.isArray(aiStrategy.risks) && aiStrategy.risks.length ? aiStrategy.risks : diagnosis.risks,
        nextActions: Array.isArray(aiStrategy.nextActions) && aiStrategy.nextActions.length ? aiStrategy.nextActions : diagnosis.nextActions,
        limits: Array.isArray(aiStrategy.limits) && aiStrategy.limits.length ? aiStrategy.limits : diagnosis.limits,
      };

      prescription = {
        stage: {
          code: "llm-strategic-analysis",
          name: "LLM 재분석 기반 마케팅 전략"
        },
        priorities: Array.isArray(aiStrategy.priorities) ? aiStrategy.priorities : [],
        budgetSummary: null,
        assumptions: Array.isArray(aiStrategy.limits) ? aiStrategy.limits : [],
        kpi: Array.isArray(aiStrategy.priorities)
          ? Array.from(new Set(aiStrategy.priorities.flatMap(x => Array.isArray(x.kpis) ? x.kpis : []))).slice(0, 12)
          : prescription.kpi
      };
    }


    return res.status(200).json({
      ok: true,
      input: { companyName, industry, region, email },
      discovery,
      diagnosis,
      evidence,
      prescription,
      debug: {
        stage: "6-step-compact",
        queries: q,
        thresholds: T,
        brandTokens: tokens,
        candidates: {
          homepage: homepageCandidates.slice(0, 5),
          instagram: instagramCandidates.slice(0, 5),
          youtube: youtubeCandidates.slice(0, 5),
          naverStore: storeCandidates.slice(0, 5),
        },
        requestLog: {
          naverBlog: blogR.requestLog,
          naverShopping: shopR.requestLog,
          naverWebHomepage: webHomeR.requestLog,
          naverWebInstagram: webIgR.requestLog,
          youtube: ytR.requestLog,
        },
        env: {
          naver: !!(naverCreds.id && naverCreds.secret),
          youtube: !!youtubeKey,
          pageSpeed: !!pageSpeedKey,
        },
      },
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "internal error",
      mode: "6-step-compact",
    });
  }
}

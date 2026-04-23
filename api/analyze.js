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

const env = (...keys) => keys.map((k) => process.env[k]).find(Boolean) || "";
const APP_SCRIPT_URL =
  env("GOOGLE_APPS_SCRIPT_URL") ||
  "https://script.google.com/macros/s/AKfycbyTr4SGC5TqHz8g518nPjCUIBHX2LaG5DUaezdKSQ0h5SFKmG-sh9W7u9pi3iAGCNDU/exec";
const s = (v) => (v == null ? "" : String(v)).trim();
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, n(x)));
const uniqBy = (arr, fn) => Array.from(new Map((arr || []).map((x) => [fn(x), x])).values());
const stripHtml = (t) => s(t).replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const normText = (t) => stripHtml(t).toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
const normUrl = (u) => {
  try {
    const x = new URL(/^https?:\/\//i.test(s(u)) ? s(u) : `https://${s(u)}`);
    x.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => x.searchParams.delete(k));
    return x.toString().replace(/\/$/, "");
  } catch {
    return s(u);
  }
};
const hostOf = (u) => {
  try {
    return new URL(normUrl(u)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
const pathOf = (u) => {
  try {
    return new URL(normUrl(u)).pathname.toLowerCase();
  } catch {
    return "";
  }
};
const scoreToConfidence = (sc) => (sc >= 80 ? "높음" : sc >= 50 ? "중간" : "낮음");

function parseRequestBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body || "{}");
    } catch {
      return {};
    }
  }
  return body;
}

function parseJsonText(text) {
  const raw = s(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}
function getClientIp(req) {
  const xff = s(req?.headers?.["x-forwarded-for"]);
  if (xff) return xff.split(",")[0].trim();
  return s(req?.headers?.["x-real-ip"]) || s(req?.socket?.remoteAddress) || "";
}

function todaySeoul() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "00";
  const d = parts.find((p) => p.type === "day")?.value || "00";
  return `${y}-${m}-${d}`;
}

async function sha256HexValue(text) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(s(text)).digest("hex");
}

async function postAppScriptJson(action, payload = {}) {
  if (!APP_SCRIPT_URL) {
    return { ok: false, error: "missing GOOGLE_APPS_SCRIPT_URL" };
  }

  try {
    const r = await fetch(APP_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        ...payload,
      }),
    });

    const text = await r.text();
    const json = parseJsonText(text);

    if (!json || typeof json !== "object") {
      return {
        ok: false,
        error: "app script response is not valid JSON",
        raw: text,
      };
    }

    return json;
  } catch (e) {
    return {
      ok: false,
      error: e?.message || "app script fetch failed",
    };
  }
}

async function checkDailyIpLimit(ipHash, requestDate) {
  return postAppScriptJson("check_limit", {
    ip_hash: ipHash,
    request_date: requestDate,
  });
}

async function saveDiagnosisToSheet(data) {
  return postAppScriptJson("save_diagnosis", {
    data,
  });
}

function makeStatus() {
  return {
    fetchOk: false,
    parseOk: false,
    candidateFound: false,
    verified: false,
    total: 0,
    rawItems: 0,
    status: null,
    error: null,
    errorCount: 0,
  };
}

function tokenizeBrand(companyName, industry = "", aliases = []) {
  const seed = [companyName, industry, ...(aliases || [])].map(normText).filter(Boolean);
  const set = new Set();
  for (const x of seed) {
    set.add(x);
    x.split(/[^a-z0-9가-힣]+/).filter((v) => v.length >= 2).forEach((v) => set.add(v));
    if (x.includes("marketkurly")) {
      set.add("kurly");
      set.add("마켓컬리");
      set.add("컬리");
    }
    if (x.includes("kurly")) {
      set.add("marketkurly");
      set.add("마켓컬리");
      set.add("컬리");
    }
    if (x.includes("마켓컬리")) {
      set.add("kurly");
      set.add("marketkurly");
      set.add("컬리");
    }
  }
  return Array.from(set).filter((v) => v.length >= 2);
}

function cleanBrandTokens(tokens = []) {
  return uniqBy(
    (tokens || [])
      .filter(Boolean)
      .filter((t) => !/^https?/i.test(t))
      .filter((t) => !/\.(com|co\.kr|kr|org|net)/i.test(t))
      .filter((t) => String(t).length >= 2 && String(t).length <= 30),
    (x) => x
  );
}

function brandMatch(text, tokens) {
  const z = normText(text);
  const matched = (tokens || []).filter((t) => z.includes(t));
  let score = 0;
  for (const t of matched) score += t.length >= 8 ? 24 : t.length >= 5 ? 18 : 12;
  return { matched, score: clamp(score, 0, 45) };
}

function hasBrandGate(text, url, tokens) {
  const b = brandMatch(`${text} ${url}`, tokens);
  const h = hostOf(url);
  const p = pathOf(url);
  const hostHit = (tokens || []).some((t) => normText(h).includes(t) || normText(p).includes(t));
  return b.score > 0 || hostHit;
}

function noisePenalty(text) {
  const z = s(text).toLowerCase();
  let p = 0;
  if (LOCATION_WORDS.some((w) => z.includes(w))) p += 10;
  if (/후기|리뷰|추천|맛집|체험단|중고|구매후기/i.test(z)) p += 8;
  return p;
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
  return cleaned.some((t) => t.length >= 5 && h.includes(normText(t)));
}

function hasStrictStoreBrand(text = "", url = "", companyName = "") {
  const joined = normText(`${text} ${url}`);
  const company = normText(companyName);
  return !!((company && joined.includes(company)) || joined.includes("marketkurly") || pathOf(url).includes("marketkurly"));
}

function scoreHomepage(c, tokens) {
  const title = stripHtml(c?.title);
  const desc = stripHtml(c?.description);
  const url = normUrl(c?.link || c?.url);
  const h = hostOf(url);
  const depth = pathDepth(url);
  const b = brandMatch(`${title} ${desc} ${url}`, tokens);

  if (!url || SOCIAL.includes(h) || NOISY.includes(h)) return { score: 0, pass: false, reason: "noisy/social" };
  if (b.score <= 0) return { score: 0, pass: false, reason: "brand-gate" };

  let score = 20 + b.score;
  if (hasHostBrandHit(url, tokens)) score += 22;
  if (depth === 0) score += 18;
  else if (depth >= 3) score -= 12;
  if (/\.(co\.kr|com|kr)$/i.test(h)) score += 8;
  if (isThirdPartyHomepageHost(h)) score -= 45;
  if (OFFICIAL_RE.test(`${title} ${desc}`) && !isThirdPartyHomepageHost(h)) score += 12;
  score -= noisePenalty(`${title} ${desc} ${url}`);

  const finalScore = clamp(score);
  return { score: finalScore, pass: finalScore >= T.homepage, reason: "ok" };
}

function scoreInstagram(c, tokens) {
  const title = stripHtml(c?.title);
  const desc = stripHtml(c?.description);
  const url = normUrl(c?.link || c?.url);
  const h = hostOf(url);
  const p = pathOf(url);
  if (!/instagram\.com$/i.test(h)) return { score: 0, pass: false, reason: "not-instagram" };
  if (!hasBrandGate(`${title} ${desc}`, url, tokens)) return { score: 0, pass: false, reason: "brand-gate" };

  let score = 24 + brandMatch(`${title} ${desc} ${url}`, tokens).score;
  if (OFFICIAL_RE.test(`${title} ${desc} ${p}`)) score += 12;
  if (p.split("/").filter(Boolean).length === 1) score += 12;
  score -= noisePenalty(`${title} ${desc} ${url}`);

  const finalScore = clamp(score);
  return { score: finalScore, pass: finalScore >= T.instagram, reason: "ok" };
}

function scoreStore(c, tokens, companyName = "") {
  const title = stripHtml(c?.title);
  const mall = stripHtml(c?.mallName);
  const desc = stripHtml(c?.description);
  const url = normUrl(c?.link || c?.url);
  const h = hostOf(url);
  const p = pathOf(url);

  if (!hasStrictStoreBrand(`${title} ${mall} ${desc}`, url, companyName)) {
    return { score: 0, pass: false, reason: "strict-brand-gate" };
  }
  if (/search\.shopping\.naver\.com$/i.test(h)) return { score: 0, pass: false, reason: "catalog-page" };
  if (/smartstore\.naver\.com$/i.test(h) && /^\/main\/products\//i.test(p)) {
    return { score: 0, pass: false, reason: "product-detail" };
  }

  let score = 24 + brandMatch(`${title} ${mall} ${desc} ${url}`, cleanBrandTokens(tokens)).score;
  if (/공식스토어|공식몰|브랜드스토어/i.test(`${title} ${mall}`)) score += 16;
  if (/brand\.naver\.com$/i.test(h)) score += 28;
  if (/smartstore\.naver\.com$/i.test(h) && p.split("/").filter(Boolean).length === 1) score += 18;
  score -= noisePenalty(`${title} ${mall} ${url}`);

  const finalScore = clamp(score);
  return { score: finalScore, pass: finalScore >= T.naverStore, reason: "ok" };
}

function scoreYoutube(c, tokens) {
  const title = stripHtml(c?.title);
  const desc = stripHtml(c?.description);
  const url = normUrl(c?.url);
  if (!hasBrandGate(`${title} ${desc}`, url, tokens)) return { score: 0, pass: false, reason: "brand-gate" };

  let score = 22 + brandMatch(`${title} ${desc} ${url}`, tokens).score;
  if (OFFICIAL_RE.test(`${title} ${desc}`)) score += 14;
  if (/\/@/.test(url)) score += 8;
  score += Math.min(12, Math.floor(Math.log10((n(c?.subscriberCount) || 1)) * 4));
  score -= noisePenalty(`${title} ${desc} ${url}`);

  const finalScore = clamp(score);
  return { score: finalScore, pass: finalScore >= T.youtube, reason: "ok" };
}

function chooseBest(list, threshold) {
  const arr = [...(list || [])].sort((a, b) => b.score - a.score);
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
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: r.ok, status: r.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: "", error: e?.message || "fetch failed" };
  } finally {
    clearTimeout(id);
  }
}

async function runNaver(endpoint, queries, creds) {
  const out = { items: [], requestLog: [], status: makeStatus() };
  if (!creds?.id || !creds?.secret) {
    out.status.error = "missing NAVER credentials";
    return out;
  }

  for (const q of uniqBy((queries || []).filter(Boolean), (x) => x)) {
    const url = `${endpoint}?query=${encodeURIComponent(q)}&display=10&sort=sim`;
    const r = await fetchJson(url, {
      "X-Naver-Client-Id": creds.id,
      "X-Naver-Client-Secret": creds.secret,
    });
    out.requestLog.push({ q, status: r.status, ok: r.ok });
    out.status.status = r.status || out.status.status;

    if (r.status === 429) {
      out.status.error = "naver rate limit";
      out.status.errorCount += 1;
      break;
    }
    if (!r.ok || !r.json) {
      out.status.error = r.error || `status ${r.status}`;
      out.status.errorCount += 1;
      continue;
    }

    out.status.fetchOk = true;
    out.status.parseOk = Array.isArray(r.json.items);
    out.items.push(...(r.json.items || []));
  }

  out.items = uniqBy(out.items, (x) => normUrl(x?.link || x?.url));
  out.status.total = out.items.length;
  out.status.rawItems = out.items.length;
  return out;
}

async function runYoutube(queries, apiKey) {
  const status = makeStatus();
  const items = [];
  const logs = [];

  if (!apiKey) {
    status.error = "missing YOUTUBE_API_KEY";
    return { items, channels: [], requestLog: logs, status };
  }

  for (const q of uniqBy((queries || []).filter(Boolean), (x) => x)) {
    const url = `${YT_SEARCH}?part=snippet&type=channel&maxResults=5&q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`;
    const r = await fetchJson(url);
    logs.push({ q, status: r.status, ok: r.ok });
    status.status = r.status || status.status;

    if (!r.ok || !r.json) {
      status.error = r.error || `status ${r.status}`;
      status.errorCount += 1;
      continue;
    }

    status.fetchOk = true;
    status.parseOk = Array.isArray(r.json.items);
    items.push(...(r.json.items || []));
  }

  const ids = uniqBy(items.map((x) => x?.snippet?.channelId).filter(Boolean), (x) => x);
  if (!ids.length) {
    status.total = 0;
    status.rawItems = 0;
    return { items, channels: [], requestLog: logs, status };
  }

  const url = `${YT_CHANNELS}?part=snippet,statistics&id=${ids.join(",")}&key=${encodeURIComponent(apiKey)}`;
  const r2 = await fetchJson(url);
  status.status = r2.status || status.status;

  if (!r2.ok || !r2.json) {
    status.error = r2.error || `status ${r2.status}`;
    status.errorCount += 1;
    return { items, channels: [], requestLog: logs, status };
  }

  const channels = (r2.json.items || []).map((x) => ({
    id: x?.id,
    title: x?.snippet?.title || "",
    description: x?.snippet?.description || "",
    customUrl: x?.snippet?.customUrl || "",
    publishedAt: x?.snippet?.publishedAt || "",
    subscriberCount: n(x?.statistics?.subscriberCount),
    videoCount: n(x?.statistics?.videoCount),
    url: x?.snippet?.customUrl ? `https://www.youtube.com/${x.snippet.customUrl}` : `https://www.youtube.com/channel/${x?.id}`,
  }));

  status.total = channels.length;
  status.rawItems = channels.length;
  return { items, channels, requestLog: logs, status };
}

async function fetchPageSpeed(url, apiKey) {
  if (!url) return { ok: false, error: "homepage missing" };
  if (!apiKey) return { ok: false, error: "missing PAGESPEED_API_KEY" };

  const api = `${PSI}?url=${encodeURIComponent(url)}&strategy=mobile&key=${encodeURIComponent(apiKey)}`;
  const r = await fetchJson(api, {}, 15000);
  if (!r.ok || !r.json) return { ok: false, error: r.error || `status ${r.status}` };

  const cats = r.json?.lighthouseResult?.categories || {};
  const to100 = (x) => clamp(Math.round((n(x) || 0) * 100));
  return {
    ok: true,
    performanceScore: to100(cats?.performance?.score),
    accessibilityScore: to100(cats?.accessibility?.score),
    bestPracticesScore: to100(cats?.["best-practices"]?.score),
    seoScore: to100(cats?.seo?.score),
  };
}

function buildEvidence(blogItems, shopItems, webHome, webIg, ytChannels) {
  const out = [];
  blogItems.slice(0, 4).forEach((x) => out.push({ type: "blog", title: stripHtml(x?.title), url: normUrl(x?.link), source: "NAVER Blog" }));
  shopItems.slice(0, 4).forEach((x) => out.push({ type: "shopping", title: stripHtml(x?.title), url: normUrl(x?.link), source: "NAVER Shopping", mallName: stripHtml(x?.mallName) }));
  webHome.slice(0, 2).forEach((x) => out.push({ type: "homepage-candidate", title: stripHtml(x?.title), url: normUrl(x?.link), source: "NAVER WebKR" }));
  webIg.slice(0, 2).forEach((x) => out.push({ type: "instagram-candidate", title: stripHtml(x?.title), url: normUrl(x?.link), source: "NAVER WebKR" }));
  ytChannels.slice(0, 2).forEach((x) => out.push({ type: "youtube-candidate", title: x?.title, url: normUrl(x?.url), source: "YouTube", subscriberCount: x?.subscriberCount || 0 }));
  return out;
}

function analyzeScores({ verified, pageSpeed, counts }) {
  const searchVisibility = clamp((verified?.homepage?.verified ? 28 : 0) + (verified?.instagram?.verified ? 20 : 0) + (verified?.youtube?.verified ? 18 : 0) + Math.min(22, n(counts?.blog) * 2));
  const contentPresence = clamp(Math.min(26, n(counts?.blog) * 2) + (verified?.instagram?.verified ? 22 : 0) + (verified?.youtube?.verified ? 22 : 0));
  const localExposure = clamp((verified?.naverStore?.verified ? 60 : 0) + Math.min(20, n(counts?.shopping) * 2));
  const webQuality = clamp(pageSpeed?.ok ? Math.round((n(pageSpeed?.performanceScore) + n(pageSpeed?.accessibilityScore) + n(pageSpeed?.bestPracticesScore) + n(pageSpeed?.seoScore)) / 4) : 0);
  const overall = clamp(Math.round(searchVisibility * 0.3 + contentPresence * 0.25 + localExposure * 0.15 + webQuality * 0.3));
  return { overall, searchVisibility, contentPresence, localExposure, webQuality };
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

async function generateStrategicDiagnosisGemini({ companyName, industry, region, discovery, score, evidence }) {
  const apiKey = env("GEMINI_API_KEY", "GOOGLE_API_KEY");
  if (!apiKey) return null;

  const model = env("GEMINI_MODEL") || "gemini-2.5-flash";
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

  const responseJsonSchema = {
    type: "object",
    properties: {
      executiveSummary: { type: "string" },
      wins: { type: "array", items: { type: "string" } },
      risks: { type: "array", items: { type: "string" } },
      nextActions: { type: "array", items: { type: "string" } },
      limits: { type: "array", items: { type: "string" } },
      priorities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rank: { type: "integer" },
            title: { type: "string" },
            whyNow: { type: "string" },
            channels: { type: "array", items: { type: "string" } },
            actions: { type: "array", items: { type: "string" } },
            budgetKRW: { type: "string" },
            expectedOutcome: { type: "string" },
            expectedROI: { type: "string" },
            kpis: { type: "array", items: { type: "string" } },
          },
          required: ["rank", "title", "whyNow", "channels", "actions", "budgetKRW", "expectedOutcome", "expectedROI", "kpis"],
        },
      },
    },
    required: ["executiveSummary", "wins", "risks", "nextActions", "limits", "priorities"],
  };

  const prompt = `당신은 한국 이커머스 브랜드 전문 시니어 디지털 마케팅 전략가입니다.

반드시 지켜야 할 규칙:
1. 아래 제공된 수집 결과만 근거로 해석할 것
2. verified=true 인 자산만 '확인된 공식 자산'으로 표현할 것
3. verified=false 인 자산은 '후보' 또는 '미확인'으로 표현할 것
4. PageSpeed 실패는 '성능 나쁨' 확정이 아니라 '미확인'으로 해석할 것
5. NAVER Store가 없으면 네이버 하단 퍼널 약점과 브랜드 방어 필요성을 설명할 것
6. 예산은 월 기준 KRW 범위로 제시할 것
7. ROI/ROAS는 보수적 범위로 제시하고 보장처럼 쓰지 말 것
8. 너무 일반론적으로 쓰지 말고, 점수/근거/채널 상태를 연결해서 설명할 것
9. 한국 시장 기준의 실무적인 채널 제안으로 작성할 것

입력 데이터:
${JSON.stringify(inputPayload, null, 2)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseJsonSchema,
        },
      }),
    });

    const json = await r.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("") || "";
    if (!r.ok || !text) return null;
    return parseJsonText(text);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, message: "analyze route works", mode: "gemini-llm-stable" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = parseRequestBody(req.body);
    const companyName = s(body?.companyName);
    const industry = s(body?.industry);
    const region = s(body?.region);
    const email = s(body?.email);

    if (!companyName) {
      return res.status(400).json({ ok: false, error: "companyName is required" });
    }
        const clientIp = getClientIp(req);
    const requestDate = todaySeoul();

    // IP가 비어도 완전히 실패하지 않게 fallback 포함
    const ipHash = await sha256HexValue(
      clientIp || `${companyName}|${email || "no-email"}|unknown-ip`
    );

    const limitCheck = await checkDailyIpLimit(ipHash, requestDate);

    if (!limitCheck?.ok) {
      return res.status(503).json({
        ok: false,
        error: "저장소 연결 오류로 진단을 진행할 수 없습니다.",
        code: "STORAGE_UNAVAILABLE",
      });
    }

    if (limitCheck.allowed === false) {
      return res.status(429).json({
        ok: false,
        error: "동일한 IP에서는 하루에 2번까지만 이용할 수 있습니다. 내일 다시 시도해주세요.",
        code: "RATE_LIMIT_DAILY_IP",
        dailyCount: limitCheck.dailyCount,
        limit: limitCheck.limit,
      });
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

    const blogR = await runNaver(NAVER.blog, q.blog, naverCreds);
    const shopR = await runNaver(NAVER.shop, q.shop, naverCreds);
    const webHomeR = await runNaver(NAVER.web, q.webHome, naverCreds);
    const webIgR = await runNaver(NAVER.web, q.webIg, naverCreds);
    const ytR = await runYoutube(q.yt, youtubeKey);

    const aliasSeed = [
      ...webHomeR.items.map((x) => x?.link),
      ...webIgR.items.map((x) => x?.link),
      ...shopR.items.map((x) => `${x?.title || ""} ${x?.mallName || ""}`),
      ...ytR.channels.map((x) => `${x?.title || ""} ${x?.customUrl || ""}`),
    ].filter(Boolean);

    const tokens = tokenizeBrand(companyName, industry, aliasSeed);

    const homepageCandidates = webHomeR.items
      .map((x) => {
        const r = scoreHomepage(x, tokens);
        return {
          type: "homepage",
          title: stripHtml(x?.title),
          description: stripHtml(x?.description),
          url: normUrl(x?.link),
          score: r.score,
          reason: r.reason,
        };
      })
      .filter((x) => x.score > 0);

    const instagramCandidates = webIgR.items
      .map((x) => {
        const r = scoreInstagram(x, tokens);
        return {
          type: "instagram",
          title: stripHtml(x?.title),
          description: stripHtml(x?.description),
          url: normUrl(x?.link),
          score: r.score,
          reason: r.reason,
        };
      })
      .filter((x) => x.score > 0);

    const storeCandidates = shopR.items
      .map((x) => {
        const r = scoreStore(x, tokens, companyName);
        return {
          type: "naverStore",
          title: stripHtml(x?.title),
          mallName: stripHtml(x?.mallName),
          description: stripHtml(x?.description),
          url: normUrl(x?.link),
          score: r.score,
          reason: r.reason,
        };
      })
      .filter((x) => x.score > 0);

    const youtubeCandidates = ytR.channels
      .map((x) => {
        const r = scoreYoutube(x, tokens);
        return {
          type: "youtube",
          title: x?.title || "",
          description: x?.description || "",
          url: normUrl(x?.url),
          subscriberCount: n(x?.subscriberCount),
          videoCount: n(x?.videoCount),
          score: r.score,
          reason: r.reason,
        };
      })
      .filter((x) => x.score > 0);

    const homePick = chooseBest(homepageCandidates, T.homepage);
    const igPick = chooseBest(instagramCandidates, T.instagram);
    const storePick = chooseBest(storeCandidates, T.naverStore);
    const ytPick = chooseBest(youtubeCandidates, T.youtube);

    if (homePick.chosen && isThirdPartyHomepageHost(hostOf(homePick.chosen.url))) {
      homePick.chosen = [...homepageCandidates]
        .filter((x) => !isThirdPartyHomepageHost(hostOf(x.url)))
        .sort((a, b) => b.score - a.score)[0] || null;
    }

    if (storePick.chosen && /^\/main\/products\//i.test(pathOf(storePick.chosen.url))) {
      storePick.chosen = [...storeCandidates]
        .filter((x) => !/^\/main\/products\//i.test(pathOf(x.url)))
        .sort((a, b) => b.score - a.score)[0] || null;
    }

    const pageSpeed = await fetchPageSpeed(homePick?.chosen?.url || "", pageSpeedKey);

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
        fetchOk: !!pageSpeed?.ok,
        parseOk: !!pageSpeed?.ok,
        candidateFound: !!homePick?.chosen,
        verified: !!pageSpeed?.ok,
        total: pageSpeed?.ok ? 1 : 0,
        rawItems: pageSpeed?.ok ? 1 : 0,
        status: pageSpeed?.ok ? 200 : null,
        error: pageSpeed?.error || null,
        errorCount: pageSpeed?.ok ? 0 : 1,
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

    const score = analyzeScores({
      verified,
      pageSpeed,
      counts: { blog: rawCount.naverBlog, shopping: rawCount.naverShopping },
    });

    const discovery = {
      assets: {
        homepage: homePick?.chosen?.url || null,
        instagram: igPick?.chosen?.url || null,
        youtube: ytPick?.chosen?.url || null,
        naverStore: storePick?.chosen?.url || null,
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
        score.overall >= 70
          ? "공식 자산 확인이 비교적 안정적입니다."
          : score.overall >= 45
            ? "일부 공식 자산은 보이지만 검증 일관성이 부족합니다."
            : "브랜드 공식 자산 신호가 약하거나 후보 점수가 임계값에 미달합니다.",
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
        !pageSpeed.ok ? `PageSpeed 미수집 또는 홈페이지 부재${pageSpeed?.error ? ` (${pageSpeed.error})` : ""}` : null,
      ].filter(Boolean),
      nextActions: [
        "공식 랜딩 URL 1개로 통일",
        "인스타/유튜브 핸들에 브랜드 토큰 일치",
        "NAVER Shopping 노출/브랜드스토어 정비",
        "홈페이지 확인 후 PageSpeed 재측정",
      ],
      limits: ["LLM 재분석이 실패하면 기본 룰 기반 진단으로 반환됩니다."],
    };

    let prescription = {
      stage: { code: "gemini-llm-stable", name: "Gemini 재분석 기반 마케팅 전략" },
      priorities: [],
      budgetSummary: null,
      assumptions: ["예산/ROI는 실제 객단가와 공헌이익률에 따라 달라집니다."],
      kpi: ["브랜드 검색량", "공식 랜딩 CTR", "구매 전환율", "채널별 CPA", "채널별 ROAS"],
    };

    const aiStrategy = await generateStrategicDiagnosisGemini({
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
        executiveSummary: aiStrategy?.executiveSummary || diagnosis.executiveSummary,
        wins: Array.isArray(aiStrategy?.wins) && aiStrategy.wins.length ? aiStrategy.wins : diagnosis.wins,
        risks: Array.isArray(aiStrategy?.risks) && aiStrategy.risks.length ? aiStrategy.risks : diagnosis.risks,
        nextActions: Array.isArray(aiStrategy?.nextActions) && aiStrategy.nextActions.length ? aiStrategy.nextActions : diagnosis.nextActions,
        limits: Array.isArray(aiStrategy?.limits) && aiStrategy.limits.length ? aiStrategy.limits : diagnosis.limits,
      };

      prescription = {
        stage: { code: "llm-strategic-analysis", name: "Gemini 재분석 기반 마케팅 전략" },
        priorities: Array.isArray(aiStrategy?.priorities) ? aiStrategy.priorities : [],
        budgetSummary: null,
        assumptions: Array.isArray(aiStrategy?.limits) ? aiStrategy.limits : prescription.assumptions,
        kpi: Array.isArray(aiStrategy?.priorities)
          ? Array.from(new Set(aiStrategy.priorities.flatMap((x) => (Array.isArray(x?.kpis) ? x.kpis : [])))).slice(0, 12)
          : prescription.kpi,
      };
    }

    const responsePayload = {
      ok: true,
      input: { companyName, industry, region, email },
      discovery,
      diagnosis,
      evidence,
      prescription,
      debug: {
        stage: "gemini-llm-stable",
        queries: q,
        thresholds: T,
        brandTokens: cleanBrandTokens(tokens),
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
          gemini: !!env("GEMINI_API_KEY", "GOOGLE_API_KEY"),
        },
        ai: {
          used: !!aiStrategy,
          model: !!aiStrategy ? (env("GEMINI_MODEL") || "gemini-2.5-flash") : null,
        },
      },
    };

    const sheetSaveResult = await saveDiagnosisToSheet({
      request_date: requestDate,
      ip_hash: ipHash,
      company_name: companyName,
      industry,
      region,
      email,
      overall_score: score.overall,
      confidence: diagnosis.confidence,
      homepage: discovery?.assets?.homepage || "",
      instagram: discovery?.assets?.instagram || "",
      youtube: discovery?.assets?.youtube || "",
      naver_store: discovery?.assets?.naverStore || "",
      pagespeed_ok: !!pageSpeed?.ok,
      pagespeed_error: pageSpeed?.error || "",
      raw_count_blog: rawCount?.naverBlog || 0,
      raw_count_shopping: rawCount?.naverShopping || 0,
      raw_count_web_homepage: rawCount?.naverWebHomepage || 0,
      raw_count_web_instagram: rawCount?.naverWebInstagram || 0,
      raw_count_youtube: rawCount?.youtube || 0,
      executive_summary: diagnosis?.executiveSummary || "",
      full_response_json: responsePayload,
    });

    responsePayload.debug.storage = {
      enabled: !!APP_SCRIPT_URL,
      rateLimitChecked: true,
      limitCheckOk: !!limitCheck?.ok,
      saveOk: !!sheetSaveResult?.ok,
      rowNumber: sheetSaveResult?.rowNumber || null,
    };

    return res.status(200).json(responsePayload);

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "internal error",
      mode: "gemini-llm-stable",
    });
  }
}

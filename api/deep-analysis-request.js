const env = (...keys) => keys.map((k) => process.env[k]).find(Boolean) || "";
const APP_SCRIPT_URL =
  env("GOOGLE_APPS_SCRIPT_URL") ||
  "https://script.google.com/macros/s/AKfycbyTr4SGC5TqHz8g518nPjCUIBHX2LaG5DUaezdKSQ0h5SFKmG-sh9W7u9pi3iAGCNDU/exec";

const s = (v) => (v == null ? "" : String(v)).trim();

function parseJsonText(text) {
  const raw = s(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "deep analysis request route works",
      mode: "deep-analysis-request",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method Not Allowed",
    });
  }

  try {
    const body = parseRequestBody(req.body);

    const companyName = s(body.companyName);
    const industry = s(body.industry);
    const region = s(body.region);
    const email = s(body.email);
    const homepage = s(body.homepage);
    const instagram = s(body.instagram);
    const youtube = s(body.youtube);
    const note = s(body.note);
    const requestedFrom = s(body.requested_from || body.requestedFrom || "website");

    if (!companyName || !email) {
      return res.status(400).json({
        ok: false,
        error: "companyName and email are required",
      });
    }

    const clientIp = getClientIp(req);
    const requestDate = todaySeoul();
    const ipHash = await sha256HexValue(
      clientIp || `${companyName}|${email}|deep-analysis`
    );

    const saveResult = await postAppScriptJson("save_deep_analysis", {
      data: {
        request_date: requestDate,
        ip_hash: ipHash,
        company_name: companyName,
        industry,
        region,
        email,
        homepage,
        instagram,
        youtube,
        requested_from: requestedFrom,
        note,
        status: "new",
      },
    });

    if (!saveResult?.ok) {
      return res.status(503).json({
        ok: false,
        error: "심층분석 요청 저장에 실패했습니다.",
        code: "DEEP_ANALYSIS_SAVE_FAILED",
      });
    }

    return res.status(200).json({
      ok: true,
      message: "심층분석 요청이 접수되었습니다.",
      rowNumber: saveResult?.rowNumber || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e?.message || "internal error",
      mode: "deep-analysis-request",
    });
  }
}

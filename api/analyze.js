export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    let body = req.body || {};

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    return res.status(200).json({
      ok: true,
      message: "analyze route works",
      received: body,
      env: {
        gemini: !!process.env.GEMINI_API_KEY,
        googleSearch: !!process.env.GOOGLE_SEARCH_API_KEY,
        googleCx: !!process.env.GOOGLE_SEARCH_ENGINE_ID,
        youtube: !!process.env.YOUTUBE_API_KEY,
        naverId: !!process.env.NAVER_CLIENT_ID,
        naverSecret: !!process.env.NAVER_CLIENT_SECRET,
        pagespeed: !!process.env.PAGESPEED_API_KEY
      }
    });
  } catch (error) {
    console.error("analyze route crash:", error);
    return res.status(500).json({
      ok: false,
      error: "server_crash",
      message: error.message || "unknown error"
    });
  }
}

module.exports = async (req, res) => {
  try {
    const info = {
      ok: true,
      env: process.env.NODE_ENV || "unknown",
      supabase_url: process.env.SUPABASE_URL || "(missing)",
      supabase_key: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "missing",
      openai_key: process.env.OPENAI_API_KEY ? "set" : "missing",
      ts: new Date().toISOString(),
    };
    res.setHeader("Content-Type", "application/json");
    res.status(200).end(JSON.stringify(info, null, 2));
  } catch (err) {
    res.status(500).end(
      JSON.stringify({ ok: false, error: String(err?.message || err) })
    );
  }
};

// Requires header "x-api-key" to match ADMIN_API_KEY for write/admin endpoints.
function requireAdmin(req, res, next) {
  const key = req.header("x-api-key");
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || expected === "change-me-to-a-long-random-value") {
    return res.status(500).json({ error: "server misconfigured: ADMIN_API_KEY not set" });
  }
  if (key !== expected) {
    return res.status(401).json({ error: "invalid or missing x-api-key header" });
  }
  next();
}

module.exports = { requireAdmin };

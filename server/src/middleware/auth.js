const { verifyTelegramInitData } = require("../telegramAuth");
const { getAdminIds } = require("../adminIds");

// Requires either:
//  - header "x-api-key" matching ADMIN_API_KEY (curl/Postman/etc), or
//  - header "x-telegram-init-data" with a genuine, fresh Telegram Mini App payload
//    (verified signature) from a chat id listed in TELEGRAM_ADMIN_IDS/TELEGRAM_CHAT_ID.
// The Mini App admin panel uses the second path so it never has to embed ADMIN_API_KEY
// in client-side code.
function requireAdmin(req, res, next) {
  const initData = req.header("x-telegram-init-data");
  if (initData) {
    const user = verifyTelegramInitData(initData);
    if (!user || !getAdminIds().has(String(user.id))) {
      return res.status(401).json({ error: "invalid or unauthorized Telegram auth" });
    }
    req.telegramUser = user;
    return next();
  }

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

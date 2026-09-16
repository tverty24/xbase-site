// Shared admin chat/user id allowlist, used by both the Telegram bot commands and the
// Mini App admin panel's Telegram-auth check.
function getAdminIds() {
  const idsRaw = process.env.TELEGRAM_ADMIN_IDS || process.env.TELEGRAM_CHAT_ID || "";
  return new Set(idsRaw.split(",").map((s) => s.trim()).filter(Boolean));
}

module.exports = { getAdminIds };

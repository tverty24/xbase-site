// Verifies the `initData` string a Telegram Mini App sends, per Telegram's documented
// algorithm: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
const crypto = require("node:crypto");

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60; // reject stale initData to limit replay if it leaks

// Returns the Telegram user object if initDataRaw is a genuine, fresh payload signed with
// TELEGRAM_BOT_TOKEN, or null if it's missing, tampered with, or too old.
function verifyTelegramInitData(initDataRaw) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initDataRaw || !botToken) return null;

  let params;
  try {
    params = new URLSearchParams(initDataRaw);
  } catch {
    return null;
  }

  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");

  const pairs = [];
  for (const [key, value] of params) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return null;

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
  if (!user || !user.id) return null;
  return user;
}

module.exports = { verifyTelegramInitData };

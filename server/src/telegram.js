// Sends a Telegram notification for a new booking request.
// Silently no-ops if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID aren't configured,
// and never throws — a failed notification must not break the booking request itself.

const { CLUB_NAMES } = require("./clubs");

async function notifyNewBooking(booking) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const club = booking.club_slug ? (CLUB_NAMES[booking.club_slug] || booking.club_slug) : "не вказано";
  const text = [
    "🎮 Нова заявка на бронювання",
    `Ім'я: ${booking.name || "не вказано"}`,
    `Телефон: ${booking.phone}`,
    `Клуб: ${club}`,
    `Розділ: ${booking.section || "не вказано"}`,
    `Дата і час: ${booking.booking_date || "—"} ${booking.booking_time || ""}`.trim(),
    `Заявка створена: ${booking.created_at}`
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Telegram notify failed:", res.status, body);
    }
  } catch (err) {
    console.error("Telegram notify error:", err);
  }
}

module.exports = { notifyNewBooking };

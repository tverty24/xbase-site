// Telegram bot for managing the club from chat: bookings, cafe menu, club prices.
// Long-polls the Bot API (no inbound webhook/public URL needed). ANY Telegram chat may message
// this bot; it must unlock with the admin password (TELEGRAM_ADMIN_PASSWORD) before any command
// runs. Unlocked chats stay unlocked until the server restarts. Repeated wrong-password attempts
// from a chat are throttled with a growing cooldown to slow down brute-forcing the password.
// Never throws out of startBot() — a misconfigured or unreachable bot must not take the API server down.

const db = require("./db");
const { CLUB_NAMES } = require("./clubs");

const CLUB_SLUGS = Object.keys(CLUB_NAMES);
const DEFAULT_ADMIN_PASSWORD = "3455223Qaz";
const MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN = 3;
const COOLDOWN_MS = 30_000;

const HELP = [
  "Команди клубного бота:",
  "/bookings [n] — останні заявки на бронювання (за замовч. 10)",
  "/menu [категорія] — позиції меню",
  "/addmenu категорія | назва | ціна | примітка — додати позицію меню (примітка не обов'язкова)",
  "/price id нова_ціна — змінити ціну позиції меню",
  "/delmenu id — видалити позицію меню",
  "/clubs — список клубів і їх slug",
  "/prices клуб — тарифи комп'ютерних зон і PlayStation клубу",
  "/zoneprice клуб id wd1 wd3 wd5 wdDay wdNight [we1 we3 we5 weDay weNight] — оновити ціни тарифної зони"
].join("\n");

function fmtMoney(n) {
  return `${n} грн`;
}

function cmdBookings(args) {
  const n = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
  const rows = db.prepare("SELECT * FROM bookings ORDER BY id DESC LIMIT ?").all(n);
  if (!rows.length) return "Заявок ще немає.";
  return rows
    .map((r) => {
      const club = r.club_slug ? CLUB_NAMES[r.club_slug] || r.club_slug : "не вказано";
      const when = r.booking_date || r.booking_time ? `${r.booking_date} ${r.booking_time}`.trim() : "час не вказано";
      return `#${r.id} · ${r.name || "без імені"} · ${r.phone} · ${club} · ${r.section || "розділ не вказано"} · ${when}`;
    })
    .join("\n");
}

function cmdMenu(args) {
  const category = args.join(" ").trim();
  const rows = category
    ? db.prepare("SELECT * FROM menu_items WHERE category = ? ORDER BY sort_order, id").all(category)
    : db.prepare("SELECT * FROM menu_items ORDER BY category, sort_order, id").all();
  if (!rows.length) return category ? `Немає позицій у категорії «${category}».` : "Меню порожнє.";

  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, []);
    byCategory.get(r.category).push(r);
  }
  const lines = [];
  for (const [cat, items] of byCategory) {
    lines.push(`== ${cat} ==`);
    for (const it of items) lines.push(`#${it.id} ${it.name} — ${fmtMoney(it.price_uah)}`);
  }
  return lines.join("\n");
}

function cmdAddMenu(restText) {
  const [category, name, priceStr, note] = restText.split("|").map((s) => s.trim());
  const priceUah = Number(priceStr);
  if (!category || !name || !Number.isFinite(priceUah)) {
    return "Формат: /addmenu категорія | назва | ціна | примітка (необов'язково)";
  }
  const info = db
    .prepare("INSERT INTO menu_items (category, name, price_uah, note, sort_order) VALUES (?, ?, ?, ?, 0)")
    .run(category, name, priceUah, note || "");
  return `Додано #${info.lastInsertRowid}: ${name} (${category}) — ${fmtMoney(priceUah)}`;
}

function cmdPrice(args) {
  const id = Number(args[0]);
  const price = Number(args[1]);
  if (!id || !Number.isFinite(price)) return "Формат: /price id нова_ціна";
  const info = db.prepare("UPDATE menu_items SET price_uah = ? WHERE id = ?").run(price, id);
  if (!info.changes) return `Позицію #${id} не знайдено.`;
  const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
  return `Оновлено #${id}: ${row.name} — ${fmtMoney(price)}`;
}

function cmdDelMenu(args) {
  const id = Number(args[0]);
  if (!id) return "Формат: /delmenu id";
  const info = db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  return info.changes ? `Видалено позицію #${id}.` : `Позицію #${id} не знайдено.`;
}

function cmdClubs() {
  return CLUB_SLUGS.map((s) => `${s} — ${CLUB_NAMES[s]}`).join("\n");
}

function cmdPrices(args) {
  const slug = args[0];
  if (!slug || !CLUB_NAMES[slug]) return `Вкажіть клуб: ${CLUB_SLUGS.join(", ")}`;
  const zones = db.prepare("SELECT * FROM price_zones WHERE club_slug = ? ORDER BY sort_order, id").all(slug);
  const ps = db.prepare("SELECT * FROM ps_zones WHERE club_slug = ? ORDER BY sort_order, id").all(slug);
  if (!zones.length && !ps.length) return `Немає даних по клубу ${slug}.`;

  const lines = [CLUB_NAMES[slug]];
  for (const z of zones) {
    lines.push(`#${z.id} ${z.zone_name}${z.is_top ? " (топ)" : ""}`);
    lines.push(`  Будні: 1г ${z.wd_1h} / 3г ${z.wd_3h} / 5г ${z.wd_5h} / день ${z.wd_day} / ніч ${z.wd_night}`);
    if (z.has_toggle) {
      lines.push(`  Вихідні: 1г ${z.we_1h} / 3г ${z.we_3h} / 5г ${z.we_5h} / день ${z.we_day} / ніч ${z.we_night}`);
    }
  }
  for (const p of ps) {
    lines.push(`#${p.id} ${p.title}${p.is_vip ? " (VIP)" : ""}`);
    for (const [label, price] of JSON.parse(p.rows_json)) lines.push(`  ${label}: ${price}`);
  }
  return lines.join("\n");
}

function cmdZonePrice(args) {
  const [slug, idStr, ...nums] = args;
  const id = Number(idStr);
  if (!slug || !CLUB_NAMES[slug] || !id || (nums.length !== 5 && nums.length !== 10)) {
    return "Формат: /zoneprice клуб id wd1 wd3 wd5 wdDay wdNight [we1 we3 we5 weDay weNight]";
  }
  const values = nums.map(Number);
  if (values.some((v) => !Number.isFinite(v))) return "Усі ціни мають бути числами.";

  const row = db.prepare("SELECT * FROM price_zones WHERE id = ? AND club_slug = ?").get(id, slug);
  if (!row) return `Зону #${id} у клубі ${slug} не знайдено.`;

  const wd = values.slice(0, 5);
  const we =
    values.length === 10
      ? values.slice(5)
      : row.has_toggle
      ? [row.we_1h, row.we_3h, row.we_5h, row.we_day, row.we_night]
      : wd;

  db.prepare(
    `UPDATE price_zones SET wd_1h=?, wd_3h=?, wd_5h=?, wd_day=?, wd_night=?, we_1h=?, we_3h=?, we_5h=?, we_day=?, we_night=?
     WHERE id = ?`
  ).run(wd[0], wd[1], wd[2], wd[3], wd[4], we[0], we[1], we[2], we[3], we[4], id);

  return `Оновлено ціни зони #${id} (${row.zone_name}).`;
}

function dispatch(text) {
  const trimmed = text.trim();
  const cmdRaw = trimmed.split(/\s+/)[0];
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const restText = trimmed.slice(cmdRaw.length).trim();
  const args = restText.split(/\s+/).filter(Boolean);

  try {
    switch (cmd) {
      case "/start":
      case "/help":
        return HELP;
      case "/bookings":
        return cmdBookings(args);
      case "/menu":
        return cmdMenu(args);
      case "/addmenu":
        return cmdAddMenu(restText);
      case "/price":
        return cmdPrice(args);
      case "/delmenu":
        return cmdDelMenu(args);
      case "/clubs":
        return cmdClubs();
      case "/prices":
        return cmdPrices(args);
      case "/zoneprice":
        return cmdZonePrice(args);
      default:
        return "Невідома команда. /help — список команд.";
    }
  } catch (err) {
    console.error("Bot command error:", err);
    return "Сталася помилка під час виконання команди.";
  }
}

async function callApi(token, method, params) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.json();
}

async function send(token, chatId, text) {
  try {
    await callApi(token, "sendMessage", { chat_id: chatId, text });
  } catch (err) {
    console.error("Telegram bot sendMessage error:", err);
  }
}

function extractPasswordAttempt(text) {
  const trimmed = text.trim();
  const loginMatch = trimmed.match(/^\/login(?:@\S+)?\s+(.+)$/i);
  if (loginMatch) return loginMatch[1].trim();
  return trimmed;
}

async function poll(token, password) {
  const unlocked = new Set();
  const failedAttempts = new Map(); // chatId -> { count, cooldownUntil }
  let offset = 0;
  for (;;) {
    let updates;
    try {
      const res = await callApi(token, "getUpdates", { offset, timeout: 25 });
      if (!res.ok) {
        console.error("Telegram bot polling error:", res.description || res);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      updates = res.result;
    } catch (err) {
      console.error("Telegram bot polling error:", err);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    for (const upd of updates) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg || !msg.text) continue;
      const chatId = msg.chat.id;

      if (!unlocked.has(chatId)) {
        const state = failedAttempts.get(chatId);
        if (state && state.cooldownUntil > Date.now()) {
          const waitSec = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
          await send(token, chatId, `Забагато невдалих спроб. Спробуйте через ${waitSec} с.`);
          continue;
        }
        if (extractPasswordAttempt(msg.text) === password) {
          unlocked.add(chatId);
          failedAttempts.delete(chatId);
          await send(token, chatId, "Пароль вірний. Бот розблоковано.\n\n" + HELP);
        } else {
          const count = (state ? state.count : 0) + 1;
          const cooldownUntil =
            count >= MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN ? Date.now() + COOLDOWN_MS * (count - MAX_FAILED_ATTEMPTS_BEFORE_COOLDOWN + 1) : 0;
          failedAttempts.set(chatId, { count, cooldownUntil });
          await send(token, chatId, "Введіть пароль адміністратора, щоб розблокувати бота (/login пароль).");
        }
        continue;
      }
      await send(token, chatId, dispatch(msg.text));
    }
  }
}

function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const password = process.env.TELEGRAM_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  poll(token, password).catch((err) => console.error("Telegram bot crashed:", err));
  console.log("Telegram management bot started (open to any chat, password required).");
}

module.exports = { startBot };

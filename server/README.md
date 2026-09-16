# xbase-server

Backend for the XBase site: stores booking requests, cafe menu items and club prices in SQLite,
and serves them over a small REST API. The static site in the parent folder talks to it via
`assets/js/config.js`.

Uses Node's built-in `node:sqlite` module — no native compilation, no extra services to run.
Requires **Node.js 22.5 or newer** (tested on Node 24).

## Local setup

```bash
cd server
cp .env.example .env      # then edit .env — see below
npm install
npm run seed               # loads the menu + prices already used on the site
npm start                  # listens on PORT (default 8080)
```

Edit `.env`:
- `ADMIN_API_KEY` — set this to a real random value (`node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`). Anyone with this key can edit the menu/prices and read booking requests.
- `CORS_ORIGIN` — the URL(s) your site is served from, comma-separated. For local testing this is wherever you're previewing `index.html` from (e.g. `http://localhost:8811`).
- `DB_FILE` — where the SQLite file lives. Defaults to `./data/xbase.db`.

Then point the frontend at it: edit `assets/js/config.js` and set
`window.XBASE_API_BASE` to this server's URL.

## Telegram notifications for new bookings

Optional. When someone submits the booking form, the server sends a message to a Telegram
chat if `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in `.env`. If either is missing,
bookings still save to the database — you just won't get pinged.

1. In Telegram, message **@BotFather** → `/newbot` → follow the prompts. You get a token that
   looks like `123456789:AAExampleTokenXXXXXXXXXXXXXXXXXXXXX`. Put it in `TELEGRAM_BOT_TOKEN`.
2. Open your new bot (the link BotFather gives you) and send it any message, e.g. `/start`,
   so it has something to reply to.
3. Get your chat id: open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser
   and look for `"chat":{"id":123456789,...}` in the response — that number is
   `TELEGRAM_CHAT_ID`. (For a group instead of a DM, add the bot to the group first, send a
   message there, and use the group's id — it will be negative.)
4. Restart the server (`npm start`) after editing `.env`.

## Telegram bot for managing the club

Optional, and separate from the notifications above (though it reuses the same bot). When
`TELEGRAM_BOT_TOKEN` is set, the server also starts a long-polling bot that lets you manage
bookings, the cafe menu and club prices straight from a Telegram chat — no admin API key or
HTTP client needed. It talks to the same SQLite database as the REST API.

**Anyone who messages the bot can use it, as long as they know the admin password** — there's no
chat id allowlist. Unlock the bot by sending `/login <пароль>` (or just the password by itself).
Set the password with `TELEGRAM_ADMIN_PASSWORD` in `.env` (defaults to `3455223Qaz` if left unset —
**change this to a real value in production**, since the bot can read booking requests, phone
numbers included, and edit menu/prices once unlocked). A chat stays unlocked until the server
restarts; after a restart, the password is required again. Three wrong password attempts from a
chat trigger a growing cooldown to slow down brute-forcing. Restart the server after editing
`.env`.

Commands (send any of these to the bot in Telegram):

- `/help` — list commands
- `/bookings [n]` — last `n` booking requests (default 10)
- `/menu [категорія]` — menu items, optionally filtered by category
- `/addmenu категорія | назва | ціна | примітка` — add a menu item (note is optional)
- `/price id нова_ціна` — change a menu item's price
- `/delmenu id` — delete a menu item
- `/clubs` — list club slugs (`saltovka`, `pobeda`, `holodka`, `palac`, `centr`)
- `/prices клуб` — show a club's computer tariff zones and PlayStation prices
- `/zoneprice клуб id wd1 wd3 wd5 wdDay wdNight [we1 we3 we5 weDay weNight]` — update a tariff
  zone's weekday prices, and optionally its weekend prices (omit to leave weekend as-is)

## API

Public (no auth):
- `GET  /api/menu` — cafe menu items
- `GET  /api/clubs/:slug/prices` — computer specs + tariffs + PlayStation cards for a club (`saltovka`, `pobeda`, `holodka`, `palac`, `centr`)
- `POST /api/bookings` — `{ "phone": "+380...", "club": "centr" }`, called by the booking form

Admin (require header `x-api-key: <ADMIN_API_KEY>`):
- `GET    /api/bookings` — list submitted booking requests
- `POST   /api/menu`, `PUT /api/menu/:id`, `DELETE /api/menu/:id`
- `POST   /api/clubs/:slug/prices/zones`, `PUT .../zones/:id`, `DELETE .../zones/:id`
- `POST   /api/clubs/:slug/prices/ps`, `PUT .../ps/:id`, `DELETE .../ps/:id`

There's no admin web page yet — edit data with `curl`/Postman/Insomnia, or a GUI SQLite
browser pointed at the `.db` file. Example: change a menu item's price —

```bash
curl -X PUT http://localhost:8080/api/menu/1 \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{"priceUah": 250}'
```

Add a new tariff zone to a club:

```bash
curl -X POST http://localhost:8080/api/clubs/centr/prices/zones \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ADMIN_API_KEY" \
  -d '{"zone":"Test zone","cpu":"...","gpu":"...","ram":"...","monitor":"...","periph":"...","chair":"...","wd":[70,190,280,380,300]}'
```

Omit `we` to keep a single fixed price for all days (like `centr` today); include it
(`"we":[...]`) to get the Пн–Чт / Пт–Нд toggle shown on the other club pages.

## Deploying

Any host that runs Node 22.5+ works — Railway, Fly.io, Render, a small VPS, etc. Two things
to get right:

1. **Persistent storage for the SQLite file.** Many "free" web service tiers wipe the
   filesystem on every redeploy/restart. Make sure `DB_FILE` points at a mounted persistent
   volume/disk (Railway volumes, Fly.io volumes, Render disks on paid plans). Otherwise your
   bookings and any edited menu/prices vanish on the next deploy.
2. **Environment variables.** Set `ADMIN_API_KEY`, `CORS_ORIGIN` (your real site URL(s)) and
   `PORT` (most hosts set this for you) in the host's dashboard — never commit `.env`.

Steps, in short:
1. Push this `server/` folder to a Git repo (or the whole project — the host only needs to
   run `npm install && npm run seed && npm start` inside `server/`).
2. Create a new Node web service on your host, point it at `server/`, set the env vars above,
   and attach persistent storage for `data/`.
3. Run the seed command once (most hosts let you run a one-off command, or just let the
   normal deploy run `npm run seed` before `npm start`).
4. Update `assets/js/config.js` on the frontend to the backend's public URL, and redeploy the
   static site.

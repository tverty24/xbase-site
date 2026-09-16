require("dotenv").config();
const path = require("node:path");
const express = require("express");
const cors = require("cors");

const menuRoutes = require("./routes/menu");
const pricesRoutes = require("./routes/prices");
const bookingsRoutes = require("./routes/bookings");
const clubsRoutes = require("./routes/clubs");
const { startBot } = require("./bot");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Telegram Mini App admin panel (static files); auth happens client-side via Telegram
// initData sent on each API call — see src/middleware/auth.js.
app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));

app.use("/api/menu", menuRoutes);
app.use("/api/clubs/:slug/prices", pricesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/clubs", clubsRoutes);

app.use((req, res) => res.status(404).json({ error: "not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`xbase-server listening on :${PORT}`));

startBot();

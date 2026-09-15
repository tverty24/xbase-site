require("dotenv").config();
const express = require("express");
const cors = require("cors");

const menuRoutes = require("./routes/menu");
const pricesRoutes = require("./routes/prices");
const bookingsRoutes = require("./routes/bookings");
const { startBot } = require("./bot");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/menu", menuRoutes);
app.use("/api/clubs/:slug/prices", pricesRoutes);
app.use("/api/bookings", bookingsRoutes);

app.use((req, res) => res.status(404).json({ error: "not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`xbase-server listening on :${PORT}`));

startBot();

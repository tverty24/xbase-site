const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { notifyNewBooking } = require("../telegram");
const { CLUB_NAMES } = require("../clubs");

const router = express.Router();

// POST /api/bookings — public, called from the booking form on index.html
router.post("/", (req, res) => {
  const { phone, name, club, date, time, section } = req.body || {};

  const cleanedPhone = String(phone || "").trim();
  if (!/^[+\d][\d\s()-]{6,}$/.test(cleanedPhone)) {
    return res.status(400).json({ error: "invalid phone number" });
  }
  const cleanedName = String(name || "").trim();
  if (!cleanedName) return res.status(400).json({ error: "name is required" });
  if (!club || !CLUB_NAMES[club]) return res.status(400).json({ error: "valid club is required" });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    return res.status(400).json({ error: "valid date is required" });
  }
  if (!/^\d{2}:\d{2}$/.test(String(time || ""))) {
    return res.status(400).json({ error: "valid time is required" });
  }
  const cleanedSection = String(section || "").trim();
  if (!cleanedSection) return res.status(400).json({ error: "section is required" });

  const info = db.prepare(
    "INSERT INTO bookings (phone, club_slug, name, booking_date, booking_time, section) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(cleanedPhone, club, cleanedName, date, time, cleanedSection);
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ id: info.lastInsertRowid, ok: true });
  notifyNewBooking(row); // fire-and-forget; never blocks or fails the request
});

// GET /api/bookings — admin only, list booking requests
router.get("/", requireAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM bookings ORDER BY id DESC LIMIT 500"
  ).all();
  res.json(rows);
});

module.exports = router;

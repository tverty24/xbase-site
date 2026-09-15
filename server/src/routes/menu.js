const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    price: row.price_uah + " ₴",
    priceUah: row.price_uah,
    note: row.note,
    photo: row.photo,
    sortOrder: row.sort_order
  };
}

// GET /api/menu — public, used by menu.html
router.get("/", (req, res) => {
  const rows = db.prepare(
    "SELECT * FROM menu_items ORDER BY sort_order ASC, id ASC"
  ).all();
  res.json(rows.map(serialize));
});

// POST /api/menu — admin, create item
router.post("/", requireAdmin, (req, res) => {
  const { category, name, priceUah, note, photo, sortOrder } = req.body || {};
  if (!category || !name || !Number.isFinite(Number(priceUah))) {
    return res.status(400).json({ error: "category, name and priceUah are required" });
  }
  const info = db.prepare(
    `INSERT INTO menu_items (category, name, price_uah, note, photo, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(category, name, Number(priceUah), note || "", photo || null, Number(sortOrder) || 0);
  const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(serialize(row));
});

// PUT /api/menu/:id — admin, update item (partial)
router.put("/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "not found" });
  const next = { ...row, ...req.body };
  db.prepare(
    `UPDATE menu_items SET category=?, name=?, price_uah=?, note=?, photo=?, sort_order=? WHERE id=?`
  ).run(
    next.category, next.name, Number(next.priceUah ?? next.price_uah), next.note || "",
    next.photo || null, Number(next.sortOrder ?? next.sort_order) || 0, req.params.id
  );
  const updated = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(req.params.id);
  res.json(serialize(updated));
});

// DELETE /api/menu/:id — admin
router.delete("/:id", requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM menu_items WHERE id = ?").run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

module.exports = router;

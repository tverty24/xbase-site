const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router({ mergeParams: true });

function serializeZone(row) {
  const wd = [row.wd_1h, row.wd_3h, row.wd_5h, row.wd_day, row.wd_night];
  const we = row.has_toggle
    ? [row.we_1h, row.we_3h, row.we_5h, row.we_day, row.we_night]
    : wd;
  return {
    id: row.id,
    zone: row.zone_name,
    badge: row.badge || null,
    isTop: !!row.is_top,
    cpu: row.cpu, gpu: row.gpu, ram: row.ram, monitor: row.monitor,
    periph: row.periph, chair: row.chair,
    wd, we,
    sortOrder: row.sort_order
  };
}

function serializePs(row) {
  return {
    id: row.id,
    title: row.title,
    badge: row.badge || null,
    isVip: !!row.is_vip,
    rows: JSON.parse(row.rows_json),
    sortOrder: row.sort_order
  };
}

// GET /api/clubs/:slug/prices — public, used by club pages
router.get("/", (req, res) => {
  const slug = req.params.slug;
  const zones = db.prepare(
    "SELECT * FROM price_zones WHERE club_slug = ? ORDER BY sort_order ASC, id ASC"
  ).all(slug);
  const ps = db.prepare(
    "SELECT * FROM ps_zones WHERE club_slug = ? ORDER BY sort_order ASC, id ASC"
  ).all(slug);
  if (zones.length === 0 && ps.length === 0) {
    return res.status(404).json({ error: "unknown club or no price data seeded" });
  }
  res.json({
    club: slug,
    hasToggle: zones.length ? !!zones[0].has_toggle : false,
    zones: zones.map(serializeZone),
    ps: ps.map(serializePs)
  });
});

// POST /api/clubs/:slug/prices/zones — admin, create a computer-zone tariff row
router.post("/zones", requireAdmin, (req, res) => {
  const slug = req.params.slug;
  const b = req.body || {};
  if (!b.zone || !Array.isArray(b.wd) || b.wd.length !== 5) {
    return res.status(400).json({ error: "zone (string) and wd (array of 5 numbers) are required" });
  }
  const hasToggle = b.we ? 1 : 0;
  const we = b.we && b.we.length === 5 ? b.we : b.wd;
  const info = db.prepare(`
    INSERT INTO price_zones
      (club_slug, zone_name, badge, is_top, has_toggle, cpu, gpu, ram, monitor, periph, chair,
       wd_1h, wd_3h, wd_5h, wd_day, wd_night, we_1h, we_3h, we_5h, we_day, we_night, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?, ?,?,?,?,?, ?)
  `).run(
    slug, b.zone, b.badge || null, b.isTop ? 1 : 0, hasToggle,
    b.cpu || "", b.gpu || "", b.ram || "", b.monitor || "", b.periph || "", b.chair || "",
    b.wd[0], b.wd[1], b.wd[2], b.wd[3], b.wd[4],
    we[0], we[1], we[2], we[3], we[4],
    Number(b.sortOrder) || 0
  );
  const row = db.prepare("SELECT * FROM price_zones WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(serializeZone(row));
});

// PUT /api/clubs/:slug/prices/zones/:id — admin, update
router.put("/zones/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM price_zones WHERE id = ? AND club_slug = ?")
    .get(req.params.id, req.params.slug);
  if (!row) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  const wd = Array.isArray(b.wd) && b.wd.length === 5
    ? b.wd : [row.wd_1h, row.wd_3h, row.wd_5h, row.wd_day, row.wd_night];
  const hasToggle = b.we ? 1 : row.has_toggle;
  const we = Array.isArray(b.we) && b.we.length === 5
    ? b.we : (hasToggle ? [row.we_1h, row.we_3h, row.we_5h, row.we_day, row.we_night] : wd);
  db.prepare(`
    UPDATE price_zones SET
      zone_name=?, badge=?, is_top=?, has_toggle=?, cpu=?, gpu=?, ram=?, monitor=?, periph=?, chair=?,
      wd_1h=?, wd_3h=?, wd_5h=?, wd_day=?, wd_night=?, we_1h=?, we_3h=?, we_5h=?, we_day=?, we_night=?,
      sort_order=?
    WHERE id = ?
  `).run(
    b.zone ?? row.zone_name, b.badge ?? row.badge, b.isTop != null ? (b.isTop ? 1 : 0) : row.is_top, hasToggle,
    b.cpu ?? row.cpu, b.gpu ?? row.gpu, b.ram ?? row.ram, b.monitor ?? row.monitor,
    b.periph ?? row.periph, b.chair ?? row.chair,
    wd[0], wd[1], wd[2], wd[3], wd[4], we[0], we[1], we[2], we[3], we[4],
    Number(b.sortOrder ?? row.sort_order) || 0,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM price_zones WHERE id = ?").get(req.params.id);
  res.json(serializeZone(updated));
});

// DELETE /api/clubs/:slug/prices/zones/:id — admin
router.delete("/zones/:id", requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM price_zones WHERE id = ? AND club_slug = ?")
    .run(req.params.id, req.params.slug);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

// POST /api/clubs/:slug/prices/ps — admin, create a PlayStation tariff card
router.post("/ps", requireAdmin, (req, res) => {
  const slug = req.params.slug;
  const b = req.body || {};
  if (!b.title || !Array.isArray(b.rows)) {
    return res.status(400).json({ error: "title (string) and rows (array of [label, price]) are required" });
  }
  const info = db.prepare(`
    INSERT INTO ps_zones (club_slug, title, badge, is_vip, rows_json, sort_order)
    VALUES (?,?,?,?,?,?)
  `).run(slug, b.title, b.badge || null, b.isVip ? 1 : 0, JSON.stringify(b.rows), Number(b.sortOrder) || 0);
  const row = db.prepare("SELECT * FROM ps_zones WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(serializePs(row));
});

// PUT /api/clubs/:slug/prices/ps/:id — admin, update
router.put("/ps/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM ps_zones WHERE id = ? AND club_slug = ?")
    .get(req.params.id, req.params.slug);
  if (!row) return res.status(404).json({ error: "not found" });
  const b = req.body || {};
  db.prepare(`
    UPDATE ps_zones SET title=?, badge=?, is_vip=?, rows_json=?, sort_order=? WHERE id=?
  `).run(
    b.title ?? row.title, b.badge ?? row.badge,
    b.isVip != null ? (b.isVip ? 1 : 0) : row.is_vip,
    b.rows ? JSON.stringify(b.rows) : row.rows_json,
    Number(b.sortOrder ?? row.sort_order) || 0,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM ps_zones WHERE id = ?").get(req.params.id);
  res.json(serializePs(updated));
});

// DELETE /api/clubs/:slug/prices/ps/:id — admin
router.delete("/ps/:id", requireAdmin, (req, res) => {
  const info = db.prepare("DELETE FROM ps_zones WHERE id = ? AND club_slug = ?")
    .run(req.params.id, req.params.slug);
  if (info.changes === 0) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

module.exports = router;

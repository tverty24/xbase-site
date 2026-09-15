const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const DB_FILE = process.env.DB_FILE || "./data/xbase.db";
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category   TEXT NOT NULL,
    name       TEXT NOT NULL,
    price_uah  INTEGER NOT NULL,
    note       TEXT NOT NULL DEFAULT '',
    photo      TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS price_zones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    club_slug     TEXT NOT NULL,
    zone_name     TEXT NOT NULL,
    badge         TEXT,
    is_top        INTEGER NOT NULL DEFAULT 0,
    has_toggle    INTEGER NOT NULL DEFAULT 1,
    cpu           TEXT NOT NULL DEFAULT '',
    gpu           TEXT NOT NULL DEFAULT '',
    ram           TEXT NOT NULL DEFAULT '',
    monitor       TEXT NOT NULL DEFAULT '',
    periph        TEXT NOT NULL DEFAULT '',
    chair         TEXT NOT NULL DEFAULT '',
    wd_1h INTEGER, wd_3h INTEGER, wd_5h INTEGER, wd_day INTEGER, wd_night INTEGER,
    we_1h INTEGER, we_3h INTEGER, we_5h INTEGER, we_day INTEGER, we_night INTEGER,
    sort_order    INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS ps_zones (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    club_slug  TEXT NOT NULL,
    title      TEXT NOT NULL,
    badge      TEXT,
    is_vip     INTEGER NOT NULL DEFAULT 0,
    rows_json  TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    phone         TEXT NOT NULL,
    club_slug     TEXT,
    name          TEXT NOT NULL DEFAULT '',
    booking_date  TEXT NOT NULL DEFAULT '',
    booking_time  TEXT NOT NULL DEFAULT '',
    section       TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate bookings created before name/booking_date/booking_time/section existed.
const bookingColumns = db.prepare("PRAGMA table_info(bookings)").all().map((c) => c.name);
for (const col of ["name", "booking_date", "booking_time", "section"]) {
  if (!bookingColumns.includes(col)) {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
  }
}

module.exports = db;

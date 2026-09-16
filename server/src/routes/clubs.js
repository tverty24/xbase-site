const express = require("express");
const { CLUB_NAMES } = require("../clubs");

const router = express.Router();

// GET /api/clubs — public, list of club slugs + display names (used by the admin panel's
// club picker so it doesn't have to hardcode the list).
router.get("/", (req, res) => {
  res.json(Object.entries(CLUB_NAMES).map(([slug, name]) => ({ slug, name })));
});

module.exports = router;

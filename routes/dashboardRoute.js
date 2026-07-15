const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const { getDashboardStats } = require("../controllers/dashboardController");

router.use(authMiddleware);

// GET /api/dashboard/stats
// All three roles get the same endpoint — scoping is handled inside the controller
router.get(
  "/stats",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getDashboardStats,
);

module.exports = router;

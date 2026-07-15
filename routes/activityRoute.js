const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  getActivities,
  createActivity,
} = require("../controllers/activityController");

router.use(authMiddleware);

// Timeline
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getActivities,
);

// Manual notes
router.post(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  createActivity,
);

module.exports = router;

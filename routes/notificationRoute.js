const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} = require("../controllers/notificationController");

router.use(authMiddleware);

// GET all notifications (paginated) — all roles, scoped to self in controller
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  getNotifications,
);

// GET unread badge count — all roles
router.get(
  "/unread-count",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  getUnreadCount,
);

// PATCH mark all as read — all roles
router.patch(
  "/read-all",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  markAllAsRead,
);

// PATCH mark single notification as read — all roles
router.patch(
  "/:id/read",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  markAsRead,
);

// DELETE single notification — all roles, controller enforces ownership
router.delete(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  deleteNotification,
);

// DELETE all notifications — all roles, scoped to self in controller
router.delete(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  clearAllNotifications,
);

module.exports = router;

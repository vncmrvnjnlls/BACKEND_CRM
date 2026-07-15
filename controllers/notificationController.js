const Notification = require("../models/Notification");

const POPULATE_TRIGGERED_BY =
  "firstName middleName lastName profilePicture role employeeId";

/**
 * GET /notifications
 * Returns paginated notifications for the authenticated user.
 * Query params: ?page=1&limit=20&unreadOnly=true
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const unreadOnly = req.query.unreadOnly === "true";

    const filter = { recipient: userId };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("triggeredBy", POPULATE_TRIGGERED_BY)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    res.status(200).json({
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /notifications/unread-count
 * Lightweight endpoint — just the badge count.
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.userId,
      isRead: false,
    });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /notifications/:id/read
 * Marks a single notification as read.
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ notification });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /notifications/read-all
 * Marks all unread notifications as read for the authenticated user.
 */
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );

    res.status(200).json({ updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /notifications/:id
 * Deletes a single notification (must belong to the authenticated user).
 */
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.userId,
    });

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.status(200).json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * DELETE /notifications
 * Clears all notifications for the authenticated user.
 */
const clearAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      recipient: req.user.userId,
    });
    res.status(200).json({ deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};

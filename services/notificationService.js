const Notification = require("../models/Notification");
const { getIO } = require("../utils/socketManager");
const events = require("../constants/events");

/**
 * Creates a persisted notification and immediately pushes it
 * to the recipient's socket room if they are online.
 *
 * @param {Object} payload
 * @param {string|ObjectId} payload.recipient      - User ID who receives the notification
 * @param {string}          payload.type           - Notification type constant (e.g. "LEAD_ASSIGNED")
 * @param {string}          payload.title          - Short heading
 * @param {string}          payload.message        - Full description
 * @param {string}          payload.relatedToType  - "Lead" | "Deal" | "Customer" | "Task"
 * @param {string|ObjectId} payload.relatedToId    - ID of the related entity
 * @param {string|ObjectId} [payload.triggeredBy]  - User ID whose action caused this
 */
const createNotification = async (payload) => {
  try {
    const notification = await Notification.create(payload);

    // Push real-time to recipient's personal socket room
    try {
      console.log(
        "[NotificationService] Emitting event:",
        events.NOTIFICATION_NEW,
        "to room:",
        `user:${payload.recipient}`,
      );
      getIO().to(`user:${payload.recipient}`).emit(events.NOTIFICATION_NEW, {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        relatedToType: notification.relatedToType,
        relatedToId: notification.relatedToId,
        triggeredBy: notification.triggeredBy,
        isRead: false,
        createdAt: notification.createdAt,
      });
    } catch (socketErr) {
      // Socket not initialized yet (e.g. during tests) — non-fatal
      console.warn(
        "[NotificationService] Socket push skipped:",
        socketErr.message,
      );
    }

    return notification;
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
};

module.exports = { createNotification };

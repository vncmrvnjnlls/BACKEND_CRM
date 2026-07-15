const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      // e.g. "LEAD_ASSIGNED", "TASK_ASSIGNED", "LEAD_CONVERSION_REQUESTED"
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Polymorphic reference — what entity this notification is about
    relatedToType: {
      type: String,
      enum: ["Lead", "Deal", "Customer", "Task"],
      required: true,
    },
    relatedToId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "relatedToType",
    },
    // The user whose action triggered this notification
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Compound index for efficient per-user queries sorted by newest
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);

const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    relatedToType: {
      type: String,
      enum: ["Lead", "Client", "Quotations", "Task"],
      required: true,
    },
    relatedToId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "relatedToType",
    },

    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "ASSIGN",
        "STATUS_CHANGE",
        "STAGE_CHANGE",
        "CONVERT",
        "CONVERSION_REQUESTED",
        "CONVERSION_APPROVED",
        "NOTE",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    activityDate: {
      type: Date,
      default: Date.now,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    metadata: {
      oldValue: { type: String, default: "" },
      newValue: { type: String, default: "" },
      extra: { type: mongoose.Schema.Types.Mixed, default: null },
    },

    isSystemGenerated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Activity", activitySchema);

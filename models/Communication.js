const mongoose = require("mongoose");

const communicationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

communicationSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
communicationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model("Communication", communicationSchema);
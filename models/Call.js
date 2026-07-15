const mongoose = require("mongoose");

const CallSchema = new mongoose.Schema(
  {
    // 🟢 CHANGED: Changed from ObjectId to String so you can type any name
    client: {
      type: String,
      required: true,
      trim: true
    },
    company: {
      type: String,
      trim: true,
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    callType: {
      type: String,
      enum: ["Follow-up Call", "Initial Client Contact", "Sales Discussion", "Other"],
      required: true,
    },
    schedule: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Missed", "Cancelled"],
      default: "Scheduled",
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Call || mongoose.model("Call", CallSchema);
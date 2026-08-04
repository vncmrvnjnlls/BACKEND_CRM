const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    meetingTitle: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
    },
    // 🌟 ADD THIS FIELD:
    status: {
      type: String,
      enum: [
        "Scheduled",
        "In Progress",
        "Completed",
        "Cancelled",
        "Rescheduled",
        "No Show",
      ],
      default: "Scheduled",
      trim: true,
    },
    meetingType: {
      type: String, // e.g., "Online", "On-site"
      trim: true,
    },
    client: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    locationScope: {
      type: String,
      enum: ["Inside the Philippines", "Outside the Philippines"],
      default: "Inside the Philippines",
    },
    date: {
      type: Date,
      required: [true, "Meeting date is required"],
    },
    startTime: {
      type: String,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String,
      required: [true, "End time is required"],
    },
    host: {
      type: String,
      trim: true,
    },
    participants: {
      type: [String],
      default: [],
    },
    participantIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    assignedTo: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    attendees: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Meeting", meetingSchema);
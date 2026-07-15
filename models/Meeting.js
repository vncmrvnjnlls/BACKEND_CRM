const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    meetingTitle: {
      type: String,
      required: [true, "Meeting title is required"],
      trim: true,
    },
    meetingType: {
      type: String, // e.g., "Online", "On-site"
      trim: true,
    },
    client: {
      type: String, // Tugma sa plain text string structure ng Calls niyo
      trim: true,
    },
    location: {
      type: String, // e.g., "Google Meet", "Conference Room"
      trim: true,
    },
    locationScope: {
      type: String,
      enum: ["Inside the Philippines", "Outside the country"],
      default: "Inside the Philippines",
    },
    date: {
      type: Date,
      required: [true, "Meeting date is required"],
    },
    startTime: {
      type: String, // e.g., "10:00" o "17:00" base sa UI calendar view niyo
      required: [true, "Start time is required"],
    },
    endTime: {
      type: String, // e.g., "11:30" o "18:00"
      required: [true, "End time is required"],
    },
    host: {
      type: String,
      trim: true,
    },
    participants: {
      type: [String], // Array ng text strings para sa listahan ng participants
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
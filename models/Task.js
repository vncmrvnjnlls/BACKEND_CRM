const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true,
    },

    scope: {
      type: String,
      enum: ["Personal", "Assigned"],
      default: "Personal",
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    taskType: {
      type: String,
      enum: ["Call", "Email", "Message", "Meeting", "Reminder", "Other"],
      default: "Other",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: ["Pending", "Ongoing", "Completed", "Overdue"],
      default: "To Do",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    reminderAt: {
      type: Date,
      default: null,
    },

    reminderSent: {
      type: Boolean,
      default: false,
    },

    repeat: {
      type: String,
      enum: ["None", "Daily", "Weekly", "Monthly"],
      default: "None",
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    relatedToType: {
      type: String,
      enum: ["Lead", "Customer", "Client", "Deal"],
      default: null,
    },

    relatedTo: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedToType",
      default: null,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    position: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
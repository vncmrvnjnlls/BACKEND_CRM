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
      enum: ["Call", "Email", "Message", "Meeting", "Reminder", "Others", "Other"],
      default: "Others",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: ["Pending", "Ongoing", "Completed", "Overdue"],
      default: "Pending",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    dueTime: {
      type: String,
      trim: true,
      default: "", // Stores "HH:mm" e.g., "14:30"
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

    // 🌟 Link URL string (to match controllers that save link as a string)
    link: {
      type: String,
      trim: true,
      default: "",
    },

    // 🌟 Dedicated linkName property to match your controller and frontend payload
    linkName: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: {
      type: [
        {
          name: { type: String, trim: true },
          url: { type: String, trim: true },
          path: { type: String, trim: true },
          mimeType: { type: String, trim: true },
        },
      ],
      default: [],
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
      enum: ["Lead", "Customer", "Client", "Deal", "Quotation"],
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
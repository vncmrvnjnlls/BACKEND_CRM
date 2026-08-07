const mongoose = require("mongoose");

const leadSchema = new mongoose.Schema(
  {
    leadOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    leadAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    middleName: {
      type: String,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    suffixName: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: false,
    },

    company: {
      type: String,
      trim: true,
    },

    ownerName: {
      firstName: {
        type: String,
        trim: true,
      },
      middleInitial: {
        type: String,
        trim: true,
      },
      lastName: {
        type: String,
        trim: true,
      },
    },

    leadSource: {
      type: String,
      enum: [
        "Website",
        "Referral",
        "Social Media",
        "Email Campaign",
        "Walk-in",
        "Manual Input",
        "Other",
        "Others",
      ],
      default: "Other",
    },

    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Converted", "Lost"],
      default: "New",
    },

    industry: {
      type: String,
    },

    sex: {
      type: String,
      enum: ["Male", "Female"],
    },

    address: {
      houseNumber: { type: String },
      street: { type: String },
      barangay: { type: String },
      municipality: { type: String, default: "" },
      province: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: {
        type: String,
        default: "Philippines",
      },
    },

    notes: {
      type: String,
    },

    convertedToCustomer: {
      type: Boolean,
      default: false,
    },

    convertedAt: {
      type: Date,
      default: null,
    },

    convertedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    position: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Lead", leadSchema);
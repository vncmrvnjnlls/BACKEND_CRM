const mongoose = require("mongoose");

/**
 * Lead Model - Represents a potential sales opportunity
 * 
 * Lead Lifecycle:
 *   1. Created by Sales Agent or Manager
 *   2. Status moves through: New -> Contacted -> Qualified -> (Converted or Lost)
 *   3. Agent can request conversion to Customer
 *   4. Manager must approve conversion request
 *   5. Once converted, a Customer record is created
 * 
 * Ownership & Assignment:
 *   - leadOwner: User who created the lead (cannot change)
 *   - leadAssignee: User responsible for the lead (can be reassigned)
 * 
 * Conversion Workflow:
 *   - conversionRequested: Agent marks lead ready to convert
 *   - conversionApproved: Manager approves the conversion
 *   - convertedToCustomer: Final conversion happens after approval
 * 
 * Kanban Positioning:
 *   - position: Order within the same status column
 */
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

    profilePicture: {
      type: String,
      default: null,
    },

    dateOfBirth: {
      type: Date,
      required: false,
    },

    phone: {
      type: String,
      required: false, // 🎯 OPTIMIZATION: Ginawang false para hindi mag-error kung walang phone number ang Prospect
    },

    company: {
      type: String,
      trim: true,
    },

    leadSource: {
      type: String,
      enum: [
        "Website",
        "Referral",
        "Social Media",
        "Email Campaign",
        "Walk-in",
        "Manual Input", // 🎯 DAGDAG: Para tanggapin ang default fallbacks mula sa prospect controller natin
        "Other",
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
      municipality: { type: String, default: "" }, // 🎯 OPTIMIZATION: Tinanggal ang required: true para sa ligtas na data entry
      province: { type: String, default: "" },     // 🎯 OPTIMIZATION: Tinanggal ang required: true para sa ligtas na data entry
      zipCode: { type: String, default: "" },      // 🎯 OPTIMIZATION: Tinanggal ang required: true para sa ligtas na data entry
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

    // Agent-only: signals lead is ready for conversion
    conversionRequested: {
      type: Boolean,
      default: false,
    },

    conversionRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    conversionRequestedAt: {
      type: Date,
      default: null,
    },

    // Manager/Admin: approves the conversion request
    conversionApproved: {
      type: Boolean,
      default: false,
    },

    conversionApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    conversionApprovedAt: {
      type: Date,
      default: null,
    },

    position: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Lead", leadSchema);
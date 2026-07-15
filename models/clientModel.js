const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    createdFromLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      unique: true,
      sparse: true,
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
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    phone: {
      type: String,
      required: true,
      index: true,
    },

    company: {
      type: String,
      trim: true,
    },

    companyAddress: {
      type: String,
      trim: true,
    },

    industry: {
      type: String,
      trim: true,
    },

    leadSource: String,

    sex: {
      type: String,
      enum: ["Male", "Female"],
    },

    address: {
      houseNumber: { type: String },
      street: { type: String },
      barangay: { type: String },
      municipality: { type: String, required: true },
      province: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: {
        type: String,
        default: "Philippines",
      },
    },

    dateOfBirth: {
      type: Date,
    },

    profilePicture: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Lost"],
      default: "Active",
      index: true,
    },

    customerType: {
      type: String,
      enum: ["Individual", "Business"],
      default: "Individual",
    },

    tags: [String],

    notes: String,

    lifetimeValue: {
      type: Number,
      default: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    lastContactedAt: Date,

    nextFollowUpAt: {
      type: Date,
      default: null,
    },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Client", clientSchema);

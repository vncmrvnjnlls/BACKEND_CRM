const mongoose = require("mongoose");

const prospectSchema = new mongoose.Schema(
  {
    // === COMPANY PROFILE ===
    companyName: {
      type: String,
      required: [true, "Company Name is required"],
      trim: true,
    },
    businessAddress: {
      houseNumber: { type: String, trim: true },
      streetAddress: { type: String, trim: true },
      city: { type: String, trim: true },
      province: { type: String, trim: true },
      country: { type: String, default: "Philippines", trim: true },
    },
    companyEmailAddress: {
      type: String,
      required: [true, "Company Email Address is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    companyWebsite: {
      type: String,
      trim: true,
    },
    natureOfBusiness: {
      type: String,
      trim: true,
    },
    numberOfEmployees: {
      type: String,
      trim: true,
    },

    // === OWNER/S OR REPRESENTATIVE/S INFORMATION ===
    ownerName: {
      lastName: { type: String, trim: true },
      firstName: { type: String, trim: true },
      middleInitial: { type: String, trim: true },
    },
    representativeName: {
      lastName: { type: String, trim: true },
      firstName: { type: String, trim: true },
      middleInitial: { type: String, trim: true },
    },
    title: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    viber: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Contact Phone Number is required"],
      trim: true,
    },

    // 🌟 ADDRESS INFORMATION (Matching the UI Form)
    address: {
      country: {
        type: String,
        required: [true, "Country is required"],
        default: "Philippines",
        trim: true,
      },
      province: {
        type: String,
        required: [true, "Province is required"],
        trim: true,
      },
      municipality: {
        type: String, // Accepts City / Municipality
        required: [true, "City / Municipality is required"],
        trim: true,
      },
      barangay: {
        type: String, // Accepts Barangay / District
        required: false,
        trim: true,
      },
      street: {
        type: String,
        required: false,
        trim: true,
      },
      houseNumber: {
        type: String,
        required: false,
        trim: true,
      },
      zipCode: {
        type: String,
        required: [true, "Zip Code is required"],
        trim: true,
      },
    },

    // === CRM INTERNAL SYSTEM FIELDS ===
    status: {
      type: String,
      enum: ["New", "Contacted", "Qualified", "Lost"],
      default: "New",
    },
    leadSource: {
      type: String,
      default: "Website",
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Prospect", prospectSchema);


// const mongoose = require('mongoose');

// const prospectSchema = new mongoose.Schema({
//   firstName: { type: String, required: true },
//   lastName: { type: String, required: true },
//   company: { type: String },
//   email: { type: String, required: true },
//   phone: { type: String },
//   notes: { type: String },
//   status: { type: String, default: "New" },
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
//   // 👈 DITO MO ISINGIT YUNG ADDRESS FIELD BLOCK
//   address: {
//     zipCode: { type: String },
//     province: { type: String },
//     municipality: { type: String }
//   }
// }, { timestamps: true });

// module.exports = mongoose.model('Prospect', prospectSchema);
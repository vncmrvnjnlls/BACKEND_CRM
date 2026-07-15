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
      trim: true, // Optional field based on the sheet
    },
    natureOfBusiness: {
      type: String,
      trim: true,
    },
    numberOfEmployees: {
      type: String, // Ginawang String para pwede ang mga ranges gaya ng "1-10", "50+", etc.
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
      type: String, // E.g., CEO, Manager, Procurement Officer
      trim: true,
    },
    emailAddress: {
      type: String, // Contact person's direct email
      unique: true,   // 🟢 Kung gusto mong unique rin ang personal email ng contact person
      sparse: true,   // 🟢 NAPAKAHALAGA: Pinapayagan ang maraming null o walang emailAddress nang hindi nag-eerror
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
      ref: "User", // Sino ang nag-encode na team member
    },
  },
  {
    timestamps: true, // Awtomatikong magbibigay ng createdAt at updatedAt
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
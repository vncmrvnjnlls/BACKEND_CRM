const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

// Only uppercase letters + numbers
const nanoid = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 6);

/**
 * User Model - Represents a system user (employee)
 * 
 * Roles:
 *   - Admin: Full system access
 *   - Sales Manager: Can manage team members and their data
 *   - Sales Agent: Can manage their own leads, customers, deals
 *   - Support Staff: Can view data (limited access)
 * 
 * Each user belongs to exactly one team (Sales Managers create and lead teams)
 * Passwords are never selected by default (select: false)
 */
const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      required: true,
      default: () => "EMP-" + nanoid(),
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    firstName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      required: true,
    },
    suffixName: {
      type: String,
      required: false,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["Admin", "Sales Manager", "Sales Agent", "Support Staff"],
      required: true,
      index: true,
      default: "Sales Agent" 
    },
    accessModules: {
      type: [String],
      default: ["Dashboard"] // Ito ang magse-save ng mga checked items tulad ng ["Dashboard", "Teams"]
    },
    phone: {
      type: String,
      required: true,
    },
    sex: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },
    profilePicture: {
      type: String,
      default: null,
      required: false,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    placeOfBirth: {
      type: String,
      required: true,
    },
    currentAddress: {
      houseNumber: { type: String, required: false },
      street: { type: String, required: false },
      barangay: { type: String, required: false },
      municipality: { type: String, required: true },
      province: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true, default: "Philippines" },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    signInAt: {
      type: Date,
      default: null,
    },
    signOutAt: {
      type: Date,
      default: null,
    },
    notificationPreferences: {
      emailTaskAssignment: { type: Boolean, default: true },
      emailTaskReminder: { type: Boolean, default: true },
      emailDealUpdate: { type: Boolean, default: true },
      emailLeadUpdate: { type: Boolean, default: true },
      emailTeamMention: { type: Boolean, default: true },
      emailSystemAlert: { type: Boolean, default: true },
      inAppTaskAssignment: { type: Boolean, default: true },
      inAppTaskReminder: { type: Boolean, default: true },
      inAppDealUpdate: { type: Boolean, default: true },
      inAppLeadUpdate: { type: Boolean, default: true },
      inAppTeamMention: { type: Boolean, default: true },
      inAppSystemAlert: { type: Boolean, default: true },
      notificationFrequency: {
        type: String,
        enum: ["realtime", "daily", "weekly"],
        default: "realtime",
      },
      quietHoursEnabled: { type: Boolean, default: false },
      quietHoursStart: { type: String, default: "22:00" },
      quietHoursEnd: { type: String, default: "08:00" },
      notificationSound: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);

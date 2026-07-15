const mongoose = require("mongoose");
const crypto = require("crypto");

const schema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
});

schema.statics.hashToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

module.exports = mongoose.model("PasswordResetToken", schema);

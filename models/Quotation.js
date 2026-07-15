const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    // 🟢 PINALITAN: Mula sa customer -> client at ref: 'Customer' -> ref: 'Client'
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    value: { type: Number, required: true },
    currency: { type: String, default: "PHP" },
    probability: { type: Number, min: 0, max: 100, default: 0 },
    stage: {
      type: String,
      enum: [
        "Prospecting",
        "Qualification",
        "Proposal",
        "Negotiation",
        "Won",
        "Lost",
      ],
      default: "Prospecting",
    },
    expectedCloseDate: { type: Date },
    closedAt: { type: Date, default: null },

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },
    position: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// 1. I-register ang default model name na ginagamit mo sa project
const Quotation = mongoose.model("Quotation", quotationSchema);

// 2. I-register din ang schema sa ilalim ng pangalang "Deal" para hindi mag-error ang Task populate mechanism
mongoose.model("Deal", quotationSchema);

// 3. I-export ang Quotation bilang default export object profile gaya ng dati
module.exports = Quotation;
const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
    },

    amount: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["Draft", "Sent", "Paid", "Overdue"],
      default: "Draft",
    },

    dueDate: Date,
  },
  { timestamps: true },
);

module.exports = mongoose.model("Invoice", invoiceSchema);

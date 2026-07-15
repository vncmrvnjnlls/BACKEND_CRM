const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// 🟢 MGA PINALITAN: In-update ang imports para tumugma sa mga bagong pangalan sa clientController.js
const {
  createClient,
  getAllClients,
  getSingleClient,
  deleteClient,
  updateClient,
  updateClientStatus, // In-update mula sa updateCustomerStatus
  assignClient,       // In-update mula sa assignCustomer
  updateFollowUp,
} = require("../controllers/clientController");

// Lahat ng client routes ay nangangailangan ng authentication token
router.use(authMiddleware);

// GET lahat ng clients
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  getAllClients
);

// GET ang isang client gamit ang ID
router.get(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  getSingleClient // 🟢 In-update mula sa getSingleCustomer
);

// POST gumawa ng client manually
router.post(
  "/",
  requireRole("Admin", "Sales Manager"),
  upload.single("profilePicture"),
  createClient // 🟢 In-update mula sa createCustomer
);

// PATCH buong update ng client details
router.patch(
  "/:id",
  requireRole("Admin", "Sales Manager"),
  upload.single("profilePicture"),
  updateClient // 🟢 In-update mula sa updateCustomer
);

// DELETE client — Admin lamang ang may karapatan
router.delete("/:id", requireRole("Admin"), deleteClient);

// PATCH mabilisang pagpapalit ng status (Active, Inactive, Lost)
router.patch(
  "/:id/status",
  requireRole("Admin", "Sales Manager"),
  updateClientStatus // 🟢 In-update mula sa updateCustomerStatus
);

// PATCH i-assign ang client sa isang partikular na agent
router.patch(
  "/:id/assign",
  requireRole("Admin", "Sales Manager"),
  assignClient // 🟢 In-update mula sa assignCustomer
);

// PATCH pag-set o pag-clear ng petsa para sa susunod na follow-up
router.patch(
  "/:id/follow-up",
  requireRole("Admin", "Sales Manager", "Sales Agent", "Support Staff"),
  updateFollowUp
);

module.exports = router;
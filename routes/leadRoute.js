const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  getAllLeads,
  getSingleLead,
  createLead,
  updateLeadDetails,
  updateOwnLeadDetails,
  updateLeadStatus,
  deleteLead,
  assignLead,
  requestLeadConversion,
  approveLeadConversion,
  convertLeadToCustomer,
  reorderLeadPositions,
} = require("../controllers/leadController");

router.use(authMiddleware);

// GET all leads — Admin/Manager: all | Agent: only assigned (scoped in controller)
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getAllLeads,
);

// Batch reorder leads (position update)
router.patch(
  "/batch/reorder",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  reorderLeadPositions,
);

// GET single lead
router.get(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getSingleLead,
);

// POST create lead — Admin/Manager assign freely, Agent auto-assigns to self
router.post(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  upload.single("profilePicture"),
  createLead,
);

// PATCH full update — Admin/Manager only
router.patch(
  "/:id",
  requireRole("Admin", "Sales Manager"),
  upload.single("profilePicture"),
  updateLeadDetails,
);

// PATCH agent updates their own assigned lead
router.patch(
  "/:id/self",
  requireRole("Sales Agent"),
  upload.single("profilePicture"),
  updateOwnLeadDetails,
);

// PATCH status — all roles, controller enforces agent-specific guards
router.patch(
  "/:id/status",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateLeadStatus,
);

// DELETE — Admin only
router.delete("/:id", requireRole("Admin"), deleteLead);

// PATCH assign lead — Admin/Manager only
router.patch("/:id/assign", requireRole("Admin", "Sales Manager"), assignLead);

// PATCH request conversion — Sales Agent only
router.patch(
  "/:id/request-conversion",
  requireRole("Sales Agent"),
  requestLeadConversion,
);

// PATCH approve conversion — Admin/Manager only
router.patch(
  "/:id/approve-conversion",
  requireRole("Admin", "Sales Manager"),
  approveLeadConversion,
);

// POST convert to customer — all three roles (controller enforces agent approval check)
router.post(
  "/:id/convert",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  convertLeadToCustomer,
);

module.exports = router;

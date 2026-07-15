const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// 🟢 MGA PINALITAN: Imports para sa mga bagong pangalan sa quotationController.js
const {
  getAllQuotations,
  getSingleQuotation,
  createQuotation,
  updateQuotationDetails,
  updateQuotationStage,
  reorderQuotationPositions,
  deleteQuotation,
} = require("../controllers/quotationController");

// 🟢 FIX: In-update mula sa getDealTasks papuntong getQuotationTasks
const { getQuotationTasks } = require("../controllers/taskController"); 

// Lahat ng quotation routes ay nangangailangan ng authentication token
router.use(authMiddleware);

// Admin + Manager: nakikita lahat | Agent: nakikita lang ang sa kanila (scoped sa controller)
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getAllQuotations
);

// Admin + Manager: kahit anong quotation | Agent: sariling gawa/assign lang
router.get(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getSingleQuotation
);

// 🟢 FIX: In-update ang handler dito para gamitin ang getQuotationTasks
router.get(                                                         
  "/:id/tasks",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getQuotationTasks
);

// Lahat ng tatlong roles ay pwedeng gumawa — auto-assign sa agent kapag sila ang nag-create
router.post(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  createQuotation
);

// Mabilisang batch reorder ng mga card positions sa Kanban board
router.patch(
  "/batch/reorder",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  reorderQuotationPositions
);

// Pag-update ng pangunahing detalye ng Quotation
router.patch(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateQuotationDetails
);

// Paglipat ng column o status sa Kanban board (Prospecting, Qualification, atbp.)
router.patch(
  "/:id/stage",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateQuotationStage
);

// Admin lamang ang may karapatang magbura ng quotation data sa system
router.delete("/:id", requireRole("Admin"), deleteQuotation);

module.exports = router;
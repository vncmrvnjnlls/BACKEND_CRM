const express = require("express");

const {
  getProspects,
  createProspect,
  updateProspect,
  deleteProspect,
  markAsContacted,
} = require("../controllers/prospectController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getProspects);
router.post("/", protect, createProspect);
router.put("/:id", protect, updateProspect);
router.delete("/:id", protect, deleteProspect);
router.patch("/:id/contacted", protect, markAsContacted);

module.exports = router;
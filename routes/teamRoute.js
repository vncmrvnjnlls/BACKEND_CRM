const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");
const {
  getAllTeams,
  getSingleTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  assignAgentToTeam,
  unassignAgentFromTeam,
  getAssignableAgentsForTeam,
} = require("../controllers/teamController");

router.use(authMiddleware);

router.get("/", requireRole("Admin", "Sales Manager"), getAllTeams);
router.get("/:id", requireRole("Admin", "Sales Manager"), getSingleTeam);

router.post("/", requireRole("Admin"), createTeam);
router.put("/:id", requireRole("Admin"), updateTeam);
router.delete("/:id", requireRole("Admin"), deleteTeam);

router.post(
  "/:id/agents/assign",
  requireRole("Sales Manager"),
  assignAgentToTeam,
);

router.post(
  "/:id/agents/unassign",
  requireRole("Sales Manager"),
  unassignAgentFromTeam,
);

router.get(
  "/:id/assignable-agents",
  requireRole("Sales Manager"),
  getAssignableAgentsForTeam,
);
module.exports = router;

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const {
  getAllTasks,
  getSingleTask,
  createTask,
  deleteTask,
  updateTaskDetails,
  updateTaskStatus,
  updateTaskPriority,
  reorderTaskPositions,
  assignTask,
} = require("../controllers/taskController");

router.use(authMiddleware);

// GET all tasks — Agent sees own only (scoped in controller)
router.get(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getAllTasks,
);

// PATCH reorder tasks (drag reorder only)
router.patch(
  "/batch/reorder",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  reorderTaskPositions,
);

// GET single task
router.get(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  getSingleTask,
);

// POST create task
router.post(
  "/",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  createTask,
);

// PATCH full update (details only not including status)
router.patch(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateTaskDetails,
);

// DELETE task — Admin/Manager: any, Agent: personal only (scoped in controller)
router.delete(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  deleteTask,
);

// PATCH status only (kanban movement / dropdown status change only)
router.patch(
  "/:id/status",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateTaskStatus,
);

router.patch(
  "/:id/priority",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  updateTaskPriority,
);

// PATCH assign task — Admin/Manager only
router.patch("/:id/assign", requireRole("Admin", "Sales Manager"), assignTask);

module.exports = router;

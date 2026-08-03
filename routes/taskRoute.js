const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

const TASK_ATTACHMENT_DIR = "uploads/task_attachments";
fs.mkdirSync(TASK_ATTACHMENT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, TASK_ATTACHMENT_DIR);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const taskUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const {
  getAllTasks,
  getSingleTask,
  getQuotationTasks,
  createTask,
  deleteTask,
  updateTaskDetails,
  updateTaskStatus,
  updateTaskPriority,
  reorderTaskPositions,
  assignTask,
} = require("../controllers/taskController");

// 🌟 UPDATED: Smart URL validator middleware that works with Objects & Strings
const validateTaskLink = (req, res, next) => {
  let rawUrl = "";

  // 1. Extract URL depending on payload format
  if (req.body.link && typeof req.body.link === "object") {
    rawUrl = req.body.link.url || "";
  } else if (req.body.linkUrl) {
    rawUrl = req.body.linkUrl;
  } else if (typeof req.body.link === "string") {
    rawUrl = req.body.link;
  }

  // 2. Validate URL if present
  if (rawUrl && rawUrl.trim() !== "") {
    try {
      const urlToTest = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") 
        ? rawUrl 
        : `https://${rawUrl}`;
      new URL(urlToTest);
    } catch (err) {
      return res.status(400).json({ error: "Please provide a valid URL for the link field." });
    }
  }

  next();
};

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
  taskUpload.array("attachments", 10),
  validateTaskLink, // 👈 Updated & Safe
  createTask,
);

// PATCH full update
router.patch(
  "/:id",
  requireRole("Admin", "Sales Manager", "Sales Agent"),
  taskUpload.array("attachments", 10),
  validateTaskLink, // 👈 Updated & Safe
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
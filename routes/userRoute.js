const express = require("express");
const upload = require("../middleware/upload");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

// 1. IMPORT MO RITO ANG USER MODEL (Siguraduhing tama ang path papunta sa models folder mo)
const User = require("../models/User"); 

const {
  createUser,
  getAllUsers,
  getSingleUser,
  deleteUser,
  updateUser,
  getAssignableUsers,
  getUserLeads,
  getUserCustomers,
  getUserDeals,
  getUserTasks,
  updateUserAccess,
} = require("../controllers/userController");

router.use(authMiddleware);

// GET all users
router.get("/", requireRole("Admin"), getAllUsers);

// GET an assignable user
router.get(
  "/assignable",
  requireRole("Admin", "Sales Manager"),
  getAssignableUsers,
);

// --- DITO NATIN NILAGAY ANG DROPDOWN PARA HINDI SIYA MAUNAHAN NG ANOMALOUS ROUTE PARAMETERS ---

// GET all users for dropdown selection (Admin Only)
router.get("/dropdown", requireRole("Admin"), async (req, res) => {
  try {
    const users = await User.find({}, "employeeId firstName lastName role");
    res.status(200).json(users);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// GET user-owned records (admin only)
router.get("/:employeeId/leads", requireRole("Admin"), getUserLeads);
router.get("/:employeeId/customers", requireRole("Admin"), getUserCustomers);
router.get("/:employeeId/deals", requireRole("Admin"), getUserDeals);
router.get("/:employeeId/tasks", requireRole("Admin"), getUserTasks);

// GET single user access details for dynamic rendering
router.get("/:employeeId/details", requireRole("Admin"), async (req, res) => {
  try {
    const user = await User.findOne({ employeeId: req.params.employeeId });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// GET a single user
router.get("/:employeeId", requireRole("Admin"), getSingleUser);

// POST a new user
router.post(
  "/",
  requireRole("Admin"),
  upload.single("profilePicture"),
  createUser,
);

// DELETE a user
router.delete("/:employeeId", requireRole("Admin"), deleteUser);

// UPDATE a user
router.patch(
  "/:employeeId",
  requireRole("Admin"),
  upload.single("profilePicture"),
  updateUser,
);

// PATCH target user dynamic permission updates
router.patch("/:employeeId/access", requireRole("Admin"), updateUserAccess);

module.exports = router;
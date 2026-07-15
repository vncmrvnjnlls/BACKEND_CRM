const express = require("express");
const upload = require("../middleware/upload");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const requireRole = require("../middleware/roleMiddleware");

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

// GET user-owned records (admin only)
router.get("/:employeeId/leads", requireRole("Admin"), getUserLeads);
router.get("/:employeeId/customers", requireRole("Admin"), getUserCustomers);
router.get("/:employeeId/deals", requireRole("Admin"), getUserDeals);
router.get("/:employeeId/tasks", requireRole("Admin"), getUserTasks);

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

router.get("/dropdown", async (req, res) => {
  try {
    const users = await User.find({}, "employeeId firstName lastName role");
    res.status(200).json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:employeeId/details", async (req, res) => {
  try {
    const user = await User.findOne({ employeeId });
    res.status(200).json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:employeeId/access", async (req, res) => {
  try {
    const { role, accessModules } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      { employeeId: req.params.employeeId },
      { role, accessModules },
      { new: true }
    );
    res.status(200).json(updatedUser);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

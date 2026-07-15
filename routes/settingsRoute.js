const express        = require("express");
const upload         = require("../middleware/upload");
const router         = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  getSettings,
  updateProfile,
  updatePassword,
  updateAddress,
  updatePhoto,
  updateNotificationPreferences,
} = require("../controllers/settingsController");

router.use(authMiddleware);

// GET logged-in user's settings
router.get("/", getSettings);

// PATCH logged-in user's profile
router.patch("/profile", updateProfile);

// PATCH logged-in user's password
router.patch("/password", updatePassword);

// PATCH logged-in user's address
router.patch("/address", updateAddress);

// PATCH logged-in user's photo
router.patch("/photo", upload.single("profilePicture"), updatePhoto);

// PATCH logged-in user's notification preferences
router.patch("/notifications", updateNotificationPreferences);

module.exports = router;
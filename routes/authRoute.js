const express = require("express");

const {
  login,
  refresh,
  logout,
  resetPassword,
  forgotPassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

module.exports = router;
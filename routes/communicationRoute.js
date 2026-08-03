const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getConversations,
  getConversationWithUser,
  sendCommunication,
  updateCommunication, // 👈 Added
  deleteCommunication, // 👈 Added
  markCommunicationRead,
  markCommunicationsReadFromUser,
} = require("../controllers/communicationController");

router.use(authMiddleware);

// Allow any authenticated user to access communication endpoints
router.get("/", getConversations);
router.get("/user/:userId", getConversationWithUser);
router.post("/", sendCommunication);

// 🌟 NEW: Edit and Delete Message Endpoints
router.patch("/:id", updateCommunication); // Edit message body
router.delete("/:id", deleteCommunication); // Delete message

router.patch("/user/:userId/read", markCommunicationsReadFromUser);
router.patch("/:id/read", markCommunicationRead);

module.exports = router;
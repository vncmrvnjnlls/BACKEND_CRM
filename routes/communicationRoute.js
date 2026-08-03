const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getConversations,
  getConversationWithUser,
  sendCommunication,
  updateCommunication, 
  deleteCommunication,
  markCommunicationRead,
  markCommunicationsReadFromUser,
  archiveConversation,
  deleteConversation,
} = require("../controllers/communicationController");

router.use(authMiddleware);

// Allow any authenticated user to access communication endpoints
router.get("/", getConversations);
router.get("/user/:userId", getConversationWithUser);
router.post("/", sendCommunication);

//  Edit and Delete Message Endpoints
router.patch("/:id", updateCommunication); // Edit message body
router.delete("/:id", deleteCommunication); // Delete message

router.patch("/user/:userId/read", markCommunicationsReadFromUser);
router.patch("/user/:userId/archive", archiveConversation);
router.delete("/user/:userId", deleteConversation);
router.patch("/:id/read", markCommunicationRead);

module.exports = router;
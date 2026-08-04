const Communication = require("../models/Communication");
const User = require("../models/User");
const { getIO } = require("../utils/socketManager");

const populateCommunication = (query) =>
  query
    .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
    .populate("recipient", "firstName middleName lastName suffixName email role profilePicture");

const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communications = await Communication.find({
      $or: [{ sender: userId }, { recipient: userId }],
      deletedBy: { $ne: userId },
    })
      .sort({ createdAt: -1 })
      .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
      .populate("recipient", "firstName middleName lastName suffixName email role profilePicture")
      .lean();

    res.status(200).json({ communications });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getConversationWithUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const otherId = req.params.userId;

    const communications = await Communication.find({
      $or: [
        { sender: userId, recipient: otherId },
        { sender: otherId, recipient: userId },
      ],
      deletedBy: { $ne: userId },
    })
      .sort({ createdAt: 1 })
      .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
      .populate("recipient", "firstName middleName lastName suffixName email role profilePicture")
      .lean();

    res.status(200).json({ communications });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

const sendCommunication = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, body } = req.body;

    if (!recipientId || !body?.trim()) {
      return res.status(400).json({ error: "Recipient and message body are required." });
    }

    const recipient = await User.findById(recipientId).select("_id");
    if (!recipient) {
      return res.status(404).json({ error: "Recipient not found." });
    }

    const communication = await Communication.create({
      sender: senderId,
      recipient: recipientId,
      body: body.trim(),
    });

    const populated = await populateCommunication(Communication.findById(communication._id));

    const io = getIO();
    io.to(`user:${recipientId}`).emit("communication:received", populated);
    io.to(`user:${senderId}`).emit("communication:sent", populated);

    res.status(201).json({ communication: populated });
  } catch (error) {
    console.error("Send communication error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 🌟 NEW: Update / Edit Message
const updateCommunication = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const communicationId = req.params.id;
    const { body } = req.body;

    if (!body?.trim()) {
      return res.status(400).json({ error: "Updated message body cannot be empty." });
    }

    // Ensure only the original sender can edit their message
    const communication = await Communication.findOne({
      _id: communicationId,
      sender: senderId,
    });

    if (!communication) {
      return res.status(404).json({
        error: "Message not found or you are not authorized to edit this message.",
      });
    }

    communication.body = body.trim();
    await communication.save();

    const populated = await populateCommunication(Communication.findById(communication._id));

    // Emit real-time update event to both parties
    const io = getIO();
    io.to(`user:${communication.recipient}`).emit("communication:updated", populated);
    io.to(`user:${senderId}`).emit("communication:updated", populated);

    res.status(200).json({ communication: populated });
  } catch (error) {
    console.error("Update communication error:", error);
    res.status(500).json({ error: error.message });
  }
};

// Delete Message
const deleteCommunication = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const communicationId = req.params.id;

    const communication = await Communication.findById(communicationId);

    if (!communication) {
      return res.status(404).json({
        error: "Message not found.",
      });
    }

    const isSender = String(communication.sender) === String(senderId);
    const isRecipient = String(communication.recipient) === String(senderId);

    if (!isSender && !isRecipient) {
      return res.status(403).json({
        error: "You are not authorized to delete this message.",
      });
    }

    const deletedBy = communication.deletedBy || [];
    const alreadyDeleted = deletedBy.some((id) => String(id) === String(senderId));

    if (!alreadyDeleted) {
      communication.deletedBy = [...deletedBy, senderId];
    }

    communication.isDeleted = true;
    await communication.save();

    const io = getIO();
    io.to(`user:${communication.recipient}`).emit("communication:deleted", {
      communicationId,
      deletedBy: senderId,
      isDeleted: true,
    });
    io.to(`user:${senderId}`).emit("communication:deleted", {
      communicationId,
      deletedBy: senderId,
      isDeleted: true,
    });

    res.status(200).json({ message: "Message deleted successfully.", communicationId });
  } catch (error) {
    console.error("Delete communication error:", error);
    res.status(500).json({ error: error.message });
  }
};

const markCommunicationRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const communicationId = req.params.id;

    const communication = await Communication.findOneAndUpdate(
      { _id: communicationId, recipient: userId },
      { isRead: true },
      { new: true },
    );

    if (!communication) {
      return res.status(404).json({ error: "Message not found." });
    }

    res.status(200).json({ communication });
  } catch (error) {
    console.error("Mark communication read error:", error);
    res.status(500).json({ error: error.message });
  }
};

const markCommunicationsReadFromUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    const result = await Communication.updateMany(
      {
        sender: otherUserId,
        recipient: currentUserId,
        isRead: false,
      },
      { isRead: true },
    );

    const updatedCount = result.modifiedCount ?? result.nModified ?? 0;

    res.status(200).json({ updated: updatedCount });
  } catch (error) {
    console.error("Mark communications read from user error:", error);
    res.status(500).json({ error: error.message });
  }
};

const archiveConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const otherUserId = req.params.userId;
    const { isArchived } = req.body;

    const communications = await Communication.find({
      $or: [
        { sender: userId, recipient: otherUserId },
        { sender: otherUserId, recipient: userId },
      ],
    });

    if (!communications.length) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const update = isArchived
      ? { $addToSet: { archivedBy: userId } }
      : { $pull: { archivedBy: userId } };

    await Communication.updateMany(
      {
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId },
        ],
      },
      update,
    );

    const io = getIO();
    io.to(`user:${userId}`).emit("communication:archived", {
      userId,
      otherUserId,
      isArchived,
    });

    res.status(200).json({ message: "Conversation archive state updated.", isArchived });
  } catch (error) {
    console.error("Archive conversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const otherUserId = req.params.userId;

    const result = await Communication.updateMany(
      {
        $or: [
          { sender: userId, recipient: otherUserId },
          { sender: otherUserId, recipient: userId },
        ],
      },
      {
        $addToSet: { deletedBy: userId },
      },
    );

    if (!result.modifiedCount && !result.matchedCount) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    const io = getIO();
    io.to(`user:${userId}`).emit("communication:conversationDeleted", {
      userId,
      otherUserId,
    });

    res.status(200).json({ message: "Conversation deleted successfully.", otherUserId });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getConversations,
  getConversationWithUser,
  sendCommunication,
  updateCommunication, 
  deleteCommunication, 
  markCommunicationRead,
  markCommunicationsReadFromUser,
  archiveConversation,
  deleteConversation,
};
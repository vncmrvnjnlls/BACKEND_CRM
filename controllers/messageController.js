const Message = require("../models/Message");
const User = require("../models/User");
const { getIO } = require("../utils/socketManager");

const populateMessage = (query) =>
  query
    .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
    .populate("recipient", "firstName middleName lastName suffixName email role profilePicture");

const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const messages = await Message.find({
      $or: [{ sender: userId }, { recipient: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
      .populate("recipient", "firstName middleName lastName suffixName email role profilePicture")
      .lean();

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ error: error.message });
  }
};

const getConversationWithUser = async (req, res) => {
  try {
    const userId = req.user.userId;
    const otherId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { sender: userId, recipient: otherId },
        { sender: otherId, recipient: userId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate("sender", "firstName middleName lastName suffixName email role profilePicture")
      .populate("recipient", "firstName middleName lastName suffixName email role profilePicture")
      .lean();

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Get conversation error:", error);
    res.status(500).json({ error: error.message });
  }
};

const sendMessage = async (req, res) => {
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

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      body: body.trim(),
    });

    const populated = await populateMessage(Message.findById(message._id));

    const io = getIO();
    io.to(`user:${recipientId}`).emit("message:received", populated);
    io.to(`user:${senderId}`).emit("message:sent", populated);

    res.status(201).json({ message: populated });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
};

const markMessageRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const messageId = req.params.id;

    const message = await Message.findOneAndUpdate(
      { _id: messageId, recipient: userId },
      { isRead: true },
      { new: true },
    );

    if (!message) {
      return res.status(404).json({ error: "Message not found." });
    }

    res.status(200).json({ message });
  } catch (error) {
    console.error("Mark message read error:", error);
    res.status(500).json({ error: error.message });
  }
};

const markMessagesReadFromUser = async (req, res) => {
  try {
    const currentUserId = req.user.userId;
    const otherUserId = req.params.userId;

    const result = await Message.updateMany(
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
    console.error("Mark messages read from user error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getConversations,
  getConversationWithUser,
  sendMessage,
  markMessageRead,
  markMessagesReadFromUser,
};

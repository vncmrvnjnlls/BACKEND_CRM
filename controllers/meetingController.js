const Meeting = require("../models/Meeting");
const mongoose = require("mongoose");
// Kung may helper ka para sa team agents ng manager, i-require mo rito (halimbawa):
// const { getTeamAgentIdsForManager } = require("./dashboardController"); 

// @desc    Get all meetings (Role-Based Scoping para sa Calendar)
// @route   GET /api/meetings
const getAllMeetings = async (req, res) => {
  try {
    const { role, _id: userId } = req.user; // Tiyaking tama ang property base sa authMiddleware mo (_id o id)
    let filter = {};

    // 🟢 KOPYAHIN ANG LOGIC MULA SA DASHBOARD PARA PAREHO ANG BILANG
    if (role === "Sales Agent") {
      filter = {
        $or: [
          { createdBy: new mongoose.Types.ObjectId(userId) },
          { assignedTo: new mongoose.Types.ObjectId(userId) },
          { host: new mongoose.Types.ObjectId(userId) }
        ]
      };
    } else if (role === "Sales Manager") {
      // Kung may manager scoping ka, kunin ang agentIds. Kung wala pa, makikita muna ang sa kanya at gawa niya:
      filter = {
        $or: [
          { createdBy: new mongoose.Types.ObjectId(userId) },
          { assignedTo: new mongoose.Types.ObjectId(userId) },
          { host: new mongoose.Types.ObjectId(userId) }
        ]
      };
    } else if (role === "Admin") {
      // Ang Admin ay walang filter para makita ang lahat ng 5 meetings sa system!
      filter = {};
    }

    // 🟢 Ginamit ang 'dateTime' para sa tamang sorting ng timeline scheduler natin
    const meetings = await Meeting.find(filter)
      .sort({ dateTime: 1 })
      .populate({ path: "relatedToClient", select: "firstName lastName companyName", options: { strictPopulate: false } })
      .lean();

    res.status(200).json(meetings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// @desc    Create a new meeting
// @route   POST /api/meetings
const createMeeting = async (req, res) => {
  try {
    // Awtomatikong isasabit ang req.user._id mula sa inyong protect middleware
    const meetingData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const newMeeting = await Meeting.create(meetingData);
    res.status(201).json(newMeeting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Update a meeting
// @route   PATCH /api/meetings/:id
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    // Pinapayagan nating ma-update ang LAHAT ng fields na pwedeng baguhin sa UI modal
    const updatedMeeting = await Meeting.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.status(200).json(updatedMeeting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Delete a meeting
// @route   DELETE /api/meetings/:id
const deleteMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMeeting = await Meeting.findByIdAndDelete(id);

    if (!deletedMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.status(200).json({ message: "Meeting deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
};
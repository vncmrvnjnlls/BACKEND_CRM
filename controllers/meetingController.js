const Meeting = require("../models/Meeting");
const mongoose = require("mongoose");
const eventBus = require("../utils/eventBus");
const events = require("../constants/events");
// Kung may helper ka para sa team agents ng manager, i-require mo rito (halimbawa):
// const { getTeamAgentIdsForManager } = require("./dashboardController"); 

const normalizeIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
};

// @desc    Get all meetings (Role-Based Scoping para sa Calendar)
// @route   GET /api/meetings
const getAllMeetings = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let filter = {};

    if (["Sales Agent", "Support Staff"].includes(role)) {
      filter = {
        $or: [
          { createdBy: userObjectId },
          { participantIds: userObjectId },
          { assignedTo: userObjectId },
          { attendees: userObjectId },
        ],
      };
    } else if (role === "Sales Manager") {
      filter = {
        $or: [
          { createdBy: userObjectId },
          { participantIds: userObjectId },
          { assignedTo: userObjectId },
          { attendees: userObjectId },
        ],
      };
    } else if (["Super Admin", "Admin"].includes(role)) {
      filter = {};
    } else {
      filter = {
        $or: [
          { createdBy: userObjectId },
          { participantIds: userObjectId },
          { assignedTo: userObjectId },
          { attendees: userObjectId },
        ],
      };
    }

    const meetings = await Meeting.find(filter)
      .sort({ date: 1, startTime: 1 })
      .populate({ path: "createdBy", select: "firstName lastName profilePicture", options: { strictPopulate: false } })
      .populate({ path: "assignedTo", select: "firstName lastName profilePicture", options: { strictPopulate: false } })
      .populate({ path: "attendees", select: "firstName lastName profilePicture", options: { strictPopulate: false } })
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
    const meetingData = {
      ...req.body,
      createdBy: req.user._id,
      participantIds: normalizeIds(req.body.participantIds),
      assignedTo: normalizeIds(req.body.assignedTo),
      attendees: normalizeIds(req.body.attendees),
    };

    const newMeeting = await Meeting.create(meetingData);

    eventBus.emit(events.MEETING_CREATED, {
      meetingId: newMeeting._id,
      createdBy: req.user._id,
      participantIds: newMeeting.participantIds || [],
      assignedTo: newMeeting.assignedTo || [],
      attendees: newMeeting.attendees || [],
      teamId: req.user.teamId,
    });

    res.status(201).json(newMeeting);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// @desc    Update a meeting
// @route   PATCH /api/meetings/:id
// @desc    Update a meeting
// @route   PATCH /api/meetings/:id
const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedMeeting = await Meeting.findByIdAndUpdate(
      id,
      {
        ...req.body,
        participantIds: normalizeIds(req.body.participantIds),
        assignedTo: normalizeIds(req.body.assignedTo),
        attendees: normalizeIds(req.body.attendees),
      },
      { new: true, runValidators: true }
    ).populate({
      path: "createdBy",
      select: "firstName lastName",
      options: { strictPopulate: false },
    });

    if (!updatedMeeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    eventBus.emit(events.MEETING_UPDATED, {
      meetingId: updatedMeeting._id,
      createdBy: updatedMeeting.createdBy?._id || updatedMeeting.createdBy,
      participantIds: updatedMeeting.participantIds || [],
      assignedTo: updatedMeeting.assignedTo || [],
      attendees: updatedMeeting.attendees || [],
      teamId: req.user.teamId,
    });

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

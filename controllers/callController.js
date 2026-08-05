const Call = require("../models/Call");
const eventBus = require("../utils/eventBus");
const events = require("../constants/events");

const CALL_USER_FIELDS =
  "firstName middleName lastName suffixName email profilePicture";
const populateCallUsers = (query) =>
  query
    .populate("assignedTo", "firstName lastName")
    .populate("createdBy", CALL_USER_FIELDS);

// 1. GET ALL CALLS (Removed client populate)
const getAllCalls = async (req, res) => {
  try {
    const calls = await populateCallUsers(Call.find()).sort({ schedule: -1 });

    res.status(200).json(calls);
  } catch (error) {
    console.error("Get all calls error:", error);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
};

// 2. CREATE NEW CALL (Removed client populate from return object)
const createCall = async (req, res) => {
  try {
    const {
      client,
      company,
      contactMethod,
      contactNumber,
      callType,
      schedule,
      status,
      completedAt,
      notes,
      assignedTo,
    } = req.body;
    const userId = req.user.userId;

    const newCall = await Call.create({
      client, // This will now accept your typed string directly (e.g., "Juan Dela Cruz")
      company,
      contactMethod: contactMethod || "Mobile",
      contactNumber,
      callType,
      schedule,
      status: status || "Scheduled",
      completedAt:
        status === "Completed" ? completedAt || new Date() : null,
      notes,
      assignedTo: assignedTo || userId,
      createdBy: userId,
    });

    const populatedCall = await populateCallUsers(Call.findById(newCall._id));

    eventBus.emit(events.CALL_CREATED, {
      callId: newCall._id,
      status: newCall.status,
      userId,
    });

    res.status(201).json(populatedCall);
  } catch (error) {
    console.error("Create call error:", error);
    res.status(500).json({ error: "Failed to log call" });
  }
};

// ... keep updateCall and deleteCall the same, just remove any .populate("client") if present.

// 3. I-UPDATE ANG STATUS O DETALYE NG CALL
// controllers/callController.js

// Hanapin ang updateCall function mo at i-update nang ganito:
const updateCall = async (req, res) => {
  try {
    const { id } = req.params;

    // Destructure natin LAHAT ng pwedeng i-update galing frontend/postman body
    const existingCall = await Call.findById(id);
    if (!existingCall) {
      return res.status(404).json({ error: "Call not found" });
    }

    const {
      client,
      company,
      contactMethod,
      contactNumber,
      callType,
      schedule,
      status,
      completedAt,
      notes,
      assignedTo,
    } = req.body;
    const resolvedStatus = status || existingCall.status;
    const resolvedCompletedAt =
      resolvedStatus === "Completed"
        ? completedAt || existingCall.completedAt || new Date()
        : null;

    // Hanapin ang record at i-update gamit ang mga bagong values
    const updatedCall = await Call.findByIdAndUpdate(
      id,
      {
        client: client ?? existingCall.client,
        company: company ?? existingCall.company,
        contactMethod: contactMethod ?? existingCall.contactMethod,
        contactNumber: contactNumber ?? existingCall.contactNumber,
        callType: callType ?? existingCall.callType,
        schedule: schedule ?? existingCall.schedule,
        status: resolvedStatus,
        completedAt: resolvedCompletedAt,
        notes: notes ?? existingCall.notes,
        assignedTo: assignedTo ?? existingCall.assignedTo,
      },
      { new: true, runValidators: true } // { new: true } para ibalik ang pinakabagong data sa response
    );

    const populatedCall = await populateCallUsers(
      Call.findById(updatedCall._id),
    );

    const userId = req.user.userId;
    if (
      existingCall.status !== "Completed" &&
      updatedCall.status === "Completed"
    ) {
      eventBus.emit(events.CALL_COMPLETED, {
        callId: updatedCall._id,
        oldStatus: existingCall.status,
        userId,
      });
    } else if (existingCall.status !== updatedCall.status) {
      eventBus.emit(events.CALL_STATUS_CHANGED, {
        callId: updatedCall._id,
        oldStatus: existingCall.status,
        newStatus: updatedCall.status,
        userId,
      });
    } else {
      eventBus.emit(events.CALL_UPDATED, {
        callId: updatedCall._id,
        userId,
      });
    }

    res.status(200).json(populatedCall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. BURAHIN ANG CALL RECORD
const deleteCall = async (req, res) => {
  try {
    const deleted = await Call.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Call not found" });

    eventBus.emit(events.CALL_DELETED, {
      callId: deleted._id,
      userId: req.user.userId,
    });

    res.status(200).json({ message: "Call deleted successfully" });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({ error: "Failed to delete call" });
  }
};

module.exports = { getAllCalls, createCall, updateCall, deleteCall };
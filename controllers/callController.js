const Call = require("../models/Call");

// 1. GET ALL CALLS (Removed client populate)
const getAllCalls = async (req, res) => {
  try {
    const calls = await Call.find()
      .populate("assignedTo", "firstName lastName")
      .sort({ schedule: -1 });

    res.status(200).json(calls);
  } catch (error) {
    console.error("Get all calls error:", error);
    res.status(500).json({ error: "Failed to fetch calls" });
  }
};

// 2. CREATE NEW CALL (Removed client populate from return object)
const createCall = async (req, res) => {
  try {
    const { client, company, contactNumber, callType, schedule, status, notes, assignedTo } = req.body;
    const userId = req.user.userId;

    const newCall = await Call.create({
      client, // This will now accept your typed string directly (e.g., "Juan Dela Cruz")
      company,
      contactNumber,
      callType,
      schedule,
      status: status || "Scheduled",
      notes,
      assignedTo: assignedTo || userId,
      createdBy: userId,
    });

    const populatedCall = await Call.findById(newCall._id)
      .populate("assignedTo", "firstName lastName");

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
    const { 
      client, 
      company, 
      contactNumber, 
      callType, 
      schedule, 
      status, 
      notes 
    } = req.body;

    // Hanapin ang record at i-update gamit ang mga bagong values
    const updatedCall = await Call.findByIdAndUpdate(
      id,
      {
        client,
        company,
        contactNumber,
        callType,
        schedule,
        status,
        notes
      },
      { new: true, runValidators: true } // { new: true } para ibalik ang pinakabagong data sa response
    );

    if (!updatedCall) {
      return res.status(404).json({ error: "Call not found" });
    }

    res.status(200).json(updatedCall);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. BURAHIN ANG CALL RECORD
const deleteCall = async (req, res) => {
  try {
    const deleted = await Call.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Call not found" });
    res.status(200).json({ message: "Call deleted successfully" });
  } catch (error) {
    console.error("Delete call error:", error);
    res.status(500).json({ error: "Failed to delete call" });
  }
};

module.exports = { getAllCalls, createCall, updateCall, deleteCall };
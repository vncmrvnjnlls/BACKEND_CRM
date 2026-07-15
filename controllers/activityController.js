const Activity = require("../models/Activity");
const { ensureDocumentAccess } = require("../utils/teamScope");

const POPULATE_USER =
  "firstName middleName lastName suffixName email role employeeId profilePicture sex team";

const populateActivity = (query) => query.populate("createdBy", POPULATE_USER);

// GET TIMELINE (for Lead / Deal / Customer / Task)

const getActivities = async (req, res) => {
  try {
    const { relatedToType, relatedToId } = req.query;

    if (!relatedToType || !relatedToId) {
      return res.status(400).json({
        error: "relatedToType and relatedToId are required",
      });
    }

    const activities = await populateActivity(
      Activity.find({
        relatedToType,
        relatedToId,
      }).sort({ activityDate: -1 }),
    );

    res.status(200).json(activities);
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
};

// CREATE ACTIVITY (manual note only)
const createActivity = async (req, res) => {
  try {
    const { relatedToType, relatedToId, action, title, description, metadata } =
      req.body;
    const { userId } = req.user;

    if (!relatedToType || !relatedToId || !action || !title) {
      return res.status(400).json({
        error: "relatedToType, relatedToId, action, title are required",
      });
    }

    // Manual entries can only be notes
    if (action !== "NOTE") {
      return res.status(400).json({
        error: "Manual activities can only be of action type NOTE",
      });
    }

    const activity = await Activity.create({
      relatedToType,
      relatedToId,
      action,
      title,
      description,
      metadata,
      createdBy: userId,
      isSystemGenerated: false,
    });

    const populated = await populateActivity(Activity.findById(activity._id));
    res
      .status(201)
      .json({ message: "Activity created successfully", activity: populated });
  } catch (error) {
    console.error("Create activity error:", error);
    res.status(500).json({ error: "Failed to create activity" });
  }
};

module.exports = {
  getActivities,
  createActivity,
};

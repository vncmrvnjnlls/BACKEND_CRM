const Activity = require("../models/Activity");

const logSystemActivity = async ({
  relatedToType,
  relatedToId,
  action,
  title,
  description = "",
  metadata = {},
  userId = null,
}) => {
  try {
    if (!relatedToType || !relatedToId || !action || !title) {
      throw new Error("Missing required activity fields");
    }

    const activity = await Activity.create({
      relatedToType,
      relatedToId,
      action,
      title,
      description,
      metadata,
      createdBy: userId || undefined,
      isSystemGenerated: true,
    });

    console.log(
      `[Activity] ${relatedToType} | ${action} | "${title}" | ref: ${relatedToId} | by: ${userId ?? "system"}`,
    );

    return activity;
  } catch (error) {
    console.error("System activity log error:", error);
  }
};

module.exports = { logSystemActivity };

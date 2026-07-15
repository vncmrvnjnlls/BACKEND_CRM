const Lead = require("../models/Lead");

const CONTACT_TASK_TYPES = ["Call", "Email", "Message", "Meeting"];

/**
 * If a completed task is linked to a "New" lead via a contact-type task,
 * automatically advance that lead to "Contacted".
 */
const autoAdvanceLeadToContacted = async (task) => {
  // Must be completed, related to a Lead, and a contact-type task
  if (
    task.status !== "Completed" ||
    task.relatedToType !== "Lead" ||
    !task.relatedTo ||
    !CONTACT_TASK_TYPES.includes(task.taskType)
  ) {
    return null;
  }

  // Only advance if lead is still "New"
  const lead = await Lead.findOneAndUpdate(
    { _id: task.relatedTo, status: "New" },
    { $set: { status: "Contacted" } },
    { new: true },
  );

  return lead;
};

module.exports = { autoAdvanceLeadToContacted };

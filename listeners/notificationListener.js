const eventBus = require("../utils/eventBus");
const { createNotification } = require("../services/notificationService");
const events = require("../constants/events");
const { findTeamManagers } = require("../utils/teamScope");

const isValidRecipient = (recipient) => {
  if (!recipient) return false;
  if (typeof recipient === "string") return recipient.trim().length > 0;
  if (recipient._id) return true;
  return true;
};

const getRecipientId = (recipient) => {
  if (!recipient) return null;
  if (recipient._id) return recipient._id;
  return recipient;
};

const notifyOne = async ({
  recipient,
  type,
  title,
  message,
  relatedToType,
  relatedToId,
  triggeredBy,
}) => {
  const recipientId = getRecipientId(recipient);

  if (!isValidRecipient(recipientId)) return null;

  return createNotification({
    recipient: recipientId,
    type,
    title,
    message,
    relatedToType,
    relatedToId,
    triggeredBy,
  });
};

const notifyMany = async (recipients, payload) => {
  const recipientList = Array.from(recipients || [])
    .map(getRecipientId)
    .filter(isValidRecipient);

  if (recipientList.length === 0) return [];

  return Promise.all(
    recipientList.map((recipient) =>
      notifyOne({
        recipient,
        ...payload,
      })
    )
  );
};

// ---------------- LEADS ----------------

eventBus.on(events.LEAD_ASSIGNED, async (data) => {
  try {
    if (!data.newAssignee) return;

    await notifyOne({
      recipient: data.newAssignee,
      type: "LEAD_ASSIGNED",
      title: "Lead Assigned to You",
      message: data.oldAssignee
        ? "You have been reassigned to a lead."
        : "A new lead has been assigned to you.",
      relatedToType: "Lead",
      relatedToId: data.leadId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("LEAD_ASSIGNED notification error:", error);
  }
});

eventBus.on(events.LEAD_CONVERSION_REQUESTED, async (data) => {
  try {
    const managers = await findTeamManagers(data.teamId);

    await notifyMany(managers, {
      type: "LEAD_CONVERSION_REQUESTED",
      title: "Lead Conversion Requested",
      message: "A sales agent has requested conversion of a lead to a client.",
      relatedToType: "Lead",
      relatedToId: data.leadId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("LEAD_CONVERSION_REQUESTED notification error:", error);
  }
});

eventBus.on(events.LEAD_CONVERSION_APPROVED, async (data) => {
  try {
    const Lead = require("../models/Lead");
    const lead = await Lead.findById(data.leadId).select("leadAssignee").lean();

    if (!lead?.leadAssignee) return;

    await notifyOne({
      recipient: lead.leadAssignee,
      type: "LEAD_CONVERSION_APPROVED",
      title: "Lead Conversion Approved",
      message:
        "Your conversion request has been approved. You can now convert the lead.",
      relatedToType: "Lead",
      relatedToId: data.leadId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("LEAD_CONVERSION_APPROVED notification error:", error);
  }
});

// ---------------- QUOTATIONS ----------------

eventBus.on(events.QUOTATION_ASSIGNED, async (data) => {
  try {
    if (!data.newAssignee) return;

    await notifyOne({
      recipient: data.newAssignee,
      type: "QUOTATION_ASSIGNED",
      title: "Quotation Assigned to You",
      message: data.oldAssignee
        ? "You have been reassigned to a quotation."
        : "A new quotation has been assigned to you.",
      relatedToType: "Quotation",
      relatedToId: data.quotationId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("QUOTATION_ASSIGNED notification error:", error);
  }
});

// ---------------- CLIENTS ----------------

eventBus.on(events.CLIENT_ASSIGNED, async (data) => {
  try {
    if (!data.newAssignee) return;

    await notifyOne({
      recipient: data.newAssignee,
      type: "CLIENT_ASSIGNED",
      title: "Client Assigned to You",
      message: data.oldAssignee
        ? "You have been reassigned to a client."
        : "A new client has been assigned to you.",
      relatedToType: "Client",
      relatedToId: data.clientId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("CLIENT_ASSIGNED notification error:", error);
  }
});

// ---------------- TASKS ----------------

eventBus.on(events.TASK_ASSIGNED, async (data) => {
  try {
    if (!data.newAssignee) return;

    await notifyOne({
      recipient: data.newAssignee,
      type: "TASK_ASSIGNED",
      title: "Task Assigned to You",
      message: data.oldAssignee
        ? "You have been reassigned to a task."
        : "A new task has been assigned to you.",
      relatedToType: "Task",
      relatedToId: data.taskId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("TASK_ASSIGNED notification error:", error);
  }
});

eventBus.on(events.TASK_STATUS_CHANGED, async (data) => {
  try {
    const Task = require("../models/Task");
    const task = await Task.findById(data.taskId)
      .select("createdBy assignedTo")
      .lean();

    if (!task) return;

    const recipients = new Set();

    const createdBy = task.createdBy?.toString();
    const assignedTo = task.assignedTo?.toString();
    const userId = data.userId?.toString();

    if (createdBy && createdBy !== userId) {
      recipients.add(createdBy);
    }

    if (assignedTo && assignedTo !== userId && assignedTo !== createdBy) {
      recipients.add(assignedTo);
    }

    await notifyMany(recipients, {
      type: "TASK_STATUS_CHANGED",
      title: "Task Status Updated",
      message: `Task status changed from "${data.oldStatus}" to "${data.newStatus}".`,
      relatedToType: "Task",
      relatedToId: data.taskId,
      triggeredBy: data.userId,
    });
  } catch (error) {
    console.error("TASK_STATUS_CHANGED notification error:", error);
  }
});
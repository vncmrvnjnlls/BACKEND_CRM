const eventBus = require("../utils/eventBus");
const { logSystemActivity } = require("../services/activityService");
const events = require("../constants/events");
const ACTIONS = require("../constants/actions");

const createActivity = async (payload) => {
  try {
    await logSystemActivity(payload);
  } catch (err) {
    console.error("Activity listener error:", err);
  }
};

// ---------------- LEADS ----------------

eventBus.on(events.LEAD_CREATED, (data) => {
  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.CREATE,
    title: "Lead Created",
    description: `Lead created with status ${data.status}`,
    userId: data.userId,
  });
});

eventBus.on(events.LEAD_STATUS_CHANGED, (data) => {
  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.STATUS_CHANGE,
    title: `Status changed to ${data.newStatus}`,
    metadata: { oldValue: data.oldStatus, newValue: data.newStatus },
    userId: data.userId,
  });
});

eventBus.on(events.LEAD_ASSIGNED, (data) => {
  const title = !data.newAssignee
    ? "Lead Unassigned"
    : !data.oldAssignee
      ? "Lead Assigned"
      : "Lead Reassigned";

  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.ASSIGN,
    title,
    metadata: { oldValue: data.oldAssignee, newValue: data.newAssignee },
    userId: data.userId,
  });
});

eventBus.on(events.LEAD_CONVERSION_REQUESTED, (data) => {
  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.CONVERSION_REQUESTED,
    title: "Conversion Requested",
    description: "Sales agent requested lead conversion to client",
    userId: data.userId,
  });
});

eventBus.on(events.LEAD_CONVERSION_APPROVED, (data) => {
  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.CONVERSION_APPROVED,
    title: "Conversion Approved",
    description: "Manager approved lead conversion to client",
    userId: data.userId,
  });
});

eventBus.on(events.LEAD_CONVERTED, (data) => {
  createActivity({
    relatedToType: "Lead",
    relatedToId: data.leadId,
    action: ACTIONS.CONVERT,
    title: "Lead Converted to Client",
    userId: data.userId,
  });
});

// ---------------- QUOTATIONS (In-update mula sa Deals) ----------------

eventBus.on(events.QUOTATION_CREATED, (data) => {
  createActivity({
    relatedToType: "Quotation",
    relatedToId: data.quotationId, // Gumagamit na ng quotationId payload reference
    action: ACTIONS.CREATE,
    title: "Quotation Created",
    description: `Quotation created at stage ${data.stage}`,
    userId: data.userId,
  });
});

eventBus.on(events.QUOTATION_UPDATED, (data) => {
  createActivity({
    relatedToType: "Quotation",
    relatedToId: data.quotationId,
    action: ACTIONS.UPDATE,
    title: "Quotation Updated",
    userId: data.userId,
  });
});

eventBus.on(events.QUOTATION_STAGE_CHANGED, (data) => {
  createActivity({
    relatedToType: "Quotation",
    relatedToId: data.quotationId,
    action: ACTIONS.STAGE_CHANGE,
    title: `Stage changed to ${data.newStage}`,
    metadata: { oldValue: data.oldStage, newValue: data.newStage },
    userId: data.userId,
  });
});

eventBus.on(events.QUOTATION_ASSIGNED, (data) => {
  const title = !data.newAssignee
    ? "Quotation Unassigned"
    : !data.oldAssignee
      ? "Quotation Assigned"
      : "Quotation Reassigned";

  createActivity({
    relatedToType: "Quotation",
    relatedToId: data.quotationId,
    action: ACTIONS.ASSIGN,
    title,
    metadata: { oldValue: data.oldAssignee, newValue: data.newAssignee },
    userId: data.userId,
  });
});

// ---------------- CLIENTS (In-update mula sa Customers) ----------------

eventBus.on(events.CLIENT_CREATED, (data) => {
  createActivity({
    relatedToType: "Client",
    relatedToId: data.clientId, // Gumagamit na ng clientId payload reference
    action: ACTIONS.CREATE,
    title: "Client Created",
    userId: data.userId,
  });
});

eventBus.on(events.CLIENT_UPDATED, (data) => {
  createActivity({
    relatedToType: "Client",
    relatedToId: data.clientId,
    action: ACTIONS.UPDATE,
    title: "Client Updated",
    userId: data.userId,
  });
});

eventBus.on(events.CLIENT_STATUS_CHANGED, (data) => {
  createActivity({
    relatedToType: "Client",
    relatedToId: data.clientId,
    action: ACTIONS.STATUS_CHANGE,
    title: `Status changed to ${data.newStatus}`,
    metadata: { oldValue: data.oldStatus, newValue: data.newStatus },
    userId: data.userId,
  });
});

eventBus.on(events.CLIENT_ASSIGNED, (data) => {
  const title = !data.newAssignee
    ? "Client Unassigned"
    : !data.oldAssignee
      ? "Client Assigned"
      : "Client Reassigned";

  createActivity({
    relatedToType: "Client",
    relatedToId: data.clientId,
    action: ACTIONS.ASSIGN,
    title,
    metadata: { oldValue: data.oldAssignee, newValue: data.newAssignee },
    userId: data.userId,
  });
});

// ---------------- TASKS ----------------

eventBus.on(events.TASK_CREATED, (data) => {
  createActivity({
    relatedToType: "Task",
    relatedToId: data.taskId,
    action: ACTIONS.CREATE,
    title: "Task Created",
    description: `Task created with status ${data.status}`,
    userId: data.userId,
  });
});

eventBus.on(events.TASK_UPDATED, (data) => {
  createActivity({
    relatedToType: "Task",
    relatedToId: data.taskId,
    action: ACTIONS.UPDATE,
    title: "Task Updated",
    userId: data.userId,
  });
});

eventBus.on(events.TASK_STATUS_CHANGED, (data) => {
  createActivity({
    relatedToType: "Task",
    relatedToId: data.taskId,
    action: ACTIONS.STATUS_CHANGE,
    title: `Status changed to ${data.newStatus}`,
    metadata: { oldValue: data.oldStatus, newValue: data.newStatus },
    userId: data.userId,
  });
});

eventBus.on(events.TASK_ASSIGNED, (data) => {
  const title = !data.newAssignee
    ? "Task Unassigned"
    : !data.oldAssignee
      ? "Task Assigned"
      : "Task Reassigned";

  createActivity({
    relatedToType: "Task",
    relatedToId: data.taskId,
    action: ACTIONS.ASSIGN,
    title,
    metadata: { oldValue: data.oldAssignee, newValue: data.newAssignee },
    userId: data.userId,
  });
});

eventBus.on(events.TASK_PRIORITY_CHANGED, (data) => {
  createActivity({
    relatedToType: "Task",
    relatedToId: data.taskId,
    action: ACTIONS.UPDATE,
    title: `Priority changed to ${data.newPriority}`,
    metadata: { oldValue: data.oldPriority, newValue: data.newPriority },
    userId: data.userId,
  });
});
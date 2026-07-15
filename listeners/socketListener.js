const eventBus = require("../utils/eventBus");
const { getIO } = require("../utils/socketManager");
const events = require("../constants/events");

// ---------------- LEADS ----------------

eventBus.on(events.LEAD_CREATED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_CREATED, {
    leadId: data.leadId,
    status: data.status,
  });
});

eventBus.on(events.LEAD_UPDATED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_UPDATED, {
    leadId: data.leadId,
  });
});

eventBus.on(events.LEAD_STATUS_CHANGED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_STATUS_CHANGED, {
    leadId: data.leadId,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
  });
});

eventBus.on(events.LEAD_ASSIGNED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_ASSIGNED, {
    leadId: data.leadId,
    oldAssignee: data.oldAssignee,
    newAssignee: data.newAssignee,
  });
});

eventBus.on(events.LEAD_CONVERSION_REQUESTED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_CONVERSION_REQUESTED, {
    leadId: data.leadId,
  });
});

eventBus.on(events.LEAD_CONVERSION_APPROVED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_CONVERSION_APPROVED, {
    leadId: data.leadId,
  });
});

eventBus.on(events.LEAD_CONVERTED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.LEAD_CONVERTED, {
    leadId: data.leadId,
  });
});

// ---------------- DEALS ----------------

eventBus.on(events.DEAL_CREATED, (data) => {
  getIO()
    .to(`team:${data.teamId}`)
    .emit(events.DEAL_CREATED, { dealId: data.dealId });
});

eventBus.on(events.DEAL_UPDATED, (data) => {
  getIO()
    .to(`team:${data.teamId}`)
    .emit(events.DEAL_UPDATED, { dealId: data.dealId });
});

eventBus.on(events.DEAL_STAGE_CHANGED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.DEAL_STAGE_CHANGED, {
    dealId: data.dealId,
    oldStage: data.oldStage,
    newStage: data.newStage,
  });
});

eventBus.on(events.DEAL_ASSIGNED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.DEAL_ASSIGNED, {
    dealId: data.dealId,
    oldAssignee: data.oldAssignee,
    newAssignee: data.newAssignee,
  });
});

// ---------------- CUSTOMERS ----------------

eventBus.on(events.CUSTOMER_CREATED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.CUSTOMER_CREATED, {
    customerId: data.customerId,
  });
});

eventBus.on(events.CUSTOMER_UPDATED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.CUSTOMER_UPDATED, {
    customerId: data.customerId,
  });
});

eventBus.on(events.CUSTOMER_STATUS_CHANGED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.CUSTOMER_STATUS_CHANGED, {
    customerId: data.customerId,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
  });
});

eventBus.on(events.CUSTOMER_ASSIGNED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.CUSTOMER_ASSIGNED, {
    customerId: data.customerId,
    oldAssignee: data.oldAssignee,
    newAssignee: data.newAssignee,
  });
});

// ---------------- TASKS ----------------

eventBus.on(events.TASK_CREATED, (data) => {
  getIO()
    .to(`team:${data.teamId}`)
    .emit(events.TASK_CREATED, { taskId: data.taskId });
});

eventBus.on(events.TASK_UPDATED, (data) => {
  getIO()
    .to(`team:${data.teamId}`)
    .emit(events.TASK_UPDATED, { taskId: data.taskId });
});

eventBus.on(events.TASK_PRIORITY_CHANGED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.TASK_PRIORITY_CHANGED, {
    taskId: data.taskId,
    oldPriority: data.oldPriority,
    newPriority: data.newPriority,
  });
});

eventBus.on(events.TASK_ASSIGNED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.TASK_ASSIGNED, {
    taskId: data.taskId,
    oldAssignee: data.oldAssignee,
    newAssignee: data.newAssignee,
  });
});

eventBus.on(events.TASK_STATUS_CHANGED, (data) => {
  getIO().to(`team:${data.teamId}`).emit(events.TASK_STATUS_CHANGED, {
    taskId: data.taskId,
    oldStatus: data.oldStatus,
    newStatus: data.newStatus,
  });
});

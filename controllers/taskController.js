const Task = require("../models/Task");
const Quotation = require("../models/Quotation");
const {
  buildTaskAccessFilter,
  ensureDocumentAccess,
  validateAssignableSalesAgent,
} = require("../utils/teamScope");
const { reorderCards, moveCard } = require("../utils/kanbanPositioning");
const {
  autoAdvanceLeadToContacted,
} = require("../services/leadAutomationService");

const buildTaskAttachments = (files = []) =>
  (files || []).map((file) => ({
    name: file.originalname,
    url: `/uploads/task_attachments/${file.filename}`,
    path: file.path,
    mimeType: file.mimetype,
  }));

const normalizeExistingAttachments = (existingAttachments) => {
  if (!existingAttachments) return [];
  const attachments = Array.isArray(existingAttachments)
    ? existingAttachments
    : [existingAttachments];

  return attachments
    .filter(Boolean)
    .map((item) =>
      typeof item === "string"
        ? {
            name: item.split("/").pop(),
            url: item,
            path: item,
            mimeType: "",
          }
        : item,
    );
};

// 🌟 Helper function to parse and format array of links
const normalizeLinks = (linksInput) => {
  if (!linksInput) return [];
  let parsed = linksInput;

  // Handles JSON stringified payload sent via FormData/Multer
  if (typeof linksInput === "string") {
    try {
      parsed = JSON.parse(linksInput);
    } catch (err) {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    if (typeof parsed === "object" && parsed !== null) {
      parsed = [parsed];
    } else {
      return [];
    }
  }

  return parsed
    .filter(Boolean)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      url: typeof item.url === "string" ? item.url.trim() : "",
    }))
    .filter((item) => item.name !== "" || item.url !== "");
};

const eventBus = require("../utils/eventBus");
const events = require("../constants/events");

const VALID_PRIORITIES = ["High", "Medium", "Low"];
const VALID_STATUSES = ["Pending", "Ongoing", "Due Soon", "Completed", "Overdue"];

const POPULATE_FIELDS = [
  {
    path: "assignedTo",
    select:
      "firstName middleName lastName suffixName employeeId role profilePicture sex team",
  },
  {
    path: "createdBy",
    select:
      "firstName middleName lastName suffixName employeeId role profilePicture sex team",
  },
  {
    path: "relatedTo",
    select: "firstName middleName lastName suffixName company title name email",
  },
];

const TASK_KANBAN_CONFIG = {
  Model: Task,
  columnField: "status",
};

const populateTask = (query) => query.populate(POPULATE_FIELDS);

const fetchAllTasks = async (req) => {
  const filter = await buildTaskAccessFilter(req);

  const tasks = await Task.aggregate([
    { $match: filter },
    {
      $addFields: {
        // 🌟 Replaced single link/linkName fields with links array fallback
        links: { $ifNull: ["$links", []] },
        dueTime: { $ifNull: ["$dueTime", ""] },
        priorityOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$priority", "High"] }, then: 1 },
              { case: { $eq: ["$priority", "Medium"] }, then: 2 },
              { case: { $eq: ["$priority", "Low"] }, then: 3 },
            ],
            default: 99,
          },
        },
        statusOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "Ongoing"] }, then: 1 },
              { case: { $eq: ["$status", "Pending"] }, then: 2 },
              { case: { $eq: ["$status", "Completed"] }, then: 3 },
              { case: { $eq: ["$status", "Overdue"] }, then: 4 },
            ],
            default: 99,
          },
        },
      },
    },
    {
      $sort: {
        statusOrder: 1,
        priorityOrder: 1,
        dueDate: 1,
        createdAt: -1,
      },
    },
  ]);

  return Task.populate(tasks, POPULATE_FIELDS);
};

const getAllTasks = async (req, res) => {
  try {
    const tasks = await fetchAllTasks(req);
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get all tasks error:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

const getSingleTask = async (req, res) => {
  try {
    const task = await populateTask(Task.findById(req.params.id));

    const access = await ensureDocumentAccess(req, task, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    res.status(200).json(task);
  } catch (error) {
    console.error("Get single task error:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
};

const getQuotationTasks = async (req, res) => {
  try {
    const quotationId = req.params.id;

    const quotation = await Quotation.findById(quotationId);
    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const access = await ensureDocumentAccess(req, quotation, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const tasks = await Task.find({
      relatedToType: "Quotation",
      relatedTo: quotationId,
    })
      .populate(POPULATE_FIELDS)
      .sort({ dueDate: 1, createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get quotation tasks error:", error);
    res.status(500).json({ error: "Failed to fetch quotation tasks" });
  }
};

const createTask = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const {
      subject,
      description,
      taskType,
      priority,
      status,
      dueDate,
      dueTime,
      reminderAt,
      repeat,
      assignedTo,
      scope,
      relatedToType,
      relatedTo,
      links, // 🌟 Extracted links
    } = req.body;

    if (role === "Sales Agent" && assignedTo && assignedTo !== userId) {
      return res
        .status(403)
        .json({ error: "You can only create tasks for yourself" });
    }

    let resolvedAssignedTo = assignedTo || null;
    let resolvedScope = scope || "Personal";

    if (["Admin", "Sales Manager"].includes(role) && resolvedAssignedTo) {
      const assigneeCheck = await validateAssignableSalesAgent(
        req,
        resolvedAssignedTo
      );
      if (!assigneeCheck.ok) {
        return res
          .status(assigneeCheck.status)
          .json({ error: assigneeCheck.error });
      }
    }

    if (resolvedScope === "Personal") {
      resolvedAssignedTo = null;
    }

    const resolvedStatus =
      status === "To Do"
        ? "Pending"
        : status === "In Progress"
          ? "Ongoing"
          : status || "Pending";

    const lastTask = await Task.findOne({ status: resolvedStatus })
      .sort({ position: -1 })
      .select("position");

    const nextPosition = lastTask ? lastTask.position + 1 : 0;

    const existingAttachments = normalizeExistingAttachments(
      req.body.existingAttachments,
    );
    const newAttachments = buildTaskAttachments(req.files);

    const task = await Task.create({
      subject,
      description,
      taskType: taskType || "Others",
      priority: priority || "Medium",
      status: resolvedStatus,
      dueDate: dueDate || null,
      dueTime: dueTime || "",
      reminderAt: reminderAt || null,
      repeat: repeat || "None",
      assignedTo: resolvedAssignedTo,
      createdBy: userId,
      relatedToType: relatedToType || null,
      relatedTo: relatedTo || null,
      completedAt: resolvedStatus === "Completed" ? new Date() : null,
      position: nextPosition,
      scope: resolvedScope,
      links: normalizeLinks(links), // 🌟 Store array of formatted links
      attachments: [...existingAttachments, ...newAttachments],
    });

    eventBus.emit(events.TASK_CREATED, {
      taskId: task._id,
      status: task.status,
      userId,
      teamId: req.user.teamId,
    });

    const populated = await populateTask(Task.findById(task._id));
    res.status(201).json(populated);
  } catch (error) {
    console.error("Create task error:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ error: errors.join(", ") });
    }
    res.status(500).json({ error: "Failed to create task" });
  }
};

const updateTaskDetails = async (req, res) => {
  try {
    const { role, userId } = req.user;

    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const {
      subject,
      description,
      taskType,
      priority,
      status,
      dueDate,
      dueTime,
      reminderAt,
      repeat,
      assignedTo,
      scope,
      relatedToType,
      relatedTo,
      links, // 🌟 Extracted links
    } = req.body;

    const updateData = {
      subject,
      description,
      taskType,
      priority,
      status,
      dueDate: dueDate || null,
      dueTime: dueTime !== undefined ? dueTime : existing.dueTime,
      reminderAt: reminderAt || null,
      repeat,
      relatedToType: relatedToType || null,
      relatedTo: relatedTo || null,
    };

    // 🌟 Update links if provided in the payload
    if (links !== undefined) {
      updateData.links = normalizeLinks(links);
    }

    const existingAttachments = normalizeExistingAttachments(
      req.body.existingAttachments,
    );
    const newAttachments = buildTaskAttachments(req.files);
    if (existingAttachments.length > 0 || newAttachments.length > 0) {
      updateData.attachments = [...existingAttachments, ...newAttachments];
    } else if (req.body.attachments !== undefined) {
      updateData.attachments = existing.attachments || [];
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo || null;

      if (scope !== undefined) {
        updateData.scope = scope;
        if (scope === "Personal") updateData.assignedTo = null;
      } else {
        updateData.scope = "Assigned";
      }
    } else if (scope !== undefined) {
      updateData.scope = scope;
    }

    Object.keys(updateData).forEach((k) => {
      if (updateData[k] === undefined) delete updateData[k];
    });

    const task = await populateTask(
      Task.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      })
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    eventBus.emit(events.TASK_UPDATED, {
      taskId: req.params.id,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    res.status(200).json({ task });
  } catch (error) {
    console.error("updateTaskDetails error:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, position = 0 } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const existing = await Task.findById(id);
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const oldStatus = existing.status;

    await moveCard(TASK_KANBAN_CONFIG, id, status, position);

    const completedAt =
      status === "Completed" ? existing.completedAt || new Date() : null;

    const task = await Task.findByIdAndUpdate(
      id,
      { status, completedAt, position },
      { new: true }
    ).populate(POPULATE_FIELDS);

    if (status !== oldStatus) {
      eventBus.emit(events.TASK_STATUS_CHANGED, {
        taskId: id,
        oldStatus,
        newStatus: status,
        userId: req.user.userId,
        teamId: req.user.teamId,
      });
    }

    const updatedLead = await autoAdvanceLeadToContacted(task);

    res.status(200).json({
      task,
      leadUpdated: Boolean(updatedLead),
    });
  } catch (error) {
    console.error("updateTaskStatus error:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
};

const reorderTaskPositions = async (req, res) => {
  try {
    const { updates } = req.body;

    await reorderCards(TASK_KANBAN_CONFIG, updates);

    res.status(200).json({ message: "Tasks reordered successfully" });
  } catch (error) {
    console.error("reorderTaskPositions error:", error);
    res.status(500).json({ error: "Failed to reorder tasks" });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { role, userId } = req.user;

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    const access = await ensureDocumentAccess(req, task, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (role === "Sales Agent") {
      if (task.scope !== "Personal" || task.createdBy.toString() !== userId) {
        return res
          .status(403)
          .json({ error: "You can only delete your own personal tasks" });
      }
    }

    await Task.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
};

const assignTask = async (req, res) => {
  try {
    const { assignedTo } = req.body;

    const existing = await Task.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok && req.user.role !== "Admin") {
      return res.status(access.status).json({ error: access.error });
    }

    if (assignedTo) {
      const assigneeCheck = await validateAssignableSalesAgent(req, assignedTo);
      if (!assigneeCheck.ok) {
        return res
          .status(assigneeCheck.status)
          .json({ error: assigneeCheck.error });
      }
    }

    const resolvedAssignedTo = assignedTo || null;
    const creatorId = existing.createdBy.toString();
    const resolvedScope =
      !resolvedAssignedTo || resolvedAssignedTo === creatorId
        ? "Personal"
        : "Assigned";
    const finalAssignedTo =
      resolvedScope === "Personal" ? creatorId : resolvedAssignedTo;

    const oldAssignee = existing.assignedTo?.toString() ?? null;

    const task = await populateTask(
      Task.findByIdAndUpdate(
        req.params.id,
        { $set: { assignedTo: finalAssignedTo, scope: resolvedScope } },
        { new: true, runValidators: true }
      )
    );

    eventBus.emit(events.TASK_ASSIGNED, {
      taskId: req.params.id,
      oldAssignee,
      newAssignee: finalAssignedTo,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    const updatedLead = await autoAdvanceLeadToContacted(task);

    res.status(200).json({ task, leadUpdated: Boolean(updatedLead) });
  } catch (error) {
    console.error("Assign task error:", error);
    res.status(500).json({ error: "Failed to assign task" });
  }
};

const updateTaskPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: `Priority must be one of: ${VALID_PRIORITIES.join(", ")}`,
      });
    }

    const existing = await Task.findById(id);
    if (!existing) return res.status(404).json({ error: "Task not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const oldPriority = existing.priority;

    const task = await populateTask(
      Task.findByIdAndUpdate(
        id,
        { priority },
        { new: true, runValidators: true }
      )
    );

    eventBus.emit(events.TASK_PRIORITY_CHANGED, {
      taskId: id,
      oldPriority,
      newPriority: priority,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    res.status(200).json({ task });
  } catch (error) {
    console.error("updateTaskPriority error:", error);
    res.status(500).json({ error: "Failed to update task priority" });
  }
};

module.exports = {
  getAllTasks,
  getSingleTask,
  getQuotationTasks,
  createTask,
  updateTaskDetails,
  updateTaskStatus,
  updateTaskPriority,
  reorderTaskPositions,
  deleteTask,
  assignTask,
};

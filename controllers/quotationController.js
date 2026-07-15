const Quotation = require("../models/Quotation"); 
const Client = require("../models/clientModel");   

const {
  buildDealAccessFilter, 
  ensureDocumentAccess,
  validateAssignableSalesAgent,
} = require("../utils/teamScope");
const {
  reorderCards,
  moveCard,
  applyStatusUpdates,
} = require("../utils/kanbanPositioning");
const eventBus = require("../utils/eventBus");
const events = require("../constants/events");

const POPULATE_USER =
  "firstName middleName lastName suffixName email role employeeId profilePicture sex team";

const POPULATE_CLIENT =
  "firstName middleName lastName suffixName email company phone profilePicture sex";

const ALLOWED_STAGES = [
  "Prospecting",
  "Qualification",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

// Hanapin at palitan itong helper sa itaas:
const populateQuotation = (query) =>
  query
    .populate({ path: "client", model: "Client", select: POPULATE_CLIENT }) // 🟢 FIX: Ginawang object na may model pointer
    .populate({ path: "assignedTo", model: "User", select: POPULATE_USER })
    .populate({ path: "createdBy", model: "User", select: POPULATE_USER });

const isClosedStage = (stage) => ["Won", "Lost"].includes(stage);

const QUOTATION_KANBAN_CONFIG = {
  Model: Quotation,
  columnField: "stage",
};

const fetchAllQuotations = async (req) => {
  const filter = await buildDealAccessFilter(req);

  const quotations = await Quotation.aggregate([
    { $match: filter },
    {
      $addFields: {
        stageOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$stage", "Prospecting"] }, then: 1 },
              { case: { $eq: ["$stage", "Qualification"] }, then: 2 },
              { case: { $eq: ["$stage", "Proposal"] }, then: 3 },
              { case: { $eq: ["$stage", "Negotiation"] }, then: 4 },
              { case: { $eq: ["$stage", "Won"] }, then: 5 },
              { case: { $eq: ["$stage", "Lost"] }, then: 6 }
            ],
            default: 99
          }
        }
      }
    },
    {
      $sort: {
        stageOrder: 1, 
        value: -1,     
        expectedCloseDate: 1,
        createdAt: -1
      }
    },
    {
      $project: {
        stageOrder: 0,
        position: 0
      }
    }
  ]); // 🟢 NA-CHECK NANG MAAYOS: Isang array bracket para sa pipeline, isang parenthesis para sa .aggregate()

// Hanapin ito sa dulo ng fetchAllQuotations:
  return Quotation.populate(quotations, [
    { path: "client", model: "Client", select: POPULATE_CLIENT }, // 🟢 FIX: Idinagdag ang model: "Client"
    { path: "assignedTo", model: "User", select: POPULATE_USER },
    { path: "createdBy", model: "User", select: POPULATE_USER },
  ]);
};

const getAllQuotations = async (req, res) => {
  try {
    const quotations = await fetchAllQuotations(req);
    res.status(200).json(quotations);
  } catch (error) {
    console.error("Get all quotations error:", error);
    res.status(500).json({ error: "Failed to fetch quotations" });
  }
};

const getSingleQuotation = async (req, res) => {
  try {
    const quotation = await populateQuotation(Quotation.findById(req.params.id));
    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    // 🟢 OPTION C BYPASS: Kung hindi Admin o Manager, doon lang i-enforce ang document restriction
    if (!["Admin", "Sales Manager"].includes(req.user.role)) {
      const access = await ensureDocumentAccess(req, quotation, [
        (doc) => doc?.assignedTo,
        (doc) => doc?.createdBy,
      ]);

      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }
    }

    res.status(200).json(quotation);
  } catch (error) {
    console.error("Get single quotation error:", error);
    res.status(500).json({ error: "Failed to fetch quotation" });
  }
};

const createQuotation = async (req, res) => {
  try {
    const { role, userId } = req.user;
    const {
      title,
      client: clientId, 
      value,
      currency,
      probability,
      stage,
      expectedCloseDate,
      notes,
      assignedTo,
    } = req.body;

    if (!title || !clientId || value === undefined) {
      return res
        .status(400)
        .json({ error: "title, client, and value are required" });
    }

    if (stage && !ALLOWED_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid quotation stage" });
    }

    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    // 🟢 OPTION C BYPASS: Malaya ang Admin/Manager na gamitin kahit kaninong Client ID rito
    // if (!["Admin", "Sales Manager"].includes(role)) {
    //   const clientAccess = await ensureDocumentAccess(req, client, [
    //     (doc) => doc?.assignedTo,
    //     (doc) => doc?.createdBy,
    //   ]);

    //   if (!clientAccess.ok) {
    //     return res
    //       .status(clientAccess.status)
    //       .json({ error: clientAccess.error });
    //   }
    // }

    let resolvedAssignedTo;

    if (role === "Sales Agent") {
      resolvedAssignedTo = userId;
    } else {
      resolvedAssignedTo = assignedTo || null; 
      
      if (resolvedAssignedTo) {
        const assigneeCheck = await validateAssignableSalesAgent(
          req,
          resolvedAssignedTo,
        );
        if (!assigneeCheck.ok) {
          return res
            .status(assigneeCheck.status)
            .json({ error: assigneeCheck.error });
        }
      }
    }

    const resolvedStage = stage || "Prospecting";

    const lastQuotation = await Quotation.findOne({ stage: resolvedStage })
      .sort({ position: -1 })
      .select("position");

    const nextPosition = lastQuotation ? lastQuotation.position + 1 : 0;

    const quotation = await Quotation.create({
      title,
      client: clientId, 
      value,
      currency: currency || "PHP",
      probability: probability ?? 0,
      stage: resolvedStage,
      expectedCloseDate: expectedCloseDate || null,
      closedAt: isClosedStage(resolvedStage) ? new Date() : null,
      notes,
      assignedTo: resolvedAssignedTo,
      createdBy: userId,
      position: nextPosition,
    });

    eventBus.emit(events.QUOTATION_CREATED, {
      quotationId: quotation._id,
      stage: quotation.stage,
      userId,
      teamId: req.user.teamId,
    });

    if (resolvedAssignedTo) {
      eventBus.emit(events.QUOTATION_ASSIGNED, {
        quotationId: quotation._id,
        oldAssignee: null,
        newAssignee: resolvedAssignedTo,
        userId,
        teamId: req.user.teamId,
      });
    }

    const populatedQuotation = await populateQuotation(Quotation.findById(quotation._id));

    res
      .status(201)
      .json({ message: "Quotation created successfully", quotation: populatedQuotation });
} catch (error) {
    console.error("Create quotation error:", error);
    // 🟢 DITO ILALAGAY: Para iluwa ng Postman kung ano mismo ang sumasabog sa DB o EventBus
    res.status(500).json({ 
      error: "Failed to create quotation", 
      details: error.message 
    });
  }
};

const updateQuotationDetails = async (req, res) => {
  try {
    const { role, userId } = req.user;

    const existing = await Quotation.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    // 🟢 OPTION C BYPASS: Pinapayagan ang Admin/Manager na mag-edit kahit hindi nila hawak ang deal
    if (!["Admin", "Sales Manager"].includes(role)) {
      const access = await ensureDocumentAccess(req, existing, [
        (doc) => doc?.assignedTo,
        (doc) => doc?.createdBy,
      ]);

      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }
    }

    const {
      title,
      value,
      currency,
      probability,
      stage,
      expectedCloseDate,
      notes,
      assignedTo,
    } = req.body;

    if (stage !== undefined && !ALLOWED_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid quotation stage" });
    }

    const previousAssignee = existing.assignedTo?.toString() ?? null;
    const nextStage = stage ?? existing.stage;
    
    const updateData = {
      title,
      value,
      currency,
      probability,
      stage,
      expectedCloseDate,
      notes,
      closedAt: isClosedStage(nextStage)
        ? existing.closedAt || new Date()
        : null,
    };

    let assigneeChanged = false;
    let newAssignee = null;

    if (["Admin", "Sales Manager"].includes(role) && assignedTo !== undefined) {
      newAssignee = assignedTo || null;
      if (newAssignee) {
        const assigneeCheck = await validateAssignableSalesAgent(
          req,
          newAssignee,
        );
        if (!assigneeCheck.ok) {
          return res
            .status(assigneeCheck.status)
            .json({ error: assigneeCheck.error });
        }
      }
      assigneeChanged = newAssignee !== previousAssignee;
      updateData.assignedTo = newAssignee;
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const updated = await populateQuotation(
      Quotation.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true,
      }),
    );

    eventBus.emit(events.QUOTATION_UPDATED, {
      quotationId: req.params.id,
      userId,
      teamId: req.user.teamId,
    });

    if (assigneeChanged) {
      eventBus.emit(events.QUOTATION_ASSIGNED, {
        quotationId: req.params.id,
        oldAssignee: previousAssignee,
        newAssignee,
        userId,
        teamId: req.user.teamId,
      });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error("Update quotation error:", error);
    res.status(500).json({ error: "Failed to update quotation" });
  }
};

const updateQuotationStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, position, updates } = req.body;
    const { role, userId } = req.user;

    if (!stage || !ALLOWED_STAGES.includes(stage)) {
      return res.status(400).json({
        error: `Stage must be one of: ${ALLOWED_STAGES.join(", ")}`,
      });
    }

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    // 🟢 OPTION C BYPASS: Drag and drop bypass para sa Kanban board kapag Admin/Manager
    if (!["Admin", "Sales Manager"].includes(role)) {
      const access = await ensureDocumentAccess(req, quotation, [
        (doc) => doc?.assignedTo,
        (doc) => doc?.createdBy,
      ]);

      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      if (role === "Sales Agent" && quotation.assignedTo?.toString() !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const oldStage = quotation.stage;

    if (Array.isArray(updates) && updates.length > 0) {
      const enriched = updates.map((u) => ({
        ...u,
        closedAt: isClosedStage(u.stage) ? new Date() : null,
      }));
      await applyStatusUpdates(QUOTATION_KANBAN_CONFIG, enriched);
    } else {
      await moveCard(QUOTATION_KANBAN_CONFIG, id, stage, position);
      const closedAt = isClosedStage(stage)
        ? quotation.closedAt || new Date()
        : null;
      await Quotation.findByIdAndUpdate(id, { $set: { closedAt } });
    }

    if (stage !== oldStage) {
      eventBus.emit(events.QUOTATION_STAGE_CHANGED, {
        quotationId: id,
        oldStage,
        newStage: stage,
        userId,
        teamId: req.user.teamId,
      });
    }

    const updatedQuotation = await populateQuotation(Quotation.findById(id));
    res.status(200).json({ quotation: updatedQuotation });
  } catch (error) {
    console.error("Update quotation stage error:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to update quotation stage" });
  }
};

const reorderQuotationPositions = async (req, res) => {
  try {
    const { updates } = req.body;
    const { role, userId } = req.user;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res
        .status(400)
        .json({ error: "updates must be a non-empty array" });
    }

    const invalid = updates.find(
      (u) => !u?._id || typeof u.position !== "number" || u.position < 0,
    );
    if (invalid) {
      return res
        .status(400)
        .json({ error: "Each update must include _id and valid position" });
    }

    const ids = updates.map((u) => u._id.toString());
    if (ids.length !== new Set(ids).size) {
      return res
        .status(400)
        .json({ error: "Duplicate quotation IDs are not allowed" });
    }

    const quotations = await Quotation.find({ _id: { $in: ids } }).select(
      "_id stage position assignedTo createdBy",
    );

    if (quotations.length !== ids.length) {
      return res.status(404).json({ error: "Some quotations not found" });
    }

    const quotationMap = new Map(quotations.map((d) => [d._id.toString(), d]));

    // 🟢 OPTION C BYPASS: Laktawan ang loop access restrictions kapag Admin o Manager
    if (!["Admin", "Sales Manager"].includes(role)) {
      for (const update of updates) {
        const quotation = quotationMap.get(update._id.toString());
        const access = await ensureDocumentAccess(req, quotation, [
          (doc) => doc?.assignedTo,
          (doc) => doc?.createdBy,
        ]);
        if (!access.ok) {
          return res.status(access.status).json({ error: access.error });
        }
        if (role === "Sales Agent" && quotation.assignedTo?.toString() !== userId) {
          return res
            .status(403)
            .json({ error: "You can only reorder your assigned quotations" });
        }
      }
    }

    await reorderCards(QUOTATION_KANBAN_CONFIG, updates);

    res.status(200).json({ message: "Quotations reordered successfully" });
  } catch (error) {
    console.error("Reorder quotations error:", error);
    res.status(500).json({ error: "Failed to reorder quotations" });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ error: "Quotation not found" });
    }

    const access = await ensureDocumentAccess(req, quotation, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok && req.user.role !== "Admin") {
      return res.status(access.status).json({ error: access.error });
    }

    await Quotation.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Delete quotation error:", error);
    res.status(500).json({ error: "Failed to delete quotation" });
  }
};

module.exports = {
  getAllQuotations,
  getSingleQuotation,
  createQuotation,
  updateQuotationDetails,
  updateQuotationStage,
  reorderQuotationPositions,
  deleteQuotation,
};
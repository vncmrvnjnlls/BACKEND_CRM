const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const User = require("../models/User");
const Customer = require("../models/clientModel");
const {
  buildLeadAccessFilter,
  ensureDocumentAccess,
  validateAssignableSalesAgent,
} = require("../utils/teamScope");
const {
  reorderCards,
  moveCard,
  applyStatusUpdates,
} = require("../utils/kanbanPositioning");
const { LEAD_DEFAULT_SORT } = require("../constants/sortOptions");
const eventBus = require("../utils/eventBus");
const events = require("../constants/events");

const POPULATE_FIELDS =
  "firstName middleName lastName suffixName email role employeeId profilePicture sex team";

const POPULATE_ALL = "leadOwner leadAssignee convertedBy";

const ALLOWED_STATUSES = ["New", "Contacted", "Qualified", "Converted", "Lost"];
const STAGE_ORDER = ["New", "Contacted", "Qualified"];

const LEAD_KANBAN_CONFIG = {
  Model: Lead,
  columnField: "status",
};

/**
 * Validates phone number format (supports Philippine and international formats)
 * @param {string} phone - Phone number to validate
 * @returns {string|null} Error message if invalid, null if valid
 */
const validatePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  const isValid = /^(\+63|0)9\d{9}$|^\+?\d{10,15}$/.test(cleaned);
  return isValid ? null : "Enter a valid contact number (e.g. 09171234567 or +639171234567)";
};

/**
 * Fetches all leads accessible to the current user
 * Applies access control filters based on user role
 * Plus advanced query filters for side panel and global search (Zoho Style)
 * Sorts leads by status order and creation date
 * @async
 * @param {Object} req - Express request object with authenticated user
 * @returns {Promise<Array>} Array of lead documents with populated user references
 */
const fetchAllLeads = async (req) => {
  const baseFilter = await buildLeadAccessFilter(req);

  const { search, leadSource, status, municipality, province, country, leadAssignee } = req.query;
  
  let filter = { ...baseFilter };

  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: "i" } },
      { lastName: { $regex: search, $options: "i" } },
      { company: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  if (leadSource) {
    filter.leadSource = leadSource;
  }
  if (status) {
    filter.status = status;
  }
  if (leadAssignee) {
    filter.leadAssignee = new mongoose.Types.ObjectId(leadAssignee);
  }

  if (municipality) {
    filter["address.municipality"] = { $regex: municipality, $options: "i" };
  }
  if (province) {
    filter["address.province"] = { $regex: province, $options: "i" };
  }
  if (country) {
    filter["address.country"] = { $regex: country, $options: "i" };
  }

  const leads = await Lead.aggregate([
    { $match: filter },
    {
      $addFields: {
        statusOrder: {
          $switch: {
            branches: [
              { case: { $eq: ["$status", "New"] }, then: 1 },
              { case: { $eq: ["$status", "Contacted"] }, then: 2 },
              { case: { $eq: ["$status", "Qualified"] }, then: 3 },
              { case: { $eq: ["$status", "Lost"] }, then: 4 },
              { case: { $eq: ["$status", "Converted"] }, then: 5 },
            ],
            default: 99,
          },
        },
      },
    },
    {
      $sort: {
        statusOrder: 1,
        position: 1,
        assignedAt: -1,
        createdAt: -1,
      },
    },
  ]);

  return Lead.populate(leads, POPULATE_ALL, POPULATE_FIELDS);
};

/**
 * Retrieves all leads accessible to the current user
 */
const getAllLeads = async (req, res) => {
  try {
    const leads = await fetchAllLeads(req);
    res.status(200).json(leads);
  } catch (error) {
    console.error("Get all leads error:", error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Retrieves a single lead by ID
 */
const getSingleLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate(
      POPULATE_ALL,
      POPULATE_FIELDS,
    );

    const access = await ensureDocumentAccess(req, lead, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    res.status(200).json(lead);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Creates a new lead supporting both Lead and Prospect payloads
 */
const createLead = async (req, res) => {
  try {
    const role = req.user.role;
    const userId = req.user.userId;

    const representative = req.body.representativeName || {};

    const firstName = req.body.firstName ?? representative.firstName ?? "";
    const middleName = req.body.middleName ?? representative.middleInitial ?? representative.middleName ?? "";
    const lastName = req.body.lastName ?? representative.lastName ?? "";
    const suffixName = req.body.suffixName || representative.suffixName || "";

    const company = req.body.company || req.body.companyName || "";
    const industry = req.body.industry || req.body.natureOfBusiness || "";
    const email = req.body.email || req.body.companyEmailAddress || req.body.emailAddress || "";
    const ownerName = req.body.ownerName || null;

    const phone = req.body.phone || "";
    const dateOfBirth = req.body.dateOfBirth || representative.birthday || req.body.birthday || null;
    const leadSource = req.body.leadSource || "Website";
    const status = req.body.status || "New";
    const sex = req.body.sex || representative.gender || req.body.gender || "";
    const notes = req.body.notes || "";

    const address = req.body.address || {
      houseNumber: req.body["address.houseNumber"] || req.body.houseNumber || "",
      street: req.body["address.street"] || req.body.street || "",
      barangay: req.body["address.barangay"] || req.body.barangay || "",
      municipality: req.body["address.municipality"] || req.body.city || req.body.municipality || "",
      province: req.body["address.province"] || req.body.province || "",
      zipCode: req.body["address.zipCode"] || req.body.zipCode || "",
      country: req.body["address.country"] || req.body.country || "Philippines",
    };

    if (!firstName || !lastName || !phone) {
      return res
        .status(400)
        .json({ error: "First name, last name, and phone are required" });
    }

    if (email) {
      const emailExists = await Lead.findOne({ email });
      if (emailExists) {
        return res
          .status(400)
          .json({ error: "Lead with this email already exists" });
      }
    }

    const profilePicture = req.file
      ? `/uploads/profile_pictures/${req.file.filename}`
      : null;

    let leadOwner;
    let leadAssignee;
    let assignedAt = null;

    if (role === "Sales Agent") {
      leadOwner = userId;
      leadAssignee = userId;
      assignedAt = new Date();
    } else {
      leadOwner = userId;

      if (req.body.leadAssignee) {
        const assigneeCheck = await validateAssignableSalesAgent(
          req,
          req.body.leadAssignee,
        );
        if (!assigneeCheck.ok) {
          return res
            .status(assigneeCheck.status)
            .json({ error: assigneeCheck.error });
        }
        leadAssignee = req.body.leadAssignee;
        assignedAt = new Date();
      } else {
        leadAssignee = null;
      }
    }

    const resolvedStatus = status || "New";

    const lastLead = await Lead.findOne({ status: resolvedStatus })
      .sort({ position: -1 })
      .select("position");

    const nextPosition = lastLead ? lastLead.position + 1 : 0;

    const lead = await Lead.create({
      leadOwner,
      leadAssignee,
      assignedAt,
      firstName,
      middleName,
      lastName,
      suffixName,
      email,
      phone,
      profilePicture,
      dateOfBirth,
      company,
      ownerName,
      leadSource,
      status: resolvedStatus,
      industry,
      sex,
      notes,
      address,
      position: nextPosition,
    });

    eventBus.emit(events.LEAD_CREATED, {
      leadId: lead._id,
      status: lead.status,
      userId,
      teamId: req.user.teamId,
    });

    if (leadAssignee) {
      eventBus.emit(events.LEAD_ASSIGNED, {
        leadId: lead._id,
        oldAssignee: null,
        newAssignee: leadAssignee,
        userId,
        teamId: req.user.teamId,
      });
    }

    const populatedLead = await Lead.findById(lead._id).populate(
      POPULATE_ALL,
      POPULATE_FIELDS,
    );

    res
      .status(201)
      .json({ message: "Lead created successfully", lead: populatedLead });
  } catch (error) {
    console.error("Create lead error:", error);
    res.status(500).json({ error: error.message });
  }
};

const updateLeadDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Lead.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (existing.convertedToCustomer) {
      return res
        .status(400)
        .json({ error: "Converted leads cannot be edited" });
    }

    const previousAssignee = existing.leadAssignee?.toString() ?? null;
    const representative = req.body.representativeName || {};

    const updateData = {
      firstName: req.body.firstName ?? representative.firstName,
      middleName: req.body.middleName ?? representative.middleInitial ?? representative.middleName,
      lastName: req.body.lastName ?? representative.lastName,
      suffixName: req.body.suffixName || representative.suffixName,
      email: req.body.email || req.body.companyEmailAddress || req.body.emailAddress,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth || representative.birthday || req.body.birthday,
      company: req.body.company || req.body.companyName,
      ownerName: req.body.ownerName,
      leadSource: req.body.leadSource,
      status: req.body.status,
      industry: req.body.industry || req.body.natureOfBusiness,
      sex: req.body.sex || representative.gender || req.body.gender,
      notes: req.body.notes,
      address: req.body.address || {
        houseNumber: req.body["address.houseNumber"] || req.body.houseNumber,
        street: req.body["address.street"] || req.body.street,
        barangay: req.body["address.barangay"] || req.body.barangay,
        municipality: req.body["address.municipality"] || req.body.city || req.body.municipality,
        province: req.body["address.province"] || req.body.province,
        zipCode: req.body["address.zipCode"] || req.body.zipCode,
        country: req.body["address.country"] || req.body.country,
      },
    };

    let assigneeChanged = false;
    let newAssignee = null;

    if (
      req.body.leadAssignee !== undefined &&
      ["Admin", "Sales Manager"].includes(req.user.role)
    ) {
      newAssignee = req.body.leadAssignee || null;

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

      const isNewAssignment = newAssignee && newAssignee !== previousAssignee;
      assigneeChanged = newAssignee !== previousAssignee;

      updateData.leadAssignee = newAssignee;
      updateData.assignedAt = isNewAssignment
        ? new Date()
        : newAssignee
          ? existing.assignedAt
          : null;
    }

    if (req.file) {
      updateData.profilePicture = `/uploads/profile_pictures/${req.file.filename}`;
    }
    if (req.body.removeProfilePicture === "true") {
      updateData.profilePicture = null;
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const lead = await Lead.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate(POPULATE_ALL, POPULATE_FIELDS);

    eventBus.emit(events.LEAD_UPDATED, {
      leadId: id,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    if (assigneeChanged) {
      eventBus.emit(events.LEAD_ASSIGNED, {
        leadId: id,
        oldAssignee: previousAssignee,
        newAssignee: newAssignee,
        userId: req.user.userId,
        teamId: req.user.teamId,
      });
    }

    res.status(200).json(lead);
  } catch (error) {
    console.error("Update lead error:", error);
    res.status(400).json({ error: error.message });
  }
};

const updateOwnLeadDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    if (lead.leadAssignee?.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (lead.convertedToCustomer) {
      return res.status(400).json({ error: "Cannot edit a converted lead" });
    }

    const representative = req.body.representativeName || {};

    const updateData = {
      firstName: req.body.firstName ?? representative.firstName,
      middleName: req.body.middleName ?? representative.middleInitial ?? representative.middleName,
      lastName: req.body.lastName ?? representative.lastName,
      suffixName: req.body.suffixName || representative.suffixName,
      email: req.body.email || req.body.companyEmailAddress || req.body.emailAddress,
      phone: req.body.phone,
      dateOfBirth: req.body.dateOfBirth || representative.birthday || req.body.birthday,
      company: req.body.company || req.body.companyName,
      ownerName: req.body.ownerName,
      leadSource: req.body.leadSource,
      industry: req.body.industry || req.body.natureOfBusiness,
      sex: req.body.sex || representative.gender || req.body.gender,
      notes: req.body.notes,
      address: req.body.address || {
        houseNumber: req.body["address.houseNumber"] || req.body.houseNumber,
        street: req.body["address.street"] || req.body.street,
        barangay: req.body["address.barangay"] || req.body.barangay,
        municipality: req.body["address.municipality"] || req.body.city || req.body.municipality,
        province: req.body["address.province"] || req.body.province,
        zipCode: req.body["address.zipCode"] || req.body.zipCode,
        country: req.body["address.country"] || req.body.country,
      },
    };

    if (req.file) {
      updateData.profilePicture = `/uploads/profile_pictures/${req.file.filename}`;
    }
    if (req.body.removeProfilePicture === "true") {
      updateData.profilePicture = null;
    }

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) delete updateData[key];
    });

    const updated = await Lead.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).populate(POPULATE_ALL, POPULATE_FIELDS);

    eventBus.emit(events.LEAD_UPDATED, {
      leadId: id,
      userId,
      teamId: req.user.teamId,
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error("Update own lead error:", error);
    res.status(400).json({ error: error.message });
  }
};

const updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, position, updates } = req.body;
    const role = req.user.role;
    const userId = req.user.userId;

    if (!updates && (!status || !ALLOWED_STATUSES.includes(status))) {
      return res.status(400).json({
        error: `Status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await ensureDocumentAccess(req, lead, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (lead.convertedToCustomer) {
      return res
        .status(400)
        .json({ error: "Cannot update status of a converted lead" });
    }

    if (role === "Sales Agent" && lead.leadAssignee?.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (status === "Converted") {
      return res.status(400).json({
        error:
          "Lead cannot be manually moved to Converted. Use the conversion process instead.",
      });
    }

    const oldStatus = lead.status;

    if (oldStatus === "Lost") {
      return res
        .status(400)
        .json({ error: "Lost leads are final and can no longer be moved." });
    }

    if (status !== "Lost" && oldStatus !== status) {
      const currentIndex = STAGE_ORDER.indexOf(oldStatus);
      const nextIndex = STAGE_ORDER.indexOf(status);

      if (currentIndex === -1 || nextIndex === -1) {
        return res.status(400).json({ error: "Invalid lead stage transition" });
      }

      if (nextIndex - currentIndex > 1) {
        return res.status(400).json({
          error: `Cannot skip stages. Move from ${oldStatus} to ${STAGE_ORDER[currentIndex + 1]} first.`,
        });
      }
    }

    if (Array.isArray(updates) && updates.length > 0) {
      await applyStatusUpdates(LEAD_KANBAN_CONFIG, updates);
    } else {
      await moveCard(LEAD_KANBAN_CONFIG, id, status, position);
    }

    if (status && status !== oldStatus) {
      eventBus.emit(events.LEAD_STATUS_CHANGED, {
        leadId: id,
        oldStatus,
        newStatus: status,
        userId,
        teamId: req.user.teamId,
      });
    }

    const updatedLead = await Lead.findById(id).populate(
      POPULATE_ALL,
      POPULATE_FIELDS,
    );

    res.status(200).json({ lead: updatedLead });
  } catch (error) {
    console.error("Update lead status error:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Failed to update lead status" });
  }
};

const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const access = await ensureDocumentAccess(req, lead, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok && req.user.role !== "Admin") {
      return res.status(access.status).json({ error: access.error });
    }

    await Lead.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Lead deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { leadAssignee } = req.body;
    const userId = req.user.userId;

    const existing = await Lead.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok && req.user.role !== "Admin") {
      return res.status(access.status).json({ error: access.error });
    }

    const oldAssignee = existing.leadAssignee?.toString() ?? null;

    const isClear =
      leadAssignee === null ||
      leadAssignee === undefined ||
      leadAssignee === "" ||
      (typeof leadAssignee === "string" && leadAssignee.trim() === "");

    if (isClear) {
      const lead = await Lead.findOneAndUpdate(
        { _id: id, convertedToCustomer: false },
        { leadAssignee: null, assignedAt: null },
        { new: true, runValidators: true },
      ).populate(POPULATE_ALL, POPULATE_FIELDS);

      if (!lead) {
        return res
          .status(400)
          .json({ error: "Lead not found or already converted" });
      }

      eventBus.emit(events.LEAD_ASSIGNED, {
        leadId: id,
        oldAssignee,
        newAssignee: null,
        userId,
        teamId: req.user.teamId,
      });

      return res.status(200).json({ message: "Lead assignment cleared", lead });
    }

    const assigneeCheck = await validateAssignableSalesAgent(req, leadAssignee);
    if (!assigneeCheck.ok) {
      return res
        .status(assigneeCheck.status)
        .json({ error: assigneeCheck.error });
    }

    const lead = await Lead.findOneAndUpdate(
      { _id: id, convertedToCustomer: false },
      { leadAssignee, assignedAt: new Date() },
      { new: true, runValidators: true },
    ).populate(POPULATE_ALL, POPULATE_FIELDS);

    if (!lead) {
      return res
        .status(400)
        .json({ error: "Lead not found or already converted" });
    }

    eventBus.emit(events.LEAD_ASSIGNED, {
      leadId: id,
      oldAssignee,
      newAssignee: leadAssignee,
      userId,
      teamId: req.user.teamId,
    });

    res.status(200).json({ message: "Lead assigned successfully", lead });
  } catch (error) {
    console.error("Assign lead error:", error);
    res.status(500).json({ error: error.message });
  }
};

const convertLeadToCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.user.role;
    const userId = req.user.userId;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });

    const access = await ensureDocumentAccess(req, lead, [
      (doc) => doc?.leadAssignee,
      (doc) => doc?.leadOwner,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    if (lead.status !== "Qualified") {
      return res
        .status(400)
        .json({ error: "Only qualified leads can convert to customer" });
    }

    if (lead.convertedToCustomer) {
      return res
        .status(400)
        .json({ error: "This lead has already been converted" });
    }

    if (role === "Sales Agent" && lead.leadAssignee?.toString() !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const assigneeId = lead.leadAssignee
      ? (lead.leadAssignee._id ?? lead.leadAssignee)
      : null;

    const existingCustomer = await Customer.findOne({
      createdFromLead: lead._id,
    });
    if (existingCustomer) {
      return res
        .status(400)
        .json({ error: "Customer already exists for this lead" });
    }

    await Customer.create({
      createdFromLead: lead._id,
      firstName: lead.firstName,
      middleName: lead.middleName,
      lastName: lead.lastName,
      suffixName: lead.suffixName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      industry: lead.industry,
      sex: lead.sex,
      address: lead.address,
      dateOfBirth: lead.dateOfBirth,
      profilePicture: lead.profilePicture,
      notes: lead.notes,
      assignedTo: assigneeId || userId,
      createdBy: userId,
    });

    lead.convertedToCustomer = true;
    lead.status = "Converted";
    lead.convertedAt = new Date();
    lead.convertedBy = userId;
    await lead.save();

    eventBus.emit(events.LEAD_CONVERTED, {
      leadId: lead._id,
      userId,
      teamId: req.user.teamId,
    });

    const populated = await Lead.findById(lead._id).populate(
      POPULATE_ALL,
      POPULATE_FIELDS,
    );

    res.status(200).json({
      message: "Lead converted to customer successfully",
      lead: populated,
    });
  } catch (error) {
    console.error("Convert lead error:", error);
    res.status(500).json({ error: error.message });
  }
};

const reorderLeadPositions = async (req, res) => {
  try {
    const { updates } = req.body;
    const { role, userId } = req.user;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res
        .status(400)
        .json({ error: "updates must be a non-empty array" });
    }

    const invalidPayload = updates.find(
      (u) =>
        !u?._id ||
        typeof u.position !== "number" ||
        !Number.isFinite(u.position) ||
        u.position < 0,
    );

    if (invalidPayload) {
      return res.status(400).json({
        error:
          "Each update must include _id and a non-negative numeric position",
      });
    }

    const ids = updates.map((u) => u._id.toString());
    if (ids.length !== new Set(ids).size) {
      return res
        .status(400)
        .json({ error: "Duplicate lead IDs are not allowed" });
    }

    const leads = await Lead.find({ _id: { $in: ids } }).select(
      "_id status convertedToCustomer leadAssignee leadOwner",
    );

    if (leads.length !== ids.length) {
      return res
        .status(404)
        .json({ error: "One or more leads were not found" });
    }

    const leadMap = new Map(leads.map((l) => [l._id.toString(), l]));

    for (const update of updates) {
      const currentLead = leadMap.get(update._id.toString());
      const access = await ensureDocumentAccess(req, currentLead, [
        (doc) => doc?.leadAssignee,
        (doc) => doc?.leadOwner,
      ]);

      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      if (
        role === "Sales Agent" &&
        currentLead.leadAssignee?.toString() !== userId &&
        currentLead.leadOwner?.toString() !== userId
      ) {
        return res.status(403).json({
          error: "Sales Agent can only reorder assigned or owned leads",
        });
      }
    }

    await reorderCards(LEAD_KANBAN_CONFIG, updates);

    res.status(200).json({ message: "Leads reordered successfully" });
  } catch (error) {
    console.error("Reorder leads error:", error);
    res.status(500).json({ error: "Failed to reorder leads" });
  }
};

module.exports = {
  getAllLeads,
  getSingleLead,
  createLead,
  updateLeadDetails,
  updateOwnLeadDetails,
  updateLeadStatus,
  deleteLead,
  assignLead,
  convertLeadToCustomer,
  reorderLeadPositions,
};
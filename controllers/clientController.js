const Client = require("../models/clientModel"); // In-update mula sa Customer
const User = require("../models/User");
const {
  buildCustomerAccessFilter, // Nananatili ang pangalan mula sa utils/teamScope
  ensureDocumentAccess,
  validateAssignableSalesAgent,
} = require("../utils/teamScope");
const { CUSTOMER_DEFAULT_SORT } = require("../constants/sortOptions");
const eventBus = require("../utils/eventBus");
const events = require("../constants/events");

const POPULATE_FIELDS =
  "firstName middleName lastName suffixName email role employeeId profilePicture sex team";

const validatePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  const isValid = /^(\+63|0)9\d{9}$|^\+?\d{10,15}$/.test(cleaned);
  return isValid ? null : "Enter a valid contact number (e.g. 09171234567 or +639171234567)";
};

const populateClient = (query) =>
  query
    .populate("assignedTo", POPULATE_FIELDS)
    .populate("createdBy", POPULATE_FIELDS)
    .populate({
      path: "createdFromLead",
      select:
        "firstName middleName lastName suffixName email company status phone",
    });

// 1. Kuhanin ang lahat ng Clients na may priority aggregation sorting
const getAllClients = async (req, res) => {
  try {
    const filter = await buildCustomerAccessFilter(req);

    const clients = await Client.aggregate([
      {
        $match: filter,
      },
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Active"] }, then: 1 },
                { case: { $eq: ["$status", "Inactive"] }, then: 2 },
                { case: { $eq: ["$status", "Lost"] }, then: 3 },
              ],
              default: 99,
            },
          },
          followUpPriority: {
            $cond: [
              {
                $and: [
                  { $ne: ["$nextFollowUpAt", null] },
                  { $lte: ["$nextFollowUpAt", new Date()] },
                ],
              },
              1,
              2,
            ],
          },
        },
      },
      {
        $sort: {
          statusOrder: 1,
          followUpPriority: 1,
          nextFollowUpAt: 1,
          lifetimeValue: -1,
          lastContactedAt: -1,
          createdAt: -1,
        },
      },
      {
        $project: {
          statusOrder: 0,
          followUpPriority: 0,
        },
      },
    ]);

    const populatedClients = await Client.populate(clients, [
      {
        path: "assignedTo",
        select: POPULATE_FIELDS,
      },
      {
        path: "createdBy",
        select: POPULATE_FIELDS,
      },
      {
        path: "createdFromLead",
        select:
          "firstName middleName lastName suffixName email company status phone",
      },
    ]);

    res.status(200).json(populatedClients);
  } catch (error) {
    console.error("Get all clients error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Kuhanin ang isang Client gamit ang ID
const getSingleClient = async (req, res) => {
  try {
    const client = await populateClient(Client.findById(req.params.id));

    const access = await ensureDocumentAccess(req, client, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Gumawa ng Bagong Client
const createClient = async (req, res) => {
  try {
    const {
      firstName,
      middleName,
      lastName,
      suffixName,
      email,
      phone,
      dateOfBirth,
      company,
      companyAddress,
      leadSource,
      status,
      industry,
      sex,
      notes,
      assignedTo,
      customerType,
      tags,
      lastContactedAt,
      nextFollowUpAt,
    } = req.body;

    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        error: "First name, last name, and phone are required",
      });
    }
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      return res.status(400).json({ error: phoneErr });
    }
    const cleanedPhone = phone.replace(/[\s\-().]/g, "");

    if (email) {
      const emailExists = await Client.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          error: "Client with this email already exists",
        });
      }
    }

    if (assignedTo) {
      const assigneeCheck = await validateAssignableSalesAgent(req, assignedTo);
      if (!assigneeCheck.ok) {
        return res
          .status(assigneeCheck.status)
          .json({ error: assigneeCheck.error });
      }
    }

    const address = {
      houseNumber: req.body["address.houseNumber"] || req.body.address?.houseNumber,
      street: req.body["address.street"] || req.body.address?.street,
      barangay: req.body["address.barangay"] || req.body.address?.barangay,
      municipality: req.body["address.municipality"] || req.body.address?.municipality,
      province: req.body["address.province"] || req.body.address?.province,
      zipCode: req.body["address.zipCode"] || req.body.address?.zipCode,
      country: req.body["address.country"] || req.body.address?.country,
    };

    const profilePicture = req.file
      ? `/uploads/profile_pictures/${req.file.filename}`
      : null;

    const client = await Client.create({
      firstName,
      middleName,
      lastName,
      suffixName,
      email,
      phone: cleanedPhone,
      profilePicture,
      dateOfBirth: dateOfBirth || null,
      company,
      companyAddress,
      leadSource,
      status,
      industry,
      sex,
      notes,
      assignedTo: assignedTo || null,
      createdBy: req.user.userId,
      customerType: customerType || "Individual",
      tags: tags
        ? Array.isArray(tags)
          ? tags
          : tags.split(",").map((t) => t.trim())
        : [],
      lastContactedAt: lastContactedAt || null,
      nextFollowUpAt: nextFollowUpAt || null,
      address,
    });

    // Event Bus Emits - Pinalitan ng CLIENT constants kung mayroon na, o gumagamit ng fallback string
    eventBus.emit(events.CLIENT_CREATED || "clientCreated", {
      clientId: client._id,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    if (client.assignedTo) {
      eventBus.emit(events.CLIENT_ASSIGNED || "clientAssigned", {
        clientId: client._id,
        oldAssignee: null,
        newAssignee: client.assignedTo?.toString(),
        userId: req.user.userId,
        teamId: req.user.teamId,
      });
    }

    const populated = await populateClient(Client.findById(client._id));

    res.status(201).json({
      message: "Client created successfully",
      client: populated,
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res
        .status(400)
        .json({ error: "Client with this email already exists" });
    }
    console.error("Create client error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 4. I-update ang Impormasyon ng Client
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Client.findById(id);
    if (!existing) {
      return res.status(404).json({ error: "Client not found" });
    }

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    const phoneErr = validatePhone(req.body.phone);
    if (phoneErr) {
      return res.status(400).json({ error: phoneErr });
    }

    if (req.body.assignedTo) {
      const assigneeCheck = await validateAssignableSalesAgent(req, req.body.assignedTo);
      if (!assigneeCheck.ok) {
        return res
          .status(assigneeCheck.status)
          .json({ error: assigneeCheck.error });
      }
    }

    const previousAssignee = existing.assignedTo?.toString() ?? null;
    const incomingAssignee = req.body.assignedTo || null;
    const assigneeChanged = incomingAssignee !== previousAssignee;

    const updateData = {
      firstName: req.body.firstName,
      middleName: req.body.middleName,
      lastName: req.body.lastName,
      suffixName: req.body.suffixName,
      email: req.body.email,
      phone: req.body.phone?.replace(/[\s\-().]/g, ""),
      dateOfBirth: req.body.dateOfBirth,
      company: req.body.company,
      companyAddress: req.body.companyAddress,
      leadSource: req.body.leadSource,
      status: req.body.status,
      industry: req.body.industry,
      sex: req.body.sex,
      notes: req.body.notes,
      assignedTo: req.body.assignedTo || null,
      customerType: req.body.customerType,
      lastContactedAt: req.body.lastContactedAt || null,
      nextFollowUpAt: req.body.nextFollowUpAt || null,
      address: {
        houseNumber: req.body["address.houseNumber"] || req.body.address?.houseNumber,
        street: req.body["address.street"] || req.body.address?.street,
        barangay: req.body["address.barangay"] || req.body.address?.barangay,
        municipality: req.body["address.municipality"] || req.body.address?.municipality,
        province: req.body["address.province"] || req.body.address?.province,
        zipCode: req.body["address.zipCode"] || req.body.address?.zipCode,
        country: req.body["address.country"] || req.body.address?.country,
      },
    };

    if (req.body.tags !== undefined) {
      updateData.tags = Array.isArray(req.body.tags)
        ? req.body.tags
        : req.body.tags.split(",").map((t) => t.trim());
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

    const client = await populateClient(
      Client.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      ),
    );

    eventBus.emit(events.CLIENT_UPDATED || "clientUpdated", {
      clientId: id,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    if (assigneeChanged) {
      eventBus.emit(events.CLIENT_ASSIGNED || "clientAssigned", {
        clientId: id,
        oldAssignee: previousAssignee,
        newAssignee: incomingAssignee,
        userId: req.user.userId,
        teamId: req.user.teamId,
      });
    }

    res.status(200).json(client);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res
        .status(400)
        .json({ error: "Client with this email already exists" });
    }
    console.error("Update client error:", error);
    res.status(400).json({ error: error.message });
  }
};

// 5. Burahin ang Client
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const access = await ensureDocumentAccess(req, client, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok && req.user.role !== "Admin") {
      return res.status(access.status).json({ error: access.error });
    }

    await Client.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Client deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. I-update ang Lifespan Status (Active, Inactive, Lost)
const updateClientStatus = async (req, res) => {
  const { status } = req.body;
  const VALID = ["Active", "Inactive", "Lost"];

  if (!VALID.includes(status)) {
    return res
      .status(400)
      .json({ error: `Status must be one of: ${VALID.join(", ")}` });
  }

  try {
    const existing = await Client.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const oldStatus = existing.status;

    const client = await populateClient(
      Client.findByIdAndUpdate(
        req.params.id,
        { $set: { status } },
        { new: true, runValidators: true },
      ),
    );

    eventBus.emit(events.CLIENT_STATUS_CHANGED || "clientStatusChanged", {
      clientId: req.params.id,
      oldStatus,
      newStatus: status,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. I-assign ang Client sa ibang Sales Agent
const assignClient = async (req, res) => {
  const { assignedTo } = req.body;

  try {
    const existing = await Client.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

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

    const oldAssignee = existing.assignedTo?.toString() ?? null;

    const client = await populateClient(
      Client.findByIdAndUpdate(
        req.params.id,
        { $set: { assignedTo: assignedTo || null } },
        { new: true, runValidators: true },
      ),
    );

    eventBus.emit(events.CLIENT_ASSIGNED || "clientAssigned", {
      clientId: req.params.id,
      oldAssignee,
      newAssignee: assignedTo || null,
      userId: req.user.userId,
      teamId: req.user.teamId,
    });

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 8. I-update ang Petsa ng susunod na Follow-Up
const updateFollowUp = async (req, res) => {
  const { nextFollowUpAt } = req.body;

  try {
    const existing = await Client.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Client not found" });

    const access = await ensureDocumentAccess(req, existing, [
      (doc) => doc?.assignedTo,
      (doc) => doc?.createdBy,
    ]);

    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }

    const client = await populateClient(
      Client.findByIdAndUpdate(
        req.params.id,
        { $set: { nextFollowUpAt: nextFollowUpAt || null } },
        { new: true, runValidators: true },
      ),
    );

    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getAllClients,
  getSingleClient,
  createClient,
  updateClient,
  deleteClient,
  updateClientStatus,
  assignClient,
  updateFollowUp,
};
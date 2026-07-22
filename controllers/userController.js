const User = require("../models/User");
const Team = require("../models/Team");
const Lead = require("../models/Lead");
const Customer = require("../models/clientModel");
const Deal = require("../models/Quotation");
const Task = require("../models/Task");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getAssignableUsersForRequest } = require("../utils/teamScope");
const { USER_DEFAULT_SORT } = require("../constants/sortOptions");

const TEAM_POPULATE = {
  path: "team",
  select: "name isActive manager agents",
  populate: [
    {
      path: "manager",
      select: "firstName middleName lastName suffixName",
    },
    {
      path: "agents",
      select: "_id",
    },
  ],
};

// 1. Phone validation helper
const validatePhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/[\s\-().]/g, "");
  const isValid = /^(\+63|0)9\d{9}$|^\+?\d{10,15}$/.test(cleaned);
  return isValid ? null : "Enter a valid contact number (e.g. 09171234567 or +639171234567)";
};

// 2. I-HOIST O ILAGAY DITO SA ITAAS ANG TEAM VALIDATION HELPER (Bago ang mga controllers)
const validateTeamAssignment = async (role, teamId) => {
  if (!teamId) {
    return { ok: true, team: null };
  }

  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return { ok: false, status: 400, error: "Invalid team ID" };
  }

  const team = await Team.findById(teamId);
  if (!team) {
    return { ok: false, status: 404, error: "Selected team not found" };
  }

  return { ok: true, team };
};

// get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .populate(TEAM_POPULATE)
      .sort(USER_DEFAULT_SORT);

    res.status(200).json(users);
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// get a single user
// ==========================================
// 1. GET A SINGLE USER (Inayos para sa _id at employeeId)
// ==========================================
const getSingleUser = async (req, res) => {
  try {
    const { employeeId } = req.params;

    let user;
    // Kung ang ipinasa sa URL ay isang valid na 24-character MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      user = await User.findById(employeeId).populate(TEAM_POPULATE);
    } else {
      // Kung hindi, hahanapin ito bilang isang regular Custom Employee ID
      user = await User.findOne({ employeeId }).populate(TEAM_POPULATE);
    }

    if (!user) {
      return res.status(404).json({ error: "No such user" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get single user error:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

// ==========================================
// 2. CREATE A NEW USER (Inayos ang validation catch at logs)
// ==========================================
const createUser = async (req, res) => {
  const {
    team,
    firstName,
    middleName,
    lastName,
    suffixName,
    email,
    password,
    role,
    phone,
    sex,
    dateOfBirth,
    placeOfBirth
  } = req.body;

  // Ligtas na pagbuo sa currentAddress sub-object mula sa structural variations ng incoming body payload
  const currentAddress = {
    houseNumber: req.body.houseNumber || req.body["currentAddress.houseNumber"] || "",
    street: req.body.street || req.body["currentAddress.street"] || "",
    barangay: req.body.barangay || req.body["currentAddress.barangay"] || "",
    municipality: req.body.municipality || req.body["currentAddress.municipality"] || req.body.city || "",
    province: req.body.province || req.body["currentAddress.province"] || "",
    zipCode: req.body.zipCode || req.body["currentAddress.zipCode"] || "",
    country: req.body.country || req.body["currentAddress.country"] || "Philippines",
  };

  try {
    // 1. Validations para sa mga required at blangkong fields mula sa Postman/Frontend UI request
    if (!email || email.trim() === "") {
      return res.status(400).json({ error: "Email field is strictly required." });
    }
    if (!password || password.trim() === "") {
      return res.status(400).json({ error: "Password field is strictly required." });
    }
    if (!firstName || firstName.trim() === "") {
      return res.status(400).json({ error: "First Name is required." });
    }
    if (!lastName || lastName.trim() === "") {
      return res.status(400).json({ error: "Last Name is required." });
    }

    // 2. Phone validation check
    const phoneErr = validatePhone(phone);
    if (phoneErr) {
      return res.status(400).json({ error: phoneErr });
    }
    const cleanedPhone = phone ? phone.replace(/[\s\-().]/g, "") : "";

    // 3. Team allocation constraint validation
    const teamValidation = await validateTeamAssignment(role, team || null);
    if (!teamValidation.ok) {
      return res
        .status(teamValidation.status)
        .json({ error: teamValidation.error });
    }

    // 4. Ligtas na password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    const profilePicture = req.file
      ? `/uploads/profile_pictures/${req.file.filename}`
      : "";

    // 5. Pag-save sa Mongoose collection model (Kasama na ang reconstructed address)
    const user = await User.create({
      team: team || null,
      firstName: firstName.trim(),
      middleName: middleName ? middleName.trim() : "",
      lastName: lastName.trim(),
      suffixName: suffixName ? suffixName.trim() : "",
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      phone: cleanedPhone,
      sex,
      dateOfBirth: dateOfBirth || null,
      placeOfBirth: placeOfBirth || "",
      currentAddress, // Dito ay may laman na ito at tugma na sa Mongoose validation schema map
      profilePicture,
    });

    if (team && role === "Sales Agent") {
      await Team.findByIdAndUpdate(team, { $addToSet: { agents: user._id } });
    }

    const populatedUser = await User.findById(user._id).populate(TEAM_POPULATE);
    res.status(200).json(populatedUser);

  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(400).json({
        error: "Email already exists. Please use a different email.",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ error: errors.join(", ") });
    }

    console.error("Create user error detailed log:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
};

// ==========================================
// 3. DELETE A USER (Inayos para sa _id at employeeId lookups)
// ==========================================
const deleteUser = async (req, res) => {
  try {
    const { employeeId } = req.params;

    let user;
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      user = await User.findById(employeeId);
    } else {
      user = await User.findOne({ employeeId });
    }

    if (!user) {
      return res.status(404).json({ error: "No such user" });
    }

    if (user.team) {
      if (user.role === "Sales Manager") {
        await Team.findByIdAndUpdate(user.team, { $set: { manager: null } });
      }
      if (user.role === "Sales Agent") {
        await Team.findByIdAndUpdate(user.team, {
          $pull: { agents: user._id },
        });
      }
    }

    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      await User.findByIdAndDelete(employeeId);
    } else {
      await User.findOneAndDelete({ employeeId });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

// update a user
const updateUser = async (req, res) => {
  const { employeeId } = req.params;

  try {
    // 1. Maingat at flexible na paghahanap sa umiiral na user gamit ang ID mapping logic
    let existingUser;
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      existingUser = await User.findById(employeeId);
    } else {
      existingUser = await User.findOne({ employeeId });
    }

    if (!existingUser) {
      return res.status(404).json({ error: "No such user" });
    }

    const nextRole = req.body.role ?? existingUser.role;
    const nextTeam =
      req.body.team !== undefined
        ? req.body.team || null
        : existingUser.team?.toString() || null;

    const teamValidation = await validateTeamAssignment(nextRole, nextTeam);
    if (!teamValidation.ok) {
      return res
        .status(teamValidation.status)
        .json({ error: teamValidation.error });
    }

    // Phone parsing check kung sakaling nagbago ang record block
    if (req.body.phone) {
      const phoneErr = validatePhone(req.body.phone);
      if (phoneErr) {
        return res.status(400).json({ error: phoneErr });
      }
    }

    // 2. Ligtas na muling pagbuo sa payload sub-properties parameter blocks
    const bodyAddress = req.body.currentAddress || {};

    const updateData = {
      team: nextTeam,
      firstName: req.body.firstName ?? existingUser.firstName,
      middleName: req.body.middleName ?? existingUser.middleName,
      lastName: req.body.lastName ?? existingUser.lastName,
      suffixName: req.body.suffixName ?? existingUser.suffixName,
      email: req.body.email ?? existingUser.email,
      role: nextRole,
      phone: req.body.phone ? req.body.phone.replace(/[\s\-().]/g, "") : existingUser.phone,
      sex: req.body.sex ?? existingUser.sex,
      dateOfBirth: req.body.dateOfBirth ?? existingUser.dateOfBirth,
      placeOfBirth: req.body.placeOfBirth ?? existingUser.placeOfBirth,
      
      // Pinagsasama ang checks para sa Postman nested body parameters at Form field components
      currentAddress: {
        houseNumber: bodyAddress.houseNumber || req.body.houseNumber || req.body["currentAddress.houseNumber"] || existingUser.currentAddress?.houseNumber || "",
        street: bodyAddress.street || req.body.street || req.body["currentAddress.street"] || existingUser.currentAddress?.street || "",
        barangay: bodyAddress.barangay || req.body.barangay || req.body["currentAddress.barangay"] || existingUser.currentAddress?.barangay || "",
        municipality: bodyAddress.municipality || req.body.municipality || req.body["currentAddress.municipality"] || req.body.city || existingUser.currentAddress?.municipality || "",
        province: bodyAddress.province || req.body.province || req.body["currentAddress.province"] || existingUser.currentAddress?.province || "",
        zipCode: bodyAddress.zipCode || req.body.zipCode || req.body["currentAddress.zipCode"] || existingUser.currentAddress?.zipCode || "",
        country: bodyAddress.country || req.body.country || req.body["currentAddress.country"] || existingUser.currentAddress?.country || "Philippines",
      },
    };

    if (req.body.password) {
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    if (req.file) {
      updateData.profilePicture = `/uploads/profile_pictures/${req.file.filename}`;
    }

    if (req.body.removeProfilePicture === "true") {
      updateData.profilePicture = null;
    }

    // Tanggalin ang mga lumang team constraints references kung nagkaroon ng adjustment changes
    const oldTeamId = existingUser.team?.toString() || null;
    const newTeamId = nextTeam ? nextTeam.toString() : null;

    if (oldTeamId && oldTeamId !== newTeamId) {
      if (existingUser.role === "Sales Manager") {
        await Team.findByIdAndUpdate(oldTeamId, { $set: { manager: null } });
      }
      if (existingUser.role === "Sales Agent") {
        await Team.findByIdAndUpdate(oldTeamId, {
          $pull: { agents: existingUser._id },
        });
      }
    }

    // 3. Flexible atomic update operation handler mapping execution block
    let user;
    if (mongoose.Types.ObjectId.isValid(employeeId)) {
      user = await User.findByIdAndUpdate(
        employeeId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate(TEAM_POPULATE);
    } else {
      user = await User.findOneAndUpdate(
        { employeeId },
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate(TEAM_POPULATE);
    }

    if (newTeamId) {
      if (nextRole === "Sales Manager") {
        await Team.findByIdAndUpdate(newTeamId, {
          $set: { manager: user._id },
        });
      }
      if (nextRole === "Sales Agent") {
        await Team.findByIdAndUpdate(newTeamId, {
          $addToSet: { agents: user._id },
        });
      }
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Update user error:", error);
    return res.status(400).json({ error: error.message });
  }
};

// GET /api/users/assignable?resource=lead
const getAssignableUsers = async (req, res) => {
  try {
    const { resource } = req.query;

    let users = [];

    switch (resource) {
      case "lead":
      case "quotation":
      case "client": {
        users = await getAssignableUsersForRequest(req, {
          allowedRoles: ["Sales Agent"],
          includeSelf: false,
        });
        break;
      }

      case "task": {
        users = await getAssignableUsersForRequest(req, {
          allowedRoles: ["Sales Agent"],
          includeSelf: false,
        });
        break;
      }

      default: {
        return res.status(400).json({
          error: "Invalid resource. Expected lead, deal, customer, or task.",
        });
      }
    }

    res.status(200).json(users);
  } catch (error) {
    console.error("Get assignable users error:", error);
    res.status(500).json({ error: "Failed to fetch assignable users" });
  }
};

// GET /api/users/:employeeId/leads
const getUserLeads = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10, status, search, role } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ employeeId }).select("_id");
    if (!user) return res.status(404).json({ error: "User not found" });

    let filter = {};
    if (role === "owner") {
      filter = { leadOwner: user._id };
    } else if (role === "assignee") {
      filter = { leadAssignee: user._id };
    } else {
      filter = { $or: [{ leadOwner: user._id }, { leadAssignee: user._id }] };
    }

    if (status) filter.status = status;
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
          ],
        },
      ];
    }

    const [leads, total] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(
          "firstName middleName lastName email profilePicture phone status leadSource company convertedToCustomer createdAt",
        )
        .populate("leadOwner", "firstName lastName employeeId")
        .populate("leadAssignee", "firstName lastName employeeId"),
      Lead.countDocuments(filter),
    ]);

    res.status(200).json({
      data: leads,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user leads error:", error);
    res.status(500).json({ error: "Failed to fetch user leads" });
  }
};

// GET /api/users/:employeeId/customers
const getUserCustomers = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10, status, search } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ employeeId }).select("_id");
    if (!user) return res.status(404).json({ error: "User not found" });

    const filter = {
      $or: [{ assignedTo: user._id }, { createdBy: user._id }],
    };

    if (status) filter.status = status;
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      filter.$and = [
        {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { company: searchRegex },
          ],
        },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(
          "firstName middleName lastName email profilePicture phone company status customerType industry createdAt",
        )
        .populate("assignedTo", "firstName lastName employeeId")
        .populate("createdBy", "firstName lastName employeeId"),
      Customer.countDocuments(filter),
    ]);

    res.status(200).json({
      data: customers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user customers error:", error);
    res.status(500).json({ error: "Failed to fetch user customers" });
  }
};

// GET /api/users/:employeeId/deals
const getUserDeals = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10, stage, search } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ employeeId }).select("_id");
    if (!user) return res.status(404).json({ error: "User not found" });

    const filter = {
      $or: [{ assignedTo: user._id }, { createdBy: user._id }],
    };

    if (stage) filter.stage = stage;
    if (search) {
      filter.$and = [{ title: { $regex: search, $options: "i" } }];
    }

    const [deals, total] = await Promise.all([
      Deal.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(
          "title value currency stage probability expectedCloseDate closedAt createdAt",
        )
        .populate("customer", "firstName lastName email")
        .populate("assignedTo", "firstName lastName employeeId")
        .populate("createdBy", "firstName lastName employeeId"),
      Deal.countDocuments(filter),
    ]);

    res.status(200).json({
      data: deals,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user deals error:", error);
    res.status(500).json({ error: "Failed to fetch user deals" });
  }
};

// GET /api/users/:employeeId/tasks
const getUserTasks = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { page = 1, limit = 10, status, priority, search } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ employeeId }).select("_id");
    if (!user) return res.status(404).json({ error: "User not found" });

    const filter = {
      $or: [{ assignedTo: user._id }, { createdBy: user._id }],
    };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$and = [{ subject: { $regex: search, $options: "i" } }];
    }

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .sort({ dueDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select(
          "subject taskType priority status scope dueDate relatedToType relatedTo completedAt createdAt",
        )
        .populate("assignedTo", "firstName lastName employeeId")
        .populate("createdBy", "firstName lastName employeeId")
        .populate("relatedTo"),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      data: tasks,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user tasks error:", error);
    res.status(500).json({ error: "Failed to fetch user tasks" });
  }
};


// ===================================================================================
// 🌟 USER ACCESS MODULE MANAGEMENT CONTROLLERS (Para sa Admin Checkbox Workspace)
// ===================================================================================

// @desc    Kuhanin ang listahan ng active users para sa select dropdown
// @route   GET /api/users/dropdown
// @access  Private (Admin Only)
const getUsersDropdown = async (req, res) => {
  try {
    const users = await User.find({ status: "active" })
      .select("firstName lastName middleName employeeId role")
      .sort({ firstName: 1 });

    const formattedUsers = users.map((u) => ({
      _id: u._id,
      name: `${u.firstName} ${u.lastName} (${u.employeeId})`,
      role: u.role,
    }));

    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error("Get users dropdown error:", error);
    res.status(500).json({ error: "Failed to fetch user list for dropdown." });
  }
};

// @desc    Kuhanin ang impormasyon at modules ng napiling user
// @route   GET /api/users/:id/details
// @access  Private (Admin Only)
const getUserDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id)
      .populate("team")
      .select("firstName lastName middleName email role team status accessModules");

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Get user details error:", error);
    res.status(500).json({ error: "Failed to load user information." });
  }
};

// @desc    I-save ang binagong role at access modules ng user (Admin Only)
// @route   PATCH /api/users/:employeeId/access
// @access  Private (Admin Only)
const updateUserAccess = async (req, res) => {
  const { employeeId } = req.params;
  const { role, accessModules } = req.body;

  try {
    const targetUser = await User.findOne({ employeeId });
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const currentUser = req.user;
    const newRole = role || targetUser.role;

    if (currentUser.role === "Admin") {
      if (
        ["Admin", "Super Admin"].includes(targetUser.role) ||
        ["Admin", "Super Admin"].includes(newRole)
      ) {
        return res.status(403).json({
          error: "Only Super Admin can modify admin-level access.",
        });
      }
    }

    if (
      targetUser._id.toString() === currentUser.id.toString() &&
      !["Super Admin", "Admin"].includes(newRole)
    ) {
      return res.status(400).json({
        error: "You are not allowed to change or demote your own admin role.",
      });
    }

    if (role) targetUser.role = role;
    if (Array.isArray(accessModules)) targetUser.accessModules = accessModules;

    await targetUser.save();

    res.status(200).json({
      message: "User privileges saved and updated successfully.",
      user: {
        _id: targetUser._id,
        name: `${targetUser.firstName} ${targetUser.lastName}`,
        role: targetUser.role,
        accessModules: targetUser.accessModules,
      },
    });
  } catch (error) {
    console.error("Update user access error:", error);
    res.status(500).json({ error: "Failed to process user access modifications." });
  }
};


module.exports = {
  getAllUsers,
  getSingleUser,
  createUser,
  deleteUser,
  updateUser,
  getAssignableUsers,
  getUserLeads,
  getUserCustomers,
  getUserDeals,
  getUserTasks,
  getUsersDropdown,
  getUserDetails,
  updateUserAccess,
};
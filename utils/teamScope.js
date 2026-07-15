const mongoose = require("mongoose");
const User = require("../models/User");
const Team = require("../models/Team");
const { USER_DEFAULT_SORT } = require("../constants/sortOptions");

const ASSIGNEE_SELECT =
  "firstName middleName lastName suffixName email role employeeId profilePicture sex team";
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * Checks if a user is a Sales Manager without a team
 * Used to prevent managers from accessing team-specific data before team creation
 * @async
 * @param {Object} req - Express request with authenticated user
 * @returns {Promise<boolean>} True if user is a teamless manager
 */
const isTeamlessManager = async (req) => {
  if (req.user?.role !== "Sales Manager") return false;

  const team = await getManagerTeam(req.user.userId);
  return !team;
};

/**
 * Checks if a user is a Sales Agent without a team assignment
 * @async
 * @param {Object} req - Express request with authenticated user
 * @returns {Promise<boolean>} True if user is a teamless agent
 */
const isTeamlessAgent = async (req) => {
  const currentUser = await getCurrentUserWithTeam(req);

  return currentUser?.role === "Sales Agent" && !currentUser.team;
};

/**
 * Retrieves current user data with team information
 * Used to determine access control for data queries
 * @async
 * @param {Object} req - Express request with authenticated user
 * @returns {Promise<Object|null>} User object with team details or null
 */
const getCurrentUserWithTeam = async (req) => {
  if (!req?.user?.userId) return null;

  return User.findById(req.user.userId)
    .select("_id role team firstName lastName email")
    .populate("team", "name manager agents isActive");
};

/**
 * Retrieves the team managed by a specific manager
 * @async
 * @param {string} managerId - Manager's user ID
 * @returns {Promise<Object|null>} Team document or null if no team found
 */
const getManagerTeam = async (managerId) => {
  return Team.findOne({
    manager: managerId,
    isActive: true,
  })
    .populate("manager", "_id role")
    .populate("agents", "_id role team");
};

/**
 * Gets all Sales Agent IDs in a manager's team
 * Used for access control to ensure managers only see team data
 * @async
 * @param {string} managerId - Manager's user ID
 * @returns {Promise<Array<string>>} Array of agent user IDs
 */
const getTeamAgentIdsForManager = async (managerId) => {
  const team = await getManagerTeam(managerId);
  if (!team) return [];

  return team.agents
    .filter((agent) => agent?.role === "Sales Agent")
    .map((agent) => agent._id.toString());
};

/**
 * Determines which agent IDs the current user can access
 * Admin: can access all agents (returns null)
 * Sales Manager: can access only their team members
 * Sales Agent: can only access their own data
 * @async
 * @param {Object} req - Express request with authenticated user
 * @returns {Promise<Array<string>|null>} Array of accessible agent IDs or null for admins
 */
const getScopedAgentIds = async (req) => {
  const currentUser = await getCurrentUserWithTeam(req);
  if (!currentUser) return [];

  if (currentUser.role === "Admin") {
    return null; // null = unrestricted
  }

  if (currentUser.role === "Sales Agent") {
    return [currentUser._id.toString()];
  }

  if (currentUser.role === "Sales Manager") {
    return getTeamAgentIdsForManager(currentUser._id);
  }

  return [];
};

/**
 * Checks if a manager can access a specific user's data
 * Validates that the target user is in the manager's team
 * @async
 * @param {string} managerId - Manager's user ID
 * @param {string} targetUserId - User ID to check access for
 * @returns {Promise<boolean>} True if manager can access user
 */
const canManagerAccessUser = async (managerId, targetUserId) => {
  if (!isValidObjectId(managerId) || !isValidObjectId(targetUserId))
    return false;

  const team = await getManagerTeam(managerId);
  if (!team) return false;

  return team.agents.some(
    (agent) => agent._id.toString() === targetUserId.toString(),
  );
};

/**
 * Validates that a user can be assigned to a lead/deal/task
 * Ensures only Sales Agents can be assigned
 * Checks that the target user exists and has proper permissions
 * @async
 * @param {Object} req - Express request with authenticated user
 * @param {string} targetUserId - User ID to validate for assignment
 * @returns {Promise<Object>} Result object: {ok: boolean, status?: number, error?: string}
 */
const validateAssignableSalesAgent = async (req, targetUserId) => {
  if (!targetUserId) {
    return { ok: true, user: null };
  }

  if (!isValidObjectId(targetUserId)) {
    return { ok: false, status: 400, error: "Invalid assignee ID" };
  }

  const targetUser = await User.findById(targetUserId).select("_id role team");
  if (!targetUser) {
    return { ok: false, status: 404, error: "Assigned user not found" };
  }

  if (targetUser.role !== "Sales Agent") {
    return {
      ok: false,
      status: 400,
      error: "Assigned user must be a Sales Agent",
    };
  }

  if (req.user.role === "Sales Manager") {
    const allowed = await canManagerAccessUser(req.user.userId, targetUser._id);
    if (!allowed) {
      return {
        ok: false,
        status: 403,
        error: "Sales Manager can only assign users within their team",
      };
    }
  }

  return { ok: true, user: targetUser };
};

const buildLeadAccessFilter = async (req) => {
  const { role, userId } = req.user;

  if (role === "Admin") return {};

  if (role === "Sales Agent") {
    if (await isTeamlessAgent(req)) return { _id: null };
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [{ leadAssignee: userObjectId }, { leadOwner: userObjectId }],
    };
  }

  if (role === "Sales Manager") {
    if (await isTeamlessManager(req)) return { _id: null };
    const agentIds = await getTeamAgentIdsForManager(userId);
    const objectAgentIds = agentIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const managerObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [
        { leadOwner: managerObjectId },
        { leadAssignee: { $in: objectAgentIds } },
      ],
    };
  }

  return { _id: null };
};

const buildDealAccessFilter = async (req) => {
  const { role, userId } = req.user;

  if (role === "Admin") return {};

  if (role === "Sales Agent") {
    if (await isTeamlessAgent(req)) return { _id: null };
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [{ assignedTo: userObjectId }, { createdBy: userObjectId }],
    };
  }

  if (role === "Sales Manager") {
    if (await isTeamlessManager(req)) return { _id: null };
    const agentIds = await getTeamAgentIdsForManager(userId);
    const objectAgentIds = agentIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const managerObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [
        { createdBy: managerObjectId },
        { assignedTo: { $in: objectAgentIds } },
      ],
    };
  }

  return { _id: null };
};

const buildTaskAccessFilter = async (req) => {
  const { role, userId } = req.user;

  if (role === "Admin") return {};

  if (role === "Sales Agent") {
    if (await isTeamlessAgent(req)) return { _id: null };
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [{ assignedTo: userObjectId }, { createdBy: userObjectId }],
    };
  }

  if (role === "Sales Manager") {
    if (await isTeamlessManager(req)) return { _id: null };
    const agentIds = await getTeamAgentIdsForManager(userId);
    const objectAgentIds = agentIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const managerObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [
        { createdBy: managerObjectId },
        { assignedTo: { $in: objectAgentIds } },
      ],
    };
  }

  return { _id: null };
};

const buildCustomerAccessFilter = async (req) => {
  const { role, userId } = req.user;

  if (role === "Admin") return {};

  if (role === "Sales Agent") {
    if (await isTeamlessAgent(req)) return { _id: null };
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [{ assignedTo: userObjectId }, { createdBy: userObjectId }],
    };
  }

  if (role === "Sales Manager") {
    if (await isTeamlessManager(req)) return { _id: null };
    const agentIds = await getTeamAgentIdsForManager(userId);
    const objectAgentIds = agentIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );
    const managerObjectId = new mongoose.Types.ObjectId(userId);

    return {
      $or: [
        { createdBy: managerObjectId },
        { assignedTo: { $in: objectAgentIds } },
      ],
    };
  }

  return { _id: null };
};

const ensureDocumentAccess = async (req, doc, userFieldResolvers = []) => {
  if (!doc) {
    return { ok: false, status: 404, error: "Resource not found" };
  }

  if (req.user.role === "Admin") {
    return { ok: true };
  }

  const currentUserId = req.user.userId;

  if (req.user.role === "Sales Agent") {
    if (await isTeamlessAgent(req)) {
      return {
        ok: false,
        status: 403,
        error: "You must be assigned to a team first",
      };
    }

    const allowed = userFieldResolvers.some((resolver) => {
      const value = resolver(doc);
      return value && value.toString() === currentUserId.toString();
    });

    return allowed
      ? { ok: true }
      : { ok: false, status: 403, error: "Access denied" };
  }

  if (req.user.role === "Sales Manager") {
    if (await isTeamlessManager(req)) {
      return {
        ok: false,
        status: 403,
        error: "You must be assigned to manage a team first",
      };
    }

    const teamAgentIds = await getTeamAgentIdsForManager(currentUserId);

    const allowed = userFieldResolvers.some((resolver) => {
      const value = resolver(doc);
      if (!value) return false;

      const id = value.toString();
      return id === currentUserId.toString() || teamAgentIds.includes(id);
    });

    return allowed
      ? { ok: true }
      : { ok: false, status: 403, error: "Access denied" };
  }

  return { ok: false, status: 403, error: "Access denied" };
};

const getAssignableUsersForRequest = async (req, options = {}) => {
  const { allowedRoles = ["Sales Agent"], includeSelf = false } = options;

  const { role, userId } = req.user;

  if (role === "Admin") {
    return User.find({ role: { $in: allowedRoles } })
      .select(ASSIGNEE_SELECT)
      .sort(USER_DEFAULT_SORT);
  }

  if (role === "Sales Manager") {
    const teamAgentIds = await getTeamAgentIdsForManager(userId);

    const ids = includeSelf ? [...teamAgentIds, userId] : teamAgentIds;

    return User.find({
      _id: { $in: ids },
      role: {
        $in: includeSelf ? [...allowedRoles, "Sales Manager"] : allowedRoles,
      },
    })
      .select(ASSIGNEE_SELECT)
      .sort(USER_DEFAULT_SORT);
  }

  if (role === "Sales Agent") {
    if (!includeSelf) return [];

    return User.find({
      _id: userId,
      role: { $in: ["Sales Agent"] },
    })
      .select(ASSIGNEE_SELECT)
      .sort(USER_DEFAULT_SORT);
  }

  return [];
};

const findTeamManagers = async (teamId) => {
  const team = await Team.findById(teamId)
    .populate("manager", "_id role status")
    .lean();

  if (!team?.manager) return [];

  const admins = await User.find(
    {
      role: "Admin",
      status: "active",
    },
    "_id",
  ).lean();

  const managers = [];

  if (
    team.manager.status === "active" &&
    ["Sales Manager", "Admin"].includes(team.manager.role)
  ) {
    managers.push({ _id: team.manager._id });
  }

  return [...managers, ...admins];
};

module.exports = {
  getCurrentUserWithTeam,
  isTeamlessManager,
  isTeamlessAgent,
  getManagerTeam,
  getTeamAgentIdsForManager,
  getScopedAgentIds,
  canManagerAccessUser,
  validateAssignableSalesAgent,
  buildLeadAccessFilter,
  buildDealAccessFilter,
  buildTaskAccessFilter,
  buildCustomerAccessFilter,
  ensureDocumentAccess,
  getAssignableUsersForRequest,
  findTeamManagers,
};

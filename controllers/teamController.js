const User = require("../models/User");
const Team = require("../models/Team");
const mongoose = require("mongoose");
const {
  TEAM_DEFAULT_SORT,
  USER_DEFAULT_SORT,
} = require("../constants/sortOptions");

const TEAM_POPULATE = [
  {
    path: "manager",
    select:
      "firstName middleName lastName suffixName email role employeeId profilePicture sex team status",
  },
  {
    path: "agents",
    select:
      "firstName middleName lastName suffixName email role employeeId profilePicture sex team status",
  },
];

const populateTeam = (query) => {
  TEAM_POPULATE.forEach((p) => query.populate(p));
  return query;
};

const validateManager = async (managerId) => {
  if (!managerId) {
    return { ok: false, status: 400, error: "Manager is required" };
  }

  if (!mongoose.Types.ObjectId.isValid(managerId)) {
    return { ok: false, status: 400, error: "Invalid manager ID" };
  }

  const manager = await User.findById(managerId).select("_id role team");
  if (!manager) {
    return { ok: false, status: 404, error: "Manager not found" };
  }

  if (manager.role !== "Sales Manager") {
    return {
      ok: false,
      status: 400,
      error: "Manager must have Sales Manager role",
    };
  }

  return { ok: true, user: manager };
};

const validateAgents = async (agentIds = []) => {
  if (!Array.isArray(agentIds)) {
    return { ok: false, status: 400, error: "agents must be an array" };
  }

  const uniqueIds = [...new Set(agentIds.filter(Boolean))];

  for (const id of uniqueIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { ok: false, status: 400, error: `Invalid agent ID: ${id}` };
    }
  }

  const agents = await User.find({ _id: { $in: uniqueIds } }).select(
    "_id role team",
  );
  if (agents.length !== uniqueIds.length) {
    return {
      ok: false,
      status: 404,
      error: "One or more agents were not found",
    };
  }

  const invalidRoleUser = agents.find((user) => user.role !== "Sales Agent");
  if (invalidRoleUser) {
    return {
      ok: false,
      status: 400,
      error: "All assigned team members must have Sales Agent role",
    };
  }

  return { ok: true, users: agents, ids: uniqueIds };
};

// GET /api/teams
const getAllTeams = async (req, res) => {
  try {
    const teams = await populateTeam(Team.find({}).sort(TEAM_DEFAULT_SORT));
    res.status(200).json(teams);
  } catch (error) {
    console.error("Get all teams error:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
};

// GET /api/teams/:id
const getSingleTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await populateTeam(Team.findById(id));
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.status(200).json(team);
  } catch (error) {
    console.error("Get single team error:", error);
    res.status(500).json({ error: "Failed to fetch team" });
  }
};

// POST /api/teams
const createTeam = async (req, res) => {
  try {
    const { name, manager, agents = [], description, isActive } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Team name is required" });
    }

    const existingName = await Team.findOne({ name: name.trim() });
    if (existingName) {
      return res.status(400).json({ error: "Team name already exists" });
    }

    const managerCheck = await validateManager(manager);
    if (!managerCheck.ok) {
      return res
        .status(managerCheck.status)
        .json({ error: managerCheck.error });
    }

    const agentsCheck = await validateAgents(agents);
    if (!agentsCheck.ok) {
      return res.status(agentsCheck.status).json({ error: agentsCheck.error });
    }

    const existingManagerTeam = await Team.findOne({ manager });
    if (existingManagerTeam) {
      return res.status(400).json({
        error: "This sales manager is already assigned to another team",
      });
    }

    const overlappingAgents = await Team.findOne({
      agents: { $in: agentsCheck.ids },
    });

    if (overlappingAgents) {
      return res.status(400).json({
        error: "One or more sales agents are already assigned to another team",
      });
    }

    const team = await Team.create({
      name: name.trim(),
      manager,
      agents: agentsCheck.ids,
      description: description?.trim() || "",
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    await User.findByIdAndUpdate(manager, { $set: { team: team._id } });

    if (agentsCheck.ids.length > 0) {
      await User.updateMany(
        { _id: { $in: agentsCheck.ids } },
        { $set: { team: team._id } },
      );
    }

    const populated = await populateTeam(Team.findById(team._id));
    res.status(201).json({
      message: "Team created successfully",
      team: populated,
    });
  } catch (error) {
    console.error("Create team error:", error);
    res.status(500).json({ error: "Failed to create team" });
  }
};

// PUT /api/teams/:id
const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, manager, agents, description, isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const existingTeam = await Team.findById(id);
    if (!existingTeam) {
      return res.status(404).json({ error: "Team not found" });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Team name cannot be empty" });
      }

      const duplicateName = await Team.findOne({
        name: name.trim(),
        _id: { $ne: id },
      });

      if (duplicateName) {
        return res.status(400).json({ error: "Team name already exists" });
      }
    }

    let resolvedManager = existingTeam.manager.toString();
    if (manager !== undefined) {
      const managerCheck = await validateManager(manager);
      if (!managerCheck.ok) {
        return res
          .status(managerCheck.status)
          .json({ error: managerCheck.error });
      }

      const managerInOtherTeam = await Team.findOne({
        manager,
        _id: { $ne: id },
      });

      if (managerInOtherTeam) {
        return res.status(400).json({
          error: "This sales manager is already assigned to another team",
        });
      }

      resolvedManager = manager;
    }

    let resolvedAgents = existingTeam.agents.map((a) => a.toString());
    if (agents !== undefined) {
      const agentsCheck = await validateAgents(agents);
      if (!agentsCheck.ok) {
        return res
          .status(agentsCheck.status)
          .json({ error: agentsCheck.error });
      }

      const overlappingAgents = await Team.findOne({
        _id: { $ne: id },
        agents: { $in: agentsCheck.ids },
      });

      if (overlappingAgents) {
        return res.status(400).json({
          error:
            "One or more sales agents are already assigned to another team",
        });
      }

      resolvedAgents = agentsCheck.ids;
    }

    const previousManagerId = existingTeam.manager?.toString();
    const previousAgentIds = existingTeam.agents.map((a) => a.toString());

    existingTeam.name = name !== undefined ? name.trim() : existingTeam.name;
    existingTeam.manager = resolvedManager;
    existingTeam.agents = resolvedAgents;
    existingTeam.description =
      description !== undefined
        ? description?.trim() || ""
        : existingTeam.description;
    existingTeam.isActive =
      typeof isActive === "boolean" ? isActive : existingTeam.isActive;

    await existingTeam.save();

    // clear old team links for users removed from this team
    const removedAgentIds = previousAgentIds.filter(
      (id) => !resolvedAgents.includes(id),
    );

    if (previousManagerId && previousManagerId !== resolvedManager) {
      await User.findByIdAndUpdate(previousManagerId, { $set: { team: null } });
    }

    if (removedAgentIds.length > 0) {
      await User.updateMany(
        { _id: { $in: removedAgentIds }, team: existingTeam._id },
        { $set: { team: null } },
      );
    }

    await User.findByIdAndUpdate(resolvedManager, {
      $set: { team: existingTeam._id },
    });

    if (resolvedAgents.length > 0) {
      await User.updateMany(
        { _id: { $in: resolvedAgents } },
        { $set: { team: existingTeam._id } },
      );
    }

    const populated = await populateTeam(Team.findById(existingTeam._id));
    res.status(200).json({
      message: "Team updated successfully",
      team: populated,
    });
  } catch (error) {
    console.error("Update team error:", error);
    res.status(500).json({ error: "Failed to update team" });
  }
};

// DELETE /api/teams/:id
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    await User.updateMany(
      { _id: { $in: [team.manager, ...team.agents] } },
      { $set: { team: null } },
    );

    await Team.findByIdAndDelete(id);

    res.status(200).json({ message: "Team deleted successfully" });
  } catch (error) {
    console.error("Delete team error:", error);
    res.status(500).json({ error: "Failed to delete team" });
  }
};

// POST /api/teams/:id/agents/assign
const assignAgentToTeam = async (req, res) => {
  try {
    const { id: teamId } = req.params;
    const { agentId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(agentId)
    ) {
      return res.status(400).json({ error: "Invalid ID(s)" });
    }

    const team = await Team.findOne({ _id: teamId, manager: req.user.userId });
    if (!team) {
      return res
        .status(403)
        .json({ error: "You can only manage your own team" });
    }

    const agent = await User.findById(agentId).select("_id role team");
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.role !== "Sales Agent") {
      return res.status(400).json({ error: "User must be a Sales Agent" });
    }

    if (agent.team) {
      return res.status(400).json({
        error: "Agent is already assigned to a team",
      });
    }

    if (team.agents.includes(agent._id)) {
      return res.status(400).json({ error: "Agent already in team" });
    }

    team.agents.push(agent._id);
    await team.save();

    agent.team = team._id;
    await agent.save();

    const populated = await populateTeam(Team.findById(team._id));

    res.status(200).json({
      message: "Agent assigned successfully",
      team: populated,
    });
  } catch (error) {
    console.error("Assign agent error:", error);
    res.status(500).json({ error: "Failed to assign agent" });
  }
};

// POST /api/teams/:id/agents/unassign
const unassignAgentFromTeam = async (req, res) => {
  try {
    const { id: teamId } = req.params;
    const { agentId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(teamId) ||
      !mongoose.Types.ObjectId.isValid(agentId)
    ) {
      return res.status(400).json({ error: "Invalid ID(s)" });
    }

    const team = await Team.findOne({ _id: teamId, manager: req.user.userId });
    if (!team) {
      return res
        .status(403)
        .json({ error: "You can only manage your own team" });
    }

    const agent = await User.findById(agentId).select("_id role team");
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (agent.role !== "Sales Agent") {
      return res.status(400).json({ error: "User must be a Sales Agent" });
    }

    if (!agent.team || agent.team.toString() !== team._id.toString()) {
      return res.status(400).json({ error: "Agent is not part of this team" });
    }

    team.agents = team.agents.filter(
      (a) => a.toString() !== agentId.toString(),
    );

    await team.save();

    agent.team = null;
    await agent.save();

    const populated = await populateTeam(Team.findById(team._id));

    res.status(200).json({
      message: "Agent unassigned successfully",
      team: populated,
    });
  } catch (error) {
    console.error("Unassign agent error:", error);
    res.status(500).json({ error: "Failed to unassign agent" });
  }
};

// GET /api/teams/:id/assignable-agents
const getAssignableAgentsForTeam = async (req, res) => {
  try {
    const { id: teamId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }

    const team = await Team.findOne({
      _id: teamId,
      manager: req.user.userId,
    });

    if (!team) {
      return res.status(403).json({
        error: "You can only access your own team",
      });
    }

    const agents = await User.find({
      role: "Sales Agent",
      team: null,
    })
      .select(
        "firstName middleName lastName suffixName email employeeId profilePicture sex",
      )
      .sort(USER_DEFAULT_SORT);

    res.status(200).json(agents);
  } catch (error) {
    console.error("Get assignable agents error:", error);
    res.status(500).json({ error: "Failed to fetch assignable agents" });
  }
};

module.exports = {
  getAllTeams,
  getSingleTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  assignAgentToTeam,
  unassignAgentFromTeam,
  getAssignableAgentsForTeam,
};

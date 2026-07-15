const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Customer = require("../models/clientModel");
const Deal = require("../models/Quotation");
const Task = require("../models/Task");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Meeting = require("../models/Meeting"); // 🟢 DAGDAG: Tiyaking tugma ang file name sa iyong models folder

const {
  buildLeadAccessFilter,
  buildCustomerAccessFilter,
  buildDealAccessFilter,
  buildTaskAccessFilter,
  getTeamAgentIdsForManager,
} = require("../utils/teamScope");

// Constants
const LEAD_SOURCE_CONFIG = [
  { name: "Website", color: "#38bdf8" }, // sky
  { name: "Referral", color: "#a78bfa" }, // violet
  { name: "Social Media", color: "#fbbf24" }, // amber
  { name: "Email Campaign", color: "#f87171" }, // red
  { name: "Walk-in", color: "#34d399" }, // emerald
  { name: "Other", color: "#94a3b8" }, // slate/gray — always last
];

// Helpers

/**
 * Returns the start date of each of the last N months
 * Used to create monthly time series data for charts
 * @param {number} n - Number of months to retrieve (default: 6)
 * @returns {Array<Date>} Array of Date objects, one for each month's first day
 */
const getLastNMonthsRange = (n = 6) => {
  const months = [];
  const now = new Date();

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }

  return months;
};

/**
 * Formats a date as month and year string (e.g., "January 2025")
 * @param {Date} date - Date to format
 * @returns {string} Formatted month and year label
 */
const formatMonthLabel = (date) =>
  date.toLocaleString("default", { month: "long", year: "numeric" });

/**
 * Calculates key performance indicators (KPIs) for the dashboard
 * Includes counts, conversion rates, and win rates
 * Access control automatically applied based on user role
 */
const getKpiStats = async (req) => {
  const [leadFilter, customerFilter, dealFilter, taskFilter] =
    await Promise.all([
      buildLeadAccessFilter(req),
      buildCustomerAccessFilter(req),
      buildDealAccessFilter(req),
      buildTaskAccessFilter(req),
    ]);

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalLeads,
    newLeadsThisMonth,
    convertedLeads,
    lostLeads,

    totalCustomers,
    activeCustomers,
    newCustomersThisMonth,

    totalDeals,
    wonDeals,
    lostDeals,
    openDealsAgg,
    wonDealsAgg,

    totalTasks,
    completedTasks,
    pendingTasks, // 🟢 DAGDAG: Para sa UI state tab badge mapping
    ongoingTasks, // 🟢 DAGDAG: Para sa UI state tab badge mapping
    overdueTasks,
    tasksDueToday,
  ] = await Promise.all([
    // Leads
    Lead.countDocuments(leadFilter),
    Lead.countDocuments({ ...leadFilter, createdAt: { $gte: startOfMonth } }),
    Lead.countDocuments({ ...leadFilter, status: "Converted" }),
    Lead.countDocuments({ ...leadFilter, status: "Lost" }),

    // Customers
    Customer.countDocuments(customerFilter),
    Customer.countDocuments({ ...customerFilter, status: "Active" }),
    Customer.countDocuments({
      ...customerFilter,
      createdAt: { $gte: startOfMonth },
    }),

    // Deals
    Deal.countDocuments(dealFilter),
    Deal.countDocuments({ ...dealFilter, stage: "Won" }),
    Deal.countDocuments({ ...dealFilter, stage: "Lost" }),

    // Open deals total value
    Deal.aggregate([
      { $match: { ...dealFilter, stage: { $nin: ["Won", "Lost"] } } },
      { $group: { _id: null, total: { $sum: "$value" } } },
    ]),

    // Won deals total value
    Deal.aggregate([
      { $match: { ...dealFilter, stage: "Won" } },
      { $group: { _id: null, total: { $sum: "$value" } } },
    ]),

    // Tasks counts (Inihanay gamit ang exact 'stage' field identifiers)
    Task.countDocuments(taskFilter),
    Task.countDocuments({ ...taskFilter, stage: "Completed" }),
    Task.countDocuments({ ...taskFilter, stage: "Pending" }),   // 🟢 Kukunin ang Pending tasks para sa badge counter
    Task.countDocuments({ ...taskFilter, stage: "Ongoing" }),   // 🟢 Kukunin ang Ongoing tasks para sa badge counter

    // Overdue: not completed + dueDate in the past
    Task.countDocuments({
      ...taskFilter,
      stage: { $ne: "Completed" },
      dueDate: { $lt: startOfToday, $ne: null },
    }),

    // Due today
    Task.countDocuments({
      ...taskFilter,
      stage: { $ne: "Completed" },
      dueDate: {
        $gte: startOfToday,
        $lt: new Date(startOfToday.getTime() + 86400000),
      },
    }),
  ]);

  const taskCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const dealWinRate =
    wonDeals + lostDeals > 0
      ? Math.round((wonDeals / (wonDeals + lostDeals)) * 100)
      : 0;

  const leadConversionRate =
    totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  return {
    leads: {
      total: totalLeads,
      newThisMonth: newLeadsThisMonth,
      converted: convertedLeads,
      lost: lostLeads,
      conversionRate: leadConversionRate,
    },
    customers: {
      total: totalCustomers,
      active: activeCustomers,
      newThisMonth: newCustomersThisMonth,
    },
    deals: {
      total: totalDeals,
      won: wonDeals,
      lost: lostDeals,
      winRate: dealWinRate,
      openValue: openDealsAgg[0]?.total ?? 0,
      wonValue: wonDealsAgg[0]?.total ?? 0,
    },
    tasks: {
      total: totalTasks,
      pending: pendingTasks,     // 🟢 Ipapasa sa Frontend
      ongoing: ongoingTasks,     // 🟢 Ipapasa sa Frontend
      completed: completedTasks, // 🟢 Ipapasa sa Frontend
      overdue: overdueTasks,     // 🟢 Ipapasa sa Frontend
      dueToday: tasksDueToday,
      completionRate: taskCompletionRate,
    },
  };
};

// Lead Funnel (bar / funnel chart)
const getLeadFunnelData = async (req) => {
  const filter = await buildLeadAccessFilter(req);
  const stages = ["New", "Contacted", "Qualified", "Converted", "Lost"];

  const results = await Lead.aggregate([
    { $match: filter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(results.map((r) => [r._id, r.count]));

  return stages.map((stage) => ({
    stage,
    count: countMap[stage] ?? 0,
  }));
};

// Monthly Leads (line chart — last 6 months)
const getMonthlyLeadsData = async (req) => {
  const filter = await buildLeadAccessFilter(req);
  const months = getLastNMonthsRange(6);
  const rangeStart = months[0];
  const rangeEnd = new Date();

  const results = await Lead.aggregate([
    {
      $match: {
        ...filter,
        createdAt: { $gte: rangeStart, $lte: rangeEnd },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const resultMap = Object.fromEntries(
    results.map((r) => [`${r._id.year}-${r._id.month}`, r.count]),
  );

  return months.map((d) => ({
    month: formatMonthLabel(d),
    leads: resultMap[`${d.getFullYear()}-${d.getMonth() + 1}`] ?? 0,
  }));
};

// Deal Pipeline by Stage (bar chart)
const getDealPipelineData = async (req) => {
  const filter = await buildDealAccessFilter(req);
  const stages = [
    "Prospecting",
    "Qualification",
    "Proposal",
    "Negotiation",
    "Won",
    "Lost",
  ];

  const results = await Deal.aggregate([
    { $match: filter },
    {
      $group: {
        _id: "$stage",
        count: { $sum: 1 },
        totalValue: { $sum: "$value" },
      },
    },
  ]);

  const stageMap = Object.fromEntries(
    results.map((r) => [r._id, { count: r.count, totalValue: r.totalValue }]),
  );

  return stages.map((stage) => ({
    stage,
    count: stageMap[stage]?.count ?? 0,
    totalValue: stageMap[stage]?.totalValue ?? 0,
  }));
};

// Task Breakdown (pie charts)
const getTaskBreakdownData = async (req) => {
  const filter = await buildTaskAccessFilter(req);

  const [byStatus, byPriority, byType] = await Promise.all([
    Task.aggregate([
      { $match: filter },
      { $group: { _id: "$stage", count: { $sum: 1 } } }, // Gumagamit ng 'stage' field para sa status query
    ]),
    Task.aggregate([
      { $match: filter },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: filter },
      { $group: { _id: "$taskType", count: { $sum: 1 } } },
    ]),
  ]);

  const normalize = (arr) =>
    arr.map((r) => ({ name: r._id ?? "Unknown", value: r.count }));

  return {
    byStatus: normalize(byStatus),
    byPriority: normalize(byPriority),
    byType: normalize(byType),
  };
};

// Monthly Customers (line chart — last 6 months)
const getMonthlyCustomersData = async (req) => {
  const filter = await buildCustomerAccessFilter(req);
  const months = getLastNMonthsRange(6);
  const rangeStart = months[0];

  const results = await Customer.aggregate([
    {
      $match: {
        ...filter,
        createdAt: { $gte: rangeStart },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const resultMap = Object.fromEntries(
    results.map((r) => [`${r._id.year}-${r._id.month}`, r.count]),
  );

  return months.map((d) => ({
    month: formatMonthLabel(d),
    customers: resultMap[`${d.getFullYear()}-${d.getMonth() + 1}`] ?? 0,
  }));
};

// Top Performers (Admin / Sales Manager only)
const getTopPerformersData = async (req) => {
  const { role, userId } = req.user;
  if (role === "Sales Agent") return null;

  let agentFilter = {};

  if (role === "Sales Manager") {
    const agentIds = await getTeamAgentIdsForManager(userId);
    if (!agentIds.length) return [];

    agentFilter = {
      convertedBy: {
        $in: agentIds.map((id) => new mongoose.Types.ObjectId(id)),
      },
    };
  }

  const results = await Lead.aggregate([
    {
      $match: {
        status: "Converted",
        convertedBy: { $ne: null },
        ...agentFilter,
      },
    },
    {
      $group: {
        _id: "$convertedBy",
        conversions: { $sum: 1 },
      },
    },
    { $sort: { conversions: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        firstName: "$user.firstName",
        middleName: "$user.middleName",
        lastName: "$user.lastName",
        suffix: "$user.suffix",
        employeeId: "$user.employeeId",
        profilePicture: "$user.profilePicture",
        role: "$user.role",
        status: "$user.status",
        team: "$user.team",
        conversions: 1,
      },
    },
  ]);

  return results;
};

// Recent Activity (scoped)
const getRecentActivity = async (req) => {
  const { role, userId } = req.user;
  let activityFilter = {};

  if (role === "Sales Agent") {
    activityFilter = { createdBy: new mongoose.Types.ObjectId(userId) };
  } else if (role === "Sales Manager") {
    const agentIds = await getTeamAgentIdsForManager(userId);
    const managerObjId = new mongoose.Types.ObjectId(userId);
    const agentObjIds = agentIds.map((id) => new mongoose.Types.ObjectId(id));

    activityFilter = {
      createdBy: { $in: [managerObjId, ...agentObjIds] },
    };
  }

  const activities = await Activity.find(activityFilter)
    .sort({ activityDate: -1 })
    .limit(10)
    .populate("createdBy", "firstName lastName profilePicture role employeeId")
    .lean();

  return activities;
};

// Lead Source Breakdown (pie chart)
const getLeadSourceData = async (req) => {
  const filter = await buildLeadAccessFilter(req);

  const results = await Lead.aggregate([
    { $match: filter },
    { $group: { _id: "$leadSource", count: { $sum: 1 } } },
  ]);

  const countMap = Object.fromEntries(
    results.map((r) => [r._id ?? "Other", r.count]),
  );

  return LEAD_SOURCE_CONFIG.filter((src) => countMap[src.name] != null).map(
    (src) => ({
      name: src.name,
      value: countMap[src.name],
      color: src.color,
    }),
  );
};

// 🟢 PINAHUSAY: Helper para sa pagkuha ng scoped Meetings list (Safe version)
const getMeetingsData = async (req) => {
  const { role, userId } = req.user;
  let meetingFilter = {};

  // Nililimitahan ang makikitang meetings base sa role
  if (role === "Sales Agent") {
    // Tiyaking kung hindi 'assignedTo' ang user field sa Meeting mo, palitan ito (hal. host: userId)
    meetingFilter = { 
      $or: [
        { assignedTo: new mongoose.Types.ObjectId(userId) },
        { host: new mongoose.Types.ObjectId(userId) }
      ]
    };
  } else if (role === "Sales Manager") {
    const agentIds = await getTeamAgentIdsForManager(userId);
    const managerObjId = new mongoose.Types.ObjectId(userId);
    const agentObjIds = agentIds.map((id) => new mongoose.Types.ObjectId(id));
    const allIds = [managerObjId, ...agentObjIds];

    meetingFilter = {
      $or: [
        { assignedTo: { $in: allIds } },
        { host: { $in: allIds } }
      ]
    };
  }

  // Idinagdag ang { strictPopulate: false } para hindi mag-error ang application
  // kung sakaling walang field na 'assignedTo' o 'relatedToClient' sa database collection schema mo ngayon
  return await Meeting.find(meetingFilter)
    .sort({ date: 1 })
    .limit(10)
    .populate({ path: "assignedTo", select: "firstName lastName profilePicture", options: { strictPopulate: false } })
    .populate({ path: "host", select: "firstName lastName profilePicture", options: { strictPopulate: false } })
    .populate({ path: "relatedToClient", select: "firstName lastName companyName", options: { strictPopulate: false } })
    .lean();
};

// Main Dashboard Controller
// Main Dashboard Controller
const getDashboardStats = async (req, res) => {
  try {
    const { role } = req.user;
    
    // Kunin ang task access filter para sa listahan
    const taskFilter = await buildTaskAccessFilter(req);

    // Isinabay ang pag-fetch sa kpi, charts, activities, meetings, at ngayon ang mismong TASKS list
    const [
      kpi,
      leadFunnel,
      monthlyLeads,
      monthlyCustomers,
      dealPipeline,
      taskBreakdown,
      leadSources,
      recentActivity,
      meetings,
      tasksList, // 🟢 DAGDAG: Kukunin na natin ang aktwal na listahan ng tasks
      topPerformers,
    ] = await Promise.all([
      getKpiStats(req),
      getLeadFunnelData(req),
      getMonthlyLeadsData(req),
      getMonthlyCustomersData(req),
      getDealPipelineData(req),
      getTaskBreakdownData(req),
      getLeadSourceData(req),
      getRecentActivity(req),
      getMeetingsData(req),
      Task.find(taskFilter).sort({ dueDate: 1 }).limit(10).lean(), // 🟢 DAGDAG: Query para sa listahan ng tasks
      role !== "Sales Agent"
        ? getTopPerformersData(req)
        : Promise.resolve(null),
    ]);

    res.status(200).json({
      kpi,

      charts: {
        leadFunnel,
        monthlyLeads,
        monthlyCustomers,
        dealPipeline,
        taskBreakdown,
        leadSources,
      },

      recentActivity,
      meetings,
      tasksList, // 🟢 DAGDAG: Dito natin ipapasa ang array ng tasks sa frontend layout panel

      // null para sa Sales Agent upang itago ang widget sa frontend panel
      topPerformers,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { getDashboardStats };
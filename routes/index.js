const authRoute = require("./authRoute");
const dashboardRoute = require("./dashboardRoute");
const userRoute = require("./userRoute");
const teamRoute = require("./teamRoute");
const leadRoute = require("./leadRoute");
const taskRoute = require("./taskRoute");
const clientRoute = require("./clientRoute"); // 🟢 In-update ang variable name mula customerRoute -> clientRoute
const quotationRoute = require("./quotationRoute");
const activityRoute = require("./activityRoute");
const notificationRoute = require("./notificationRoute");
const settingsRoute = require("./settingsRoute");

const indexRoutes = (app) => {
  app.use("/api/auth", authRoute);
  app.use("/api/dashboard", dashboardRoute);
  app.use("/api/users", userRoute);
  app.use("/api/teams", teamRoute);
  app.use("/api/leads", leadRoute);
  app.use("/api/tasks", taskRoute);
  app.use("/api/clients", clientRoute); // 🟢 FIX: therefore /api/clients /api/customers
  app.use("/api/quotations", quotationRoute);
  app.use("/api/activities", activityRoute);
  app.use("/api/notifications", notificationRoute);
  app.use("/api/settings", settingsRoute);
};

module.exports = indexRoutes;
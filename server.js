require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

require("./listeners/activityListener");
require("./listeners/notificationListener");

const indexRoutes = require("./routes/index");
const leadRoutes = require("./routes/leadRoute");
const prospectRoutes = require("./routes/prospectRoute");
const quotationRoutes = require("./routes/quotationRoute");
const clientRoutes = require("./routes/clientRoute");
const callRoutes = require("./routes/callRoute");
const meetingRoutes = require("./routes/meetingRoute");
const taskRoutes = require("./routes/taskRoute"); // Newly added route for tasks
const dashboardRoutes = require("./routes/dashboardRoute");
const userRoutes = require("./routes/userRoute");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://192.168.1.196:5173",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

const io = new Server(server, {
  cors: corsOptions,
});

app.set("io", io);

app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  console.log(req.path, req.method);
  next();
});

app.use("/api/prospects", prospectRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes); //newly added route for tasks
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

indexRoutes(app);

require("./socket")(io);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;

    server.listen(port, "0.0.0.0", () => {
      console.log("Connected to MongoDB and listening on port " + port);
      console.log("LAN API: http://192.168.1.196:" + port);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
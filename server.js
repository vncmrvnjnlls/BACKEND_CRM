// require("dotenv").config();

// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const cookieParser = require("cookie-parser");

// require("./listeners/activityListener");
// require("./listeners/notificationListener");

// const indexRoutes = require("./routes/index");
// const leadRoutes = require("./routes/leadRoute");
// const prospectRoutes = require("./routes/prospectRoute");
// const quotationRoutes = require("./routes/quotationRoute");
// const clientRoutes = require("./routes/clientRoute");
// const callRoutes = require("./routes/callRoute");
// const meetingRoutes = require("./routes/meetingRoute");
// const taskRoutes = require("./routes/taskRoute"); // Newly added route for tasks
// const dashboardRoutes = require("./routes/dashboardRoute");
// const userRoutes = require("./routes/userRoute");

// const app = express();
// const server = http.createServer(app);

// const allowedOrigins = [
//   process.env.CLIENT_URL,
//   "http://localhost:5173",
//   "http://127.0.0.1:5173",
//   "http://localhost:5174",
//   "http://127.0.0.1:5174",
//   "http://192.168.1.196:5173",
// ].filter(Boolean);

// const corsOptions = {
//   origin(origin, callback) {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//       return;
//     }

//     callback(new Error(`CORS blocked origin: ${origin}`));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

// const io = new Server(server, {
//   cors: corsOptions,
// });

// app.set("io", io);

// app.use(cors(corsOptions));

// app.use(express.json());
// app.use(cookieParser());
// app.use("/uploads", express.static("uploads"));

// app.use((req, res, next) => {
//   console.log(req.path, req.method);
//   next();
// });

// app.use("/api/prospects", prospectRoutes);
// app.use("/api/leads", leadRoutes);
// app.use("/api/quotations", quotationRoutes);
// app.use("/api/clients", clientRoutes);
// app.use("/api/calls", callRoutes);
// app.use("/api/meetings", meetingRoutes);
// app.use("/api/tasks", taskRoutes); //newly added route for tasks
// app.use("/api/dashboard", dashboardRoutes);
// app.use("/api/users", userRoutes);

// indexRoutes(app);

// require("./socket")(io);

// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => {
//     const port = process.env.PORT || 5000;

//     // Ensure the unique index on clients.email is removed so duplicate emails are allowed
//     const db = mongoose.connection.db;
//     db.listCollections({ name: "clients" })
//       .toArray()
//       .then((cols) => {
//         if (cols.length > 0) {
//           const coll = db.collection("clients");
//           coll.indexes()
//             .then((indexes) => {
//               indexes.forEach((ix) => {
//                 // index key might be { email: 1 } and name often 'email_1'
//                 if (ix.unique && ix.key && ix.key.email) {
//                   try {
//                     coll.dropIndex(ix.name).then(() => {
//                       console.log(`Dropped unique index ${ix.name} on clients.email`);
//                     }).catch(() => {});
//                   } catch (e) {
//                     // ignore
//                   }
//                 }
//               });
//             })
//             .catch(() => {});
//         }
//       })
//       .catch(() => {});

//     server.listen(port, "0.0.0.0", () => {
//       console.log("Connected to MongoDB and listening on port " + port);
//       // console.log("LAN API: http://192.168.1.196:" + port);
//     });
//   })
//   .catch((error) => {
//     console.error("Error connecting to MongoDB:", error);
//   });




require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const os = require("os");

// ✅ Use global fetch if Node >=18, otherwise fallback to node-fetch
let fetchFn;
try {
  fetchFn = fetch; // Node 18+ has fetch built-in
} catch {
  fetchFn = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

require("./listeners/activityListener");
require("./listeners/notificationListener");

const indexRoutes = require("./routes/index");
const leadRoutes = require("./routes/leadRoute");
const prospectRoutes = require("./routes/prospectRoute");
const quotationRoutes = require("./routes/quotationRoute");
const clientRoutes = require("./routes/clientRoute");
const callRoutes = require("./routes/callRoute");
const meetingRoutes = require("./routes/meetingRoute");
const taskRoutes = require("./routes/taskRoute");
const dashboardRoutes = require("./routes/dashboardRoute");
const userRoutes = require("./routes/userRoute");


const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://192.168.1.196:5173",
  "http://192.168.1.37:5173",
  "http://192.168.1.144:5173",
   "http://172.26.171.106:5173",

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


const io = new Server(server, { cors: corsOptions });
app.set("io", io);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

// ✅ Log HTTP request IPs
app.use((req, res, next) => {
  console.log(`HTTP ${req.method} ${req.path} from IP: ${req.ip}`);
  next();
});

app.use("/api/prospects", prospectRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/calls", callRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/users", userRoutes);

indexRoutes(app);
require("./socket")(io);

// ✅ LAN IP helper
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// ✅ Public IP helper
async function getPublicIP() {
  try {
    const res = await fetchFn("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch (err) {
    console.error("Error fetching public IP:", err);
    return "Unavailable";
  }
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const port = process.env.PORT || 5000;

    // Drop unique index on clients.email if exists
    const db = mongoose.connection.db;
    db.listCollections({ name: "clients" })
      .toArray()
      .then((cols) => {
        if (cols.length > 0) {
          const coll = db.collection("clients");
          coll.indexes()
            .then((indexes) => {
              indexes.forEach((ix) => {
                if (ix.unique && ix.key && ix.key.email) {
                  coll.dropIndex(ix.name)
                    .then(() => console.log(`Dropped unique index ${ix.name} on clients.email`))
                    .catch(() => {});
                }
              });
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    server.listen(port, "0.0.0.0", async () => {
      const lanIP = getLocalIP();
      const publicIP = await getPublicIP();

      console.log("Connected to MongoDB and listening on port " + port);
      console.log(`LAN API: http://${lanIP}:${port}`);
      console.log(`Public API: http://${publicIP}:${port}`);
    });

    // ✅ Log Socket.IO client IPs
    io.on("connection", (socket) => {
      console.log(`Socket.IO user connected from IP: ${socket.handshake.address}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });





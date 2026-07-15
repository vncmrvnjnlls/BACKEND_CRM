const jwt = require("jsonwebtoken");
const socketManager = require("./utils/socketManager");

module.exports = (io) => {
  socketManager.init(io);

  // Auth middleware on handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const { userId, teamId } = socket.user;
    console.log(`[WS] Connected: ${userId}`);

    if (teamId) socket.join(`team:${teamId}`);
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      console.log(`[WS] Disconnected: ${userId}`);
    });
  });

  // Load the bridge
  require("./listeners/socketListener");
};

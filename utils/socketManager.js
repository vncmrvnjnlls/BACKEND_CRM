let io;

/**
 * Initialize Socket.IO instance
 * Called in socket.js during server startup
 * @param {Object} ioInstance - Socket.IO server instance
 */
const init = (ioInstance) => {
  io = ioInstance;
};

/**
 * Get Socket.IO instance
 * Used by event listeners to broadcast events to connected clients
 * @returns {Object} Socket.IO server instance
 * @throws {Error} If Socket.IO not initialized
 * 
 * @example
 * const io = getIO();
 * io.to(userId).emit('lead:created', leadData);
 */
const getIO = () => {
  if (!io) throw new Error("Socket.IO not initialized");
  return io;
};

module.exports = { init, getIO };

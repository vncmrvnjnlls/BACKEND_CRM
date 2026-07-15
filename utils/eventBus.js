const EventEmitter = require("events");

/**
 * Application Event Bus - In-memory event emitter for internal communication
 * 
 * Used to decouple controllers from real-time features:
 * 1. Controller emits event (e.g., 'lead:created')
 * 2. Event listeners (in listeners/) handle the event
 * 3. Listeners emit Socket.IO events to connected clients
 * 
 * This pattern allows controllers to focus on business logic
 * without knowing about WebSocket details
 * 
 * @example
 * const eventBus = require('../utils/eventBus');
 * const events = require('../constants/events');
 * 
 * // Emit event
 * eventBus.emit(events.LEAD_CREATED, {
 *   leadId: lead._id,
 *   userId: req.user.userId,
 *   teamId: req.user.teamId
 * });
 */
class AppEventBus extends EventEmitter {}

const eventBus = new AppEventBus();
// 🟢 DAGDAG: Taasan ang limit mula 10 patungong 20 para iwas memory leak warning 
// habang may mga 'undefined' events pa tayong inaayos sa mga controllers at listeners.
// eventBus.setMaxListeners(20);

module.exports = eventBus;

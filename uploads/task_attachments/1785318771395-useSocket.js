import { useEffect } from "react";
import { useSocketContext } from "../context/SocketContext";

/**
 * useSocket - Subscribe to WebSocket events
 * 
 * Automatically subscribes to a socket event and cleans up on component unmount
 * Safe to call multiple times - each subscription is managed independently
 * 
 * @param {string} event - Event name (e.g., 'lead:created', 'task:updated')
 * @param {Function} handler - Callback function when event is received
 * @returns {void}
 * 
 * @example
 * // Listen for new leads
 * useSocket('lead:created', (leadData) => {
 *   console.log('New lead:', leadData);
 *   refetchLeads();
 * });
 * 
 * @example
 * // Listen for task assignments
 * useSocket('task:assigned', (taskData) => {
 *   showNotification(`Task assigned: ${taskData.name}`);
 * });
 */
export function useSocket(event, handler) {
  const socketRef = useSocketContext();

  useEffect(() => {
    const socket = socketRef?.current;

    if (!socket || !event || !handler) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socketRef, event, handler]);
}

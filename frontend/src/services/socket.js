import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function connectSocket({
  onConnect = () => {},
  onDisconnect = () => {},
  onFlights = () => {},
  onSatellites = () => {},
  onEarthquakes = () => {},
} = {}) {
  const socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
  });

  socket.on("connect", onConnect);
  socket.on("disconnect", onDisconnect);

  socket.on("flights:update", onFlights);
  socket.on("satellites:update", onSatellites);
  socket.on("earthquakes:update", onEarthquakes);

  return socket;
}

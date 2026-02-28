import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import { startFlightService } from "./services/flightService.js";
import { startSatelliteService } from "./services/satelliteService.js";
import { startEarthquakeService } from "./services/earthquakeService.js";

dotenv.config({ quiet: true });

const PORT = 5000;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "worldscope-backend" });
});

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected: ${socket.id} (${reason})`);
  });
});

const services = [
  startFlightService(io),
  startSatelliteService(io),
  startEarthquakeService(io),
];

httpServer.listen(PORT, () => {
  console.log(`WorldScope backend listening on http://localhost:${PORT}`);
});

function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down...`);

  for (const service of services) {
    service.stop();
  }

  io.close(() => {
    httpServer.close(() => {
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

import axios from "axios";
import { clearOpenSkyTokenCache, getOpenSkyToken } from "./openSkyAuth.js";

const OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all";
const POLL_INTERVAL_MS = 60_000;
const MAX_FLIGHTS = 5000;

async function fetchFlights() {
  const token = await getOpenSkyToken();

  const { data } = await axios.get(OPENSKY_STATES_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    timeout: 9_000,
  });

  const states = Array.isArray(data?.states) ? data.states : [];

  return states
    .map((state) => {
      const callsign = typeof state[1] === "string" ? state[1].trim() : "";
      const longitude = state[5];
      const latitude = state[6];
      const altitude = typeof state[13] === "number" ? state[13] : state[7] ?? 0;

      return {
        callsign,
        longitude,
        latitude,
        altitude,
      };
    })
    .filter(
      (flight) =>
        flight.callsign &&
        typeof flight.latitude === "number" &&
        typeof flight.longitude === "number" &&
        Number.isFinite(flight.latitude) &&
        Number.isFinite(flight.longitude),
    )
    .sort((a, b) => (b.altitude || 0) - (a.altitude || 0))
    .slice(0, MAX_FLIGHTS);
}

export function startFlightService(io) {
  let timer;
  let stopped = false;

  const schedule = (delayMs) => {
    if (stopped) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  };

  const run = async () => {
    try {
      const flights = await fetchFlights();
      io.emit("flights:update", flights);
      schedule(POLL_INTERVAL_MS);
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;

      if (status === 429) {
        console.warn("[flights] rate limited");
        schedule(POLL_INTERVAL_MS);
        return;
      }

      if (status === 401) {
        clearOpenSkyTokenCache();
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error(`[flights] fetch failed: ${message}`);
      schedule(POLL_INTERVAL_MS);
    }
  };

  run();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

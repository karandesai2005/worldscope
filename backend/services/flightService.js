import axios from "axios";

const OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all";
const POLL_INTERVAL_MS = 10_000;

async function fetchFlights() {
  const { data } = await axios.get(OPENSKY_STATES_URL, {
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
    );
}

export function startFlightService(io) {
  let timer;

  const run = async () => {
    try {
      const flights = await fetchFlights();
      io.emit("flights:update", flights);
      console.log(`[flights] emitted ${flights.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[flights] fetch failed: ${message}`);
    }
  };

  run();
  timer = setInterval(run, POLL_INTERVAL_MS);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

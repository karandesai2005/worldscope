import axios from "axios";
import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
} from "satellite.js";

const TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
const POSITION_INTERVAL_MS = 1_000;
const TLE_REFRESH_INTERVAL_MS = 60 * 60 * 1_000;
const MAX_SATELLITES = 120;

let satellites = [];

async function refreshSatellites() {
  const { data } = await axios.get(TLE_URL, {
    timeout: 12_000,
    responseType: "text",
  });

  const lines = String(data)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = [];

  for (let i = 0; i + 2 < lines.length && parsed.length < MAX_SATELLITES; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1?.startsWith("1 ") || !line2?.startsWith("2 ")) {
      continue;
    }

    const satrec = twoline2satrec(line1, line2);
    const noradId = line1.slice(2, 7).trim();

    parsed.push({
      id: noradId || String(parsed.length + 1),
      name,
      satrec,
    });
  }

  satellites = parsed;
  console.log(`[satellites] refreshed TLE catalog (${satellites.length})`);
}

function computePositions(now = new Date()) {
  const gmst = gstime(now);

  return satellites
    .map((sat) => {
      const propagation = propagate(sat.satrec, now);
      const positionEci = propagation.position;

      if (!positionEci) {
        return null;
      }

      const geodetic = eciToGeodetic(positionEci, gmst);

      return {
        id: sat.id,
        name: sat.name,
        latitude: degreesLat(geodetic.latitude),
        longitude: degreesLong(geodetic.longitude),
        altitude: geodetic.height,
      };
    })
    .filter(
      (entry) =>
        entry &&
        Number.isFinite(entry.latitude) &&
        Number.isFinite(entry.longitude) &&
        Number.isFinite(entry.altitude),
    );
}

export function startSatelliteService(io) {
  let positionTimer;
  let refreshTimer;

  const emitPositions = () => {
    if (satellites.length === 0) {
      return;
    }

    const positions = computePositions();
    io.emit("satellites:update", positions);
  };

  const safeRefresh = async () => {
    try {
      await refreshSatellites();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[satellites] TLE refresh failed: ${message}`);
    }
  };

  safeRefresh();

  positionTimer = setInterval(emitPositions, POSITION_INTERVAL_MS);
  refreshTimer = setInterval(safeRefresh, TLE_REFRESH_INTERVAL_MS);

  return {
    stop() {
      clearInterval(positionTimer);
      clearInterval(refreshTimer);
    },
  };
}

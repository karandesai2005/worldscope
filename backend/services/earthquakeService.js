import axios from "axios";

const USGS_ALL_DAY_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const POLL_INTERVAL_MS = 30_000;

async function fetchEarthquakes() {
  const { data } = await axios.get(USGS_ALL_DAY_URL, {
    timeout: 9_000,
  });

  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .map((feature) => {
      const coordinates = feature?.geometry?.coordinates || [];

      return {
        id: feature?.id,
        magnitude: feature?.properties?.mag,
        place: feature?.properties?.place,
        time: feature?.properties?.time,
        longitude: coordinates[0],
        latitude: coordinates[1],
        depth: coordinates[2],
      };
    })
    .filter(
      (quake) =>
        quake.id &&
        typeof quake.latitude === "number" &&
        typeof quake.longitude === "number" &&
        Number.isFinite(quake.latitude) &&
        Number.isFinite(quake.longitude),
    );
}

export function startEarthquakeService(io) {
  let timer;

  const run = async () => {
    try {
      const earthquakes = await fetchEarthquakes();
      io.emit("earthquakes:update", earthquakes);
      console.log(`[earthquakes] emitted ${earthquakes.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[earthquakes] fetch failed: ${message}`);
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

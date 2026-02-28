import {
  Cartesian3,
  Color,
  Ellipsoid,
  EllipsoidalOccluder,
  NearFarScalar,
  PointPrimitiveCollection,
} from "cesium";

const STALE_AFTER_MS = 30_000;
const MAX_RENDERED_FLIGHTS = 5_000;
const CAMERA_REFRESH_DEBOUNCE_MS = 120;

const FLIGHT_CORE_COLOR = Color.fromCssColorString("rgba(57,255,20,0.82)");
const FLIGHT_GLOW_COLOR = Color.fromCssColorString("rgba(57,255,20,0.24)");

export function createFlightLayer(viewer) {
  const glowCollection = viewer.scene.primitives.add(new PointPrimitiveCollection());
  const coreCollection = viewer.scene.primitives.add(new PointPrimitiveCollection());

  const flightsById = new Map();

  let visible = true;
  let pendingFlights = null;
  let refreshQueued = false;
  let cameraRefreshTimer;

  const ensurePrimitives = (record) => {
    if (!record.glow) {
      record.glow = glowCollection.add({
        id: record.id,
        position: record.position,
        color: FLIGHT_GLOW_COLOR,
        pixelSize: 7,
        show: visible,
        scaleByDistance: new NearFarScalar(1.0e6, 1.0, 1.8e7, 0.34),
      });
    }

    if (!record.core) {
      record.core = coreCollection.add({
        id: record.id,
        position: record.position,
        color: FLIGHT_CORE_COLOR,
        pixelSize: 2.5,
        show: visible,
        outlineColor: Color.fromCssColorString("rgba(219,255,209,0.75)"),
        outlineWidth: 0.5,
        scaleByDistance: new NearFarScalar(1.0e6, 1.0, 1.8e7, 0.4),
      });
    }
  };

  const destroyPrimitives = (record) => {
    if (record.glow) {
      glowCollection.remove(record.glow);
      record.glow = null;
    }

    if (record.core) {
      coreCollection.remove(record.core);
      record.core = null;
    }
  };

  const pruneStale = (now = Date.now()) => {
    for (const [id, record] of flightsById) {
      if (now - record.lastSeen <= STALE_AFTER_MS) {
        continue;
      }

      destroyPrimitives(record);
      flightsById.delete(id);
    }
  };

  const applyPendingFlights = () => {
    if (!pendingFlights) {
      return;
    }

    const now = Date.now();

    for (const flight of pendingFlights) {
      const callsign = (flight.callsign || "").trim();
      if (!callsign || typeof flight.latitude !== "number" || typeof flight.longitude !== "number") {
        continue;
      }

      const id = `flight-${callsign}`;
      const altitude = typeof flight.altitude === "number" ? Math.max(flight.altitude, 0) : 0;
      const position = Cartesian3.fromDegrees(flight.longitude, flight.latitude, altitude);

      let record = flightsById.get(id);
      if (!record) {
        record = {
          id,
          callsign,
          position,
          lastSeen: now,
          core: null,
          glow: null,
        };
        flightsById.set(id, record);
        ensurePrimitives(record);
      } else {
        record.position = position;
        record.callsign = callsign;
        record.lastSeen = now;
      }
    }

    pendingFlights = null;
    pruneStale(now);
  };

  const refreshVisibleSet = () => {
    const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, viewer.camera.positionWC);
    let rendered = 0;

    for (const record of flightsById.values()) {
      ensurePrimitives(record);

      const showPoint =
        visible && rendered < MAX_RENDERED_FLIGHTS && occluder.isPointVisible(record.position);

      if (!showPoint) {
        record.core.show = false;
        record.glow.show = false;
        continue;
      }

      record.core.position = record.position;
      record.glow.position = record.position;
      record.core.show = true;
      record.glow.show = true;
      rendered += 1;
    }

    coreCollection.show = visible;
    glowCollection.show = visible;
  };

  const queueRefresh = () => {
    if (refreshQueued) {
      return;
    }

    refreshQueued = true;
    requestAnimationFrame(() => {
      refreshQueued = false;
      applyPendingFlights();
      refreshVisibleSet();
      viewer.scene.requestRender();
    });
  };

  viewer.camera.changed.addEventListener(() => {
    clearTimeout(cameraRefreshTimer);
    cameraRefreshTimer = setTimeout(queueRefresh, CAMERA_REFRESH_DEBOUNCE_MS);
  });

  setInterval(() => {
    pruneStale();
    queueRefresh();
  }, 5_000);

  return {
    update(flights = []) {
      pendingFlights = flights;
      queueRefresh();
    },
    setVisible(nextVisible) {
      visible = nextVisible;
      queueRefresh();
    },
    count() {
      return flightsById.size;
    },
  };
}

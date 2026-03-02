/*
  flightLayer.js is designed for high‑volume, production‑safe rendering of
  aircraft points without leaking memory or degrading performance.

  Two maps keep data separated:
    • flightsById      - lightweight render records (id, position, lastSeen,
                         primitive references).  No backend payload is stored
                         on Cesium primitives, preventing internal GC issues.
    • flightDetailsById- full backend flight object used only by the UI panel.

  Updates mutate existing primitives (position/color) and never recreate them
  during normal operation.  A hard cap on stored/rendered flights plus a
  periodic prune keeps memory usage stable even with ~5 000 concurrent
  tracks.
*/

import {
  Cartesian3,
  Color,
  Ellipsoid,
  EllipsoidalOccluder,
  NearFarScalar,
  PointPrimitiveCollection,
} from "cesium";

const STALE_AFTER_MS = 30_000;
const PRUNE_INTERVAL_MS = 5_000;
const CAMERA_REFRESH_INTERVAL_MS = 250;

const MAX_RENDERED_FLIGHTS = 5_000;
const MAX_STORED_FLIGHTS = 5_000;

const ENABLE_GLOW = false;

const COMMERCIAL_COLOR = Color.fromCssColorString("rgba(57,255,20,0.82)");
const HEAVY_COLOR = Color.fromCssColorString("rgba(0,229,255,0.84)");
const MILITARY_COLOR = Color.fromCssColorString("rgba(255,92,92,0.88)");
const GOVERNMENT_COLOR = Color.fromCssColorString("rgba(255,170,46,0.9)");
const UAV_COLOR = Color.fromCssColorString("rgba(255,220,77,0.92)");
const DEFAULT_GLOW_COLOR = Color.fromCssColorString("rgba(57,255,20,0.24)");
const FLIGHT_OUTLINE_COLOR = Color.fromCssColorString("rgba(219,255,209,0.75)");

const GOVERNMENT_ORIGIN_COUNTRIES = new Set(["united states", "russia", "iran", "israel"]);
const MILITARY_CALLSIGN_PREFIXES = /^(RCH|CFC|LAGR|NATO|ARES|FORTE|KING)/i;

const CLASSIFICATION_STYLES = {
  Commercial: { type: "Commercial", color: COMMERCIAL_COLOR, badgeColor: "#39ff14" },
  Heavy: { type: "Heavy", color: HEAVY_COLOR, badgeColor: "#00e5ff" },
  Military: { type: "Military", color: MILITARY_COLOR, badgeColor: "#ff5c5c" },
  Government: { type: "Government", color: GOVERNMENT_COLOR, badgeColor: "#ffaa2e" },
  UAV: { type: "UAV", color: UAV_COLOR, badgeColor: "#ffdc4d" },
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeIdSegment(value) {
  return normalizeString(value).toLowerCase().replace(/\s+/g, "-");
}

function normalizeCategory(value) {
  const category = Number(value);
  return Number.isFinite(category) ? category : null;
}

function buildFlightId(flight) {
  const icao24 = normalizeIdSegment(flight?.icao24);
  if (icao24) {
    return `flight-${icao24}`;
  }

  const callsign = normalizeIdSegment(flight?.callsign);
  if (!callsign) {
    return "";
  }

  const originCountry = normalizeIdSegment(flight?.origin_country) || "unknown";
  return `flight-callsign-${callsign}-${originCountry}`;
}

export function classifyFlight(flight) {
  const category = normalizeCategory(flight?.category);
  const callsign = normalizeString(flight?.callsign).toUpperCase();
  const originCountry = normalizeString(flight?.origin_country).toLowerCase();

  if (category === 14) {
    return CLASSIFICATION_STYLES.UAV;
  }

  if (category === 6) {
    return CLASSIFICATION_STYLES.Heavy;
  }

  if (MILITARY_CALLSIGN_PREFIXES.test(callsign)) {
    return CLASSIFICATION_STYLES.Military;
  }

  if (
    GOVERNMENT_ORIGIN_COUNTRIES.has(originCountry) &&
    category !== null &&
    category <= 6
  ) {
    return CLASSIFICATION_STYLES.Government;
  }

  return CLASSIFICATION_STYLES.Commercial;
}

function toFlightDetails(id, flight, classification, now) {
  // Build a shallow copy of the backend payload and augment it with
  // classification metadata.  This object lives in `flightDetailsById` only.
  // Cesium primitives reference only the minimal record stored in
  // `flightsById` above, so we never attach these potentially large
  // payloads to Cesium entities which could bloat memory over time.
  return {
    ...flight,
    id,
    classificationType: classification.type,
    classificationBadgeColor: classification.badgeColor,
    updatedAt: now,
  };
}

export function createFlightLayer(viewer) {
  const coreCollection = viewer.scene.primitives.add(new PointPrimitiveCollection());
  const glowCollection = ENABLE_GLOW
    ? viewer.scene.primitives.add(new PointPrimitiveCollection())
    : null;

  const flightsById = new Map();
  const flightDetailsById = new Map();

  let visible = true;
  let pendingFlights = null;
  let refreshQueued = false;
  let lastCameraRefreshAt = 0;
  let cameraRefreshTimer = null;
  let pruneTimer = null;
  let destroyed = false;

  const removeCameraChangedListener = viewer.camera.changed.addEventListener(() => {
    if (destroyed) {
      return;
    }

    // Camera events are noisy; hard throttling protects render loops from burst refreshes.
    const now = Date.now();
    const elapsed = now - lastCameraRefreshAt;

    if (elapsed >= CAMERA_REFRESH_INTERVAL_MS) {
      lastCameraRefreshAt = now;
      queueRefresh();
      return;
    }

    clearTimeout(cameraRefreshTimer);
    cameraRefreshTimer = setTimeout(() => {
      lastCameraRefreshAt = Date.now();
      queueRefresh();
    }, CAMERA_REFRESH_INTERVAL_MS - elapsed);
  });

  const createRecord = (id, position, color, now) => {
    const core = coreCollection.add({
      id,
      position,
      color,
      pixelSize: 2.5,
      show: visible,
      outlineColor: FLIGHT_OUTLINE_COLOR,
      outlineWidth: 0.5,
      scaleByDistance: new NearFarScalar(1.0e6, 1.0, 1.8e7, 0.4),
    });

    const glow = glowCollection
      ? glowCollection.add({
          id,
          position,
          color: DEFAULT_GLOW_COLOR,
          pixelSize: 7,
          show: visible,
          scaleByDistance: new NearFarScalar(1.0e6, 1.0, 1.8e7, 0.34),
        })
      : null;

    // Rendering map intentionally stores only primitives and positioning metadata.
    return {
      id,
      position,
      lastSeen: now,
      core,
      glow,
    };
  };

  const removeRecordById = (id, record) => {
    if (record.core) {
      coreCollection.remove(record.core);
      record.core = null;
    }

    if (record.glow && glowCollection) {
      glowCollection.remove(record.glow);
      record.glow = null;
    }

    flightsById.delete(id);
    flightDetailsById.delete(id);
  };

  const evictOldest = (targetSize = MAX_STORED_FLIGHTS) => {
    // Hard cap on both maps prevents long-run growth during continuous operation.
    while (flightsById.size > targetSize) {
      let oldestId = "";
      let oldestSeen = Number.POSITIVE_INFINITY;

      for (const [id, record] of flightsById) {
        if (record.lastSeen < oldestSeen) {
          oldestSeen = record.lastSeen;
          oldestId = id;
        }
      }

      if (!oldestId) {
        break;
      }

      const oldestRecord = flightsById.get(oldestId);
      if (oldestRecord) {
        removeRecordById(oldestId, oldestRecord);
      } else {
        flightsById.delete(oldestId);
        flightDetailsById.delete(oldestId);
      }
    }
  };

  const pruneStale = (now = Date.now()) => {
    for (const [id, record] of flightsById) {
      if (now - record.lastSeen <= STALE_AFTER_MS) {
        continue;
      }

      removeRecordById(id, record);
    }

    evictOldest();
  };

  const applyPendingFlights = () => {
    if (!pendingFlights || destroyed) {
      return;
    }

    const flights = Array.isArray(pendingFlights) ? pendingFlights : [];
    pendingFlights = null;

    const now = Date.now();
    const idsSeenInBatch = new Set();

    for (const flight of flights) {
      const latitude = flight?.latitude;
      const longitude = flight?.longitude;

      if (
        typeof latitude !== "number" ||
        typeof longitude !== "number" ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        continue;
      }

      const id = buildFlightId(flight);
      if (!id || idsSeenInBatch.has(id)) {
        continue;
      }

      idsSeenInBatch.add(id);

      const altitudeRaw = flight?.altitude;
      const altitude =
        typeof altitudeRaw === "number" && Number.isFinite(altitudeRaw)
          ? Math.max(altitudeRaw, 0)
          : 0;
      const position = Cartesian3.fromDegrees(longitude, latitude, altitude);

      const classification = classifyFlight(flight);
      const existing = flightsById.get(id);

      if (existing) {
        existing.position = position;
        existing.lastSeen = now;

        // Color updates are in-place; no primitive recreation.
        if (!Color.equals(existing.core.color, classification.color)) {
          existing.core.color = classification.color;
        }
      } else {
        if (flightsById.size >= MAX_STORED_FLIGHTS) {
          evictOldest(MAX_STORED_FLIGHTS - 1);
        }

        flightsById.set(id, createRecord(id, position, classification.color, now));
      }

      flightDetailsById.set(id, toFlightDetails(id, flight, classification, now));
    }

    pruneStale(now);
  };

  const refreshVisibleSet = () => {
    if (destroyed) {
      return;
    }

    if (!visible) {
      for (const record of flightsById.values()) {
        record.core.show = false;
        if (record.glow) {
          record.glow.show = false;
        }
      }

      coreCollection.show = false;
      if (glowCollection) {
        glowCollection.show = false;
      }
      return;
    }

    const occluder = new EllipsoidalOccluder(Ellipsoid.WGS84, viewer.camera.positionWC);
    let rendered = 0;

    for (const record of flightsById.values()) {
      const showPoint =
        rendered < MAX_RENDERED_FLIGHTS && occluder.isPointVisible(record.position);

      if (!showPoint) {
        record.core.show = false;
        if (record.glow) {
          record.glow.show = false;
        }
        continue;
      }

      // Visibility refresh only mutates position/show, keeping loop allocation-free.
      record.core.position = record.position;
      record.core.show = true;

      if (record.glow) {
        record.glow.position = record.position;
        record.glow.show = true;
      }

      rendered += 1;
    }

    coreCollection.show = true;
    if (glowCollection) {
      glowCollection.show = true;
    }
  };

  function queueRefresh() {
    if (destroyed || refreshQueued) {
      return;
    }

    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;

      if (destroyed) {
        return;
      }

      applyPendingFlights();
      refreshVisibleSet();
      viewer.scene.requestRender();
    });
  }

  pruneTimer = setInterval(() => {
    if (destroyed) {
      return;
    }

    pruneStale();
    queueRefresh();
  }, PRUNE_INTERVAL_MS);

  return {
    update(flights = []) {
      if (destroyed) {
        return;
      }

      pendingFlights = Array.isArray(flights) ? flights : [];
      queueRefresh();
    },
    setVisible(nextVisible) {
      if (destroyed) {
        return;
      }

      visible = Boolean(nextVisible);
      queueRefresh();
    },
    getFlightDetails(id) {
      if (typeof id !== "string") {
        return null;
      }

      return flightDetailsById.get(id) || null;
    },
    count() {
      return flightsById.size;
    },
    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;

      clearTimeout(cameraRefreshTimer);
      clearInterval(pruneTimer);

      if (typeof removeCameraChangedListener === "function") {
        removeCameraChangedListener();
      }

      for (const [id, record] of flightsById) {
        removeRecordById(id, record);
      }

      pendingFlights = null;
      viewer.scene.primitives.remove(coreCollection);

      if (glowCollection) {
        viewer.scene.primitives.remove(glowCollection);
      }
    },
  };
}

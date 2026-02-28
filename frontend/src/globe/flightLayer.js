import {
  BillboardGraphics,
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  HorizontalOrigin,
  LabelStyle,
  NearFarScalar,
  VerticalOrigin,
} from "cesium";

const STALE_AFTER_MS = 30_000;

const planeIcon = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#39ff14" d="M58 29L35 24 20 6h-6l7 18-12 4-8-6H0l4 10-4 10h1l8-6 12 4-7 18h6l15-18 23-5z"/></svg>`,
)}`;

export function createFlightLayer(viewer) {
  const dataSource = new CustomDataSource("flights");
  viewer.dataSources.add(dataSource);

  const seenAt = new Map();

  const ensureEntity = (id, callsign) => {
    const existing = dataSource.entities.getById(id);
    if (existing) {
      return existing;
    }

    return dataSource.entities.add({
      id,
      position: Cartesian3.fromDegrees(0, 0, 0),
      billboard: new BillboardGraphics({
        image: planeIcon,
        width: 20,
        height: 20,
        color: Color.fromCssColorString("#39ff14"),
        scaleByDistance: new NearFarScalar(1.0e6, 1.0, 1.2e7, 0.35),
        heightReference: HeightReference.NONE,
        verticalOrigin: VerticalOrigin.CENTER,
        horizontalOrigin: HorizontalOrigin.CENTER,
      }),
      label: {
        text: callsign,
        font: "11px JetBrains Mono, monospace",
        fillColor: Color.fromCssColorString("#dbe8ff"),
        outlineColor: Color.fromCssColorString("#05080f"),
        outlineWidth: 2,
        pixelOffset: new Cartesian2(0, -22),
        style: LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Color.fromCssColorString("rgba(5,8,15,0.55)"),
        scaleByDistance: new NearFarScalar(1.0e6, 1.0, 2.0e7, 0.0),
      },
    });
  };

  const pruneStale = () => {
    const now = Date.now();

    for (const [id, timestamp] of seenAt.entries()) {
      if (now - timestamp < STALE_AFTER_MS) {
        continue;
      }

      const entity = dataSource.entities.getById(id);
      if (entity) {
        dataSource.entities.remove(entity);
      }
      seenAt.delete(id);
    }
  };

  setInterval(pruneStale, 5_000);

  return {
    update(flights = []) {
      const now = Date.now();

      for (const flight of flights) {
        const callsign = (flight.callsign || "").trim();
        if (!callsign || typeof flight.latitude !== "number" || typeof flight.longitude !== "number") {
          continue;
        }

        const id = `flight-${callsign}`;
        const altitude = typeof flight.altitude === "number" ? flight.altitude : 0;

        const entity = ensureEntity(id, callsign);
        entity.position = Cartesian3.fromDegrees(flight.longitude, flight.latitude, altitude);
        entity.label.text = callsign;
        seenAt.set(id, now);
      }

      pruneStale();
    },
    setVisible(visible) {
      dataSource.show = visible;
    },
    count() {
      return seenAt.size;
    },
  };
}

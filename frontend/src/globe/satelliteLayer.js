import {
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  NearFarScalar,
} from "cesium";

const SATELLITE_COLOR = Color.fromCssColorString("#00e5ff");
const SATELLITE_OUTLINE = Color.fromCssColorString("rgba(205,253,255,0.95)");

export function createSatelliteLayer(viewer) {
  const dataSource = new CustomDataSource("satellites");
  viewer.dataSources.add(dataSource);

  const tracked = new Map();
  let visible = true;
  let pulsePhase = 0;

  setInterval(() => {
    pulsePhase += 0.35;
    const pixelSize = 6 + Math.sin(pulsePhase) * 1.1;

    for (const entity of tracked.values()) {
      entity.point.pixelSize = pixelSize;
    }

    if (visible && tracked.size > 0) {
      viewer.scene.requestRender();
    }
  }, 240);

  return {
    update(satellites = []) {
      const liveIds = new Set();

      for (const sat of satellites) {
        if (typeof sat.latitude !== "number" || typeof sat.longitude !== "number") {
          continue;
        }

        const id = `sat-${sat.id || sat.name}`;
        liveIds.add(id);

        let entity = tracked.get(id);

        if (!entity) {
          entity = dataSource.entities.add({
            id,
            position: Cartesian3.fromDegrees(0, 0, 0),
            point: {
              pixelSize: 6,
              color: SATELLITE_COLOR,
              outlineColor: SATELLITE_OUTLINE,
              outlineWidth: 1,
              glowPower: 0.38,
              heightReference: HeightReference.NONE,
              scaleByDistance: new NearFarScalar(1.0e6, 1.0, 3.0e7, 0.32),
            },
          });
          tracked.set(id, entity);
        }

        const altitudeMeters = typeof sat.altitude === "number" ? sat.altitude * 1000 : 550_000;
        entity.position = Cartesian3.fromDegrees(sat.longitude, sat.latitude, altitudeMeters);
      }

      for (const [id, entity] of tracked.entries()) {
        if (liveIds.has(id)) {
          continue;
        }

        dataSource.entities.remove(entity);
        tracked.delete(id);
      }
    },
    setVisible(nextVisible) {
      visible = nextVisible;
      dataSource.show = nextVisible;
      viewer.scene.requestRender();
    },
    count() {
      return tracked.size;
    },
  };
}

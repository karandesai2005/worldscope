import {
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  NearFarScalar,
} from "cesium";

export function createEarthquakeLayer(viewer) {
  const dataSource = new CustomDataSource("earthquakes");
  viewer.dataSources.add(dataSource);

  const tracked = new Set();

  return {
    update(quakes = []) {
      const liveIds = new Set();

      for (const quake of quakes) {
        if (typeof quake.latitude !== "number" || typeof quake.longitude !== "number") {
          continue;
        }

        const id = `quake-${quake.id}`;
        liveIds.add(id);

        let entity = dataSource.entities.getById(id);
        if (!entity) {
          entity = dataSource.entities.add({
            id,
            position: Cartesian3.fromDegrees(quake.longitude, quake.latitude, 0),
            ellipse: {
              semiMinorAxis: 1,
              semiMajorAxis: 1,
              material: Color.fromCssColorString("rgba(255,79,79,0.45)"),
              outline: true,
              outlineColor: Color.fromCssColorString("rgba(255,120,120,0.9)"),
              heightReference: HeightReference.CLAMP_TO_GROUND,
            },
            point: {
              pixelSize: 4,
              color: Color.fromCssColorString("#ff4f4f"),
              scaleByDistance: new NearFarScalar(1.0e6, 1.0, 2.0e7, 0.25),
            },
            description: "",
          });
        }

        const mag = typeof quake.magnitude === "number" ? quake.magnitude : 0;
        const radius = Math.max(8_000, mag * 17_000);

        entity.position = Cartesian3.fromDegrees(quake.longitude, quake.latitude, 0);
        entity.ellipse.semiMajorAxis = radius;
        entity.ellipse.semiMinorAxis = radius;
        entity.description = `<strong>${quake.place || "Unknown location"}</strong><br/>Magnitude: ${mag.toFixed(1)}`;

        tracked.add(id);
      }

      for (const id of tracked) {
        if (liveIds.has(id)) {
          continue;
        }

        const entity = dataSource.entities.getById(id);
        if (entity) {
          dataSource.entities.remove(entity);
        }
        tracked.delete(id);
      }
    },
    setVisible(visible) {
      dataSource.show = visible;
    },
    count() {
      return tracked.size;
    },
  };
}

import {
  Cartesian2,
  Cartesian3,
  Color,
  CustomDataSource,
  HeightReference,
  NearFarScalar,
} from "cesium";

export function createSatelliteLayer(viewer) {
  const dataSource = new CustomDataSource("satellites");
  viewer.dataSources.add(dataSource);

  const tracked = new Set();

  return {
    update(satellites = []) {
      const liveIds = new Set();

      for (const sat of satellites) {
        if (typeof sat.latitude !== "number" || typeof sat.longitude !== "number") {
          continue;
        }

        const id = `sat-${sat.id || sat.name}`;
        liveIds.add(id);

        let entity = dataSource.entities.getById(id);

        if (!entity) {
          entity = dataSource.entities.add({
            id,
            position: Cartesian3.fromDegrees(0, 0, 0),
            point: {
              pixelSize: 8,
              color: Color.fromCssColorString("#39ff14"),
              outlineColor: Color.fromCssColorString("#d8ffcf"),
              outlineWidth: 1,
              glowPower: 0.42,
              heightReference: HeightReference.NONE,
              scaleByDistance: new NearFarScalar(1.0e6, 1.0, 3.0e7, 0.32),
            },
            label: {
              text: sat.name,
              font: "10px JetBrains Mono, monospace",
              fillColor: Color.fromCssColorString("#dbe8ff"),
              showBackground: true,
              backgroundColor: Color.fromCssColorString("rgba(5,8,15,0.45)"),
              pixelOffset: new Cartesian2(0, -16),
              scaleByDistance: new NearFarScalar(1.0e6, 1.0, 2.0e7, 0.0),
            },
          });
        }

        const altitudeMeters = typeof sat.altitude === "number" ? sat.altitude * 1000 : 550_000;
        entity.position = Cartesian3.fromDegrees(sat.longitude, sat.latitude, altitudeMeters);
        entity.label.text = sat.name;
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

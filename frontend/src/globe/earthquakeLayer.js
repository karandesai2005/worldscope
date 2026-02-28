import {
  Cartesian3,
  Color,
  CustomDataSource,
  NearFarScalar,
} from "cesium";

const QUAKE_CORE_COLOR = Color.fromCssColorString("#ff4f4f");

export function createEarthquakeLayer(viewer) {
  const dataSource = new CustomDataSource("earthquakes");
  viewer.dataSources.add(dataSource);

  const tracked = new Map();
  let visible = true;

  setInterval(() => {
    if (!visible || tracked.size === 0) {
      return;
    }

    for (const item of tracked.values()) {
      item.phase += 0.22;
      const wave = (Math.sin(item.phase) + 1) * 0.5;
      const radiusScale = 1 + wave * 0.32;
      const alpha = 0.22 + wave * 0.24;

      item.entity.ellipse.semiMajorAxis = item.baseRadius * radiusScale;
      item.entity.ellipse.semiMinorAxis = item.baseRadius * radiusScale;
      item.entity.ellipse.material = QUAKE_CORE_COLOR.withAlpha(alpha);
    }

    viewer.scene.requestRender();
  }, 320);

  return {
    update(quakes = []) {
      const liveIds = new Set();

      for (const quake of quakes) {
        if (typeof quake.latitude !== "number" || typeof quake.longitude !== "number") {
          continue;
        }

        const id = `quake-${quake.id}`;
        liveIds.add(id);

        let item = tracked.get(id);
        if (!item) {
          const entity = dataSource.entities.add({
            id,
            position: Cartesian3.fromDegrees(quake.longitude, quake.latitude, 0),
            ellipse: {
              semiMinorAxis: 1,
              semiMajorAxis: 1,
              height: 0,
              material: QUAKE_CORE_COLOR.withAlpha(0.42),
              outline: true,
              outlineColor: Color.fromCssColorString("rgba(255,120,120,0.92)"),
            },
            point: {
              pixelSize: 4,
              color: QUAKE_CORE_COLOR,
              scaleByDistance: new NearFarScalar(1.0e6, 1.0, 2.0e7, 0.25),
            },
            description: "",
          });

          item = {
            entity,
            baseRadius: 8_000,
            phase: Math.random() * Math.PI * 2,
          };
          tracked.set(id, item);
        }

        const mag = typeof quake.magnitude === "number" ? quake.magnitude : 0;
        const radius = Math.max(8_000, mag * 17_000);

        item.baseRadius = radius;
        item.entity.position = Cartesian3.fromDegrees(quake.longitude, quake.latitude, 0);
        item.entity.ellipse.semiMajorAxis = radius;
        item.entity.ellipse.semiMinorAxis = radius;
        item.entity.description = `<strong>${quake.place || "Unknown location"}</strong><br/>Magnitude: ${mag.toFixed(1)}`;
      }

      for (const [id, item] of tracked.entries()) {
        if (liveIds.has(id)) {
          continue;
        }

        dataSource.entities.remove(item.entity);
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

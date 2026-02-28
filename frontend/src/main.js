import "../style.css";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { initGlobe } from "./globe/initGlobe";
import { createFlightLayer } from "./globe/flightLayer";
import { createSatelliteLayer } from "./globe/satelliteLayer";
import { createEarthquakeLayer } from "./globe/earthquakeLayer";
import { connectSocket } from "./services/socket";
import { createControls } from "./ui/controls";

const viewer = initGlobe("globe-container");

const flightLayer = createFlightLayer(viewer);
const satelliteLayer = createSatelliteLayer(viewer);
const earthquakeLayer = createEarthquakeLayer(viewer);

const scheduleRender = (() => {
  let queued = false;

  return () => {
    if (queued) {
      return;
    }

    queued = true;

    requestAnimationFrame(() => {
      queued = false;
      viewer.scene.requestRender();
    });
  };
})();

const controls = createControls({
  onToggleFlights: (enabled) => {
    flightLayer.setVisible(enabled);
    scheduleRender();
  },
  onToggleSatellites: (enabled) => {
    satelliteLayer.setVisible(enabled);
    scheduleRender();
  },
  onToggleEarthquakes: (enabled) => {
    earthquakeLayer.setVisible(enabled);
    scheduleRender();
  },
});

connectSocket({
  onConnect: () => {
    controls.setConnection(true);
    scheduleRender();
  },
  onDisconnect: () => {
    controls.setConnection(false);
  },
  onFlights: (payload = []) => {
    flightLayer.update(payload);
    controls.updateStats({ aircraft: flightLayer.count() });
    scheduleRender();
  },
  onSatellites: (payload = []) => {
    satelliteLayer.update(payload);
    controls.updateStats({ satellites: satelliteLayer.count() });
    scheduleRender();
  },
  onEarthquakes: (payload = []) => {
    earthquakeLayer.update(payload);
    controls.updateStats({ earthquakes: earthquakeLayer.count() });
    scheduleRender();
  },
});

controls.updateStats({
  aircraft: flightLayer.count(),
  satellites: satelliteLayer.count(),
  earthquakes: earthquakeLayer.count(),
});

scheduleRender();

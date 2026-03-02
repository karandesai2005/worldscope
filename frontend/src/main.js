import "../style.css";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { addCountryLayer, initGlobe } from "./globe/initGlobe";
import { createFlightLayer } from "./globe/flightLayer";
import { createSatelliteLayer } from "./globe/satelliteLayer";
import { createEarthquakeLayer } from "./globe/earthquakeLayer";
import { connectSocket } from "./services/socket";
import { createControls } from "./ui/controls";
import { createNewsPanel } from "./ui/newsPanel";
import { ScreenSpaceEventHandler, ScreenSpaceEventType } from "cesium";
import { createFlightPanel } from "./ui/flightPanel";

const viewer = initGlobe("globe-container");
const countryLayer = await addCountryLayer(viewer);
void countryLayer;

const flightLayer = createFlightLayer(viewer);
const satelliteLayer = createSatelliteLayer(viewer);
const earthquakeLayer = createEarthquakeLayer(viewer);

// side panel for flight details (hidden until click)
const flightPanel = createFlightPanel();

// click interaction for flight selection
const clickHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
clickHandler.setInputAction((movement) => {
  const picked = viewer.scene.pick(movement.position);

  if (picked && typeof picked.id === "string" && picked.id.startsWith("flight-")) {
    const details = flightLayer.getFlightDetails(picked.id);
    if (details) {
      flightPanel.show(details);
    }
  } else {
    flightPanel.hide();
  }
}, ScreenSpaceEventType.LEFT_CLICK);

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

const newsPanel = createNewsPanel();

const socket = connectSocket({
  onConnect: () => {
    controls.setConnection(true);
    scheduleRender();
  },
  onDisconnect: () => {
    controls.setConnection(false);
  },
  onFlights: (payload = []) => {
    flightLayer.update(payload);
    controls.updateStats({ aircraft: payload.length });
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

socket.on("news:update", (articles = []) => {
  newsPanel.update(articles);
});

controls.updateStats({
  aircraft: flightLayer.count(),
  satellites: satelliteLayer.count(),
  earthquakes: earthquakeLayer.count(),
});

scheduleRender();

import {
  CallbackProperty,
  Color,
  GeoJsonDataSource,
  Ion,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";

const COUNTRY_STROKE_COLOR = Color.fromCssColorString("#00e5ff");
const COUNTRY_HOVER_STROKE_COLOR = Color.fromCssColorString("#39ff14");
const COUNTRY_STROKE_WIDTH = 1.0;
const COUNTRY_HOVER_STROKE_WIDTH = 1.8;
const COUNTRY_LAYER_STATE_KEY = "__worldscopeCountryLayerState";

const CAMERA_PRESET = {
  destination: {
    west: -125,
    south: 15,
    east: 160,
    north: 72,
  },
};

export function initGlobe(containerId) {
  Ion.defaultAccessToken = "";

  const viewer = new Viewer(containerId, {
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    infoBox: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    imageryProvider: new UrlTemplateImageryProvider({
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      credit: "OpenStreetMap",
    }),
  });

  viewer.scene.globe.baseColor = Color.fromCssColorString("#05080f");
  viewer.scene.backgroundColor = Color.fromCssColorString("#05080f");
  viewer.scene.skyAtmosphere.brightnessShift = -0.18;
  viewer.scene.screenSpaceCameraController.inertiaSpin = 0.84;
  viewer.scene.screenSpaceCameraController.inertiaTranslate = 0.92;
  viewer.scene.screenSpaceCameraController.inertiaZoom = 0.88;
  viewer.scene.globe.enableLighting = false;
  if (viewer.scene.highDynamicRange) {
    viewer.scene.highDynamicRange = false;
  }
  if (viewer.scene.fog.enabled) {
    viewer.scene.fog.enabled = false;
  }
  if (viewer.scene.skyAtmosphere?.show) {
    viewer.scene.skyAtmosphere.show = false;
  }
  viewer.scene.globe.showGroundAtmosphere = true;

  const bloom = viewer.scene.postProcessStages.bloom;
  bloom.enabled = true;
  bloom.uniforms.delta = 1;
  bloom.uniforms.sigma = 2.1;
  bloom.uniforms.stepSize = 1.1;
  bloom.uniforms.contrast = 120;
  bloom.uniforms.brightness = -0.2;
  bloom.uniforms.glowOnly = false;
  viewer.resolutionScale = window.devicePixelRatio > 1 ? 1.2 : 1;

  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  viewer.camera.flyTo({
    destination: Rectangle.fromDegrees(
      CAMERA_PRESET.destination.west,
      CAMERA_PRESET.destination.south,
      CAMERA_PRESET.destination.east,
      CAMERA_PRESET.destination.north,
    ),
    duration: 2.5,
  });

  return viewer;
}

function setCountryStyle(entity, color, width) {
  if (entity?.polygon) {
    entity.polygon.material = Color.TRANSPARENT;
    entity.polygon.outline = true;
    entity.polygon.outlineColor = color;
    entity.polygon.outlineWidth = COUNTRY_STROKE_WIDTH;
  }

  if (entity?.polyline) {
    entity.polyline.material = color;
    entity.polyline.width = width;
  }
}

function ensureCountryInfoElement() {
  const existing = document.querySelector(".country-info");
  if (existing) {
    return existing;
  }

  const element = document.createElement("div");
  element.className = "country-info";
  element.style.display = "none";
  document.body.appendChild(element);
  return element;
}

function getCountryName(entity, viewer) {
  const adminProperty = entity?.properties?.ADMIN;
  if (!adminProperty || typeof adminProperty.getValue !== "function") {
    return "";
  }

  return adminProperty.getValue(viewer.clock.currentTime) ?? "";
}

export async function addCountryLayer(viewer) {
  const previousState = viewer[COUNTRY_LAYER_STATE_KEY];
  if (previousState?.handler && !previousState.handler.isDestroyed()) {
    previousState.handler.destroy();
  }
  if (previousState?.dataSource && viewer.dataSources.contains(previousState.dataSource)) {
    viewer.dataSources.remove(previousState.dataSource, true);
  }

  const response = await fetch("/data/countries.geojson");
  if (!response.ok) {
    throw new Error(`[countries] failed to load /data/countries.geojson (status ${response.status})`);
  }

  const countriesGeoJson = await response.json();
  const featureCount = Array.isArray(countriesGeoJson?.features) ? countriesGeoJson.features.length : 0;
  if (featureCount === 0) {
    console.warn("[countries] /data/countries.geojson has 0 features; country borders will not render.");
  }

  const dataSource = await GeoJsonDataSource.load(countriesGeoJson, {
    stroke: COUNTRY_STROKE_COLOR,
    strokeWidth: COUNTRY_STROKE_WIDTH,
    fill: Color.TRANSPARENT,
  });

  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.dataSources.add(dataSource);

  dataSource.entities.values.forEach((entity) => {
    setCountryStyle(entity, COUNTRY_STROKE_COLOR, COUNTRY_STROKE_WIDTH);
  });

  const countryInfo = ensureCountryInfoElement();
  const hideCountryInfo = () => {
    countryInfo.style.display = "none";
    countryInfo.textContent = "";
  };
  hideCountryInfo();

  let hoveredCountryId;
  let lastHoveredEntity;

  const getStrokeColor = (entityId) =>
    hoveredCountryId === entityId ? COUNTRY_HOVER_STROKE_COLOR : COUNTRY_STROKE_COLOR;

  dataSource.entities.values.forEach((entity) => {
    if (entity?.polygon) {
      entity.polygon.outlineColor = new CallbackProperty(
        () => getStrokeColor(entity.id),
        false,
      );
      entity.polygon.outlineWidth = COUNTRY_STROKE_WIDTH;
    }

    if (entity?.polyline) {
      entity.polyline.material = new CallbackProperty(
        () => getStrokeColor(entity.id),
        false,
      );
      entity.polyline.width = new CallbackProperty(
        () => (hoveredCountryId === entity.id ? COUNTRY_HOVER_STROKE_WIDTH : COUNTRY_STROKE_WIDTH),
        false,
      );
    }
  });

  const resetHoveredEntity = () => {
    if (!lastHoveredEntity) {
      return;
    }

    hoveredCountryId = undefined;
    lastHoveredEntity = undefined;
  };

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  const resolvePickedCountryEntity = (position) => {
    const picked = viewer.scene.pick(position);
    if (!picked || !picked.id) {
      return undefined;
    }

    const pickedId = picked.id;
    const entityId = typeof pickedId === "object" ? pickedId.id : pickedId;
    if (typeof entityId !== "string" && typeof entityId !== "number") {
      return undefined;
    }

    return dataSource.entities.getById(entityId);
  };

  handler.setInputAction((movement) => {
    const pickedEntity = resolvePickedCountryEntity(movement.endPosition);

    if (pickedEntity) {
      if (lastHoveredEntity !== pickedEntity) {
        resetHoveredEntity();
        hoveredCountryId = pickedEntity.id;
        lastHoveredEntity = pickedEntity;
        viewer.scene.requestRender();
      }
      return;
    }

    if (lastHoveredEntity) {
      resetHoveredEntity();
      viewer.scene.requestRender();
    }
  }, ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction((movement) => {
    const pickedEntity = resolvePickedCountryEntity(movement.position);

    if (pickedEntity) {
      const countryName = getCountryName(pickedEntity, viewer);
      if (countryName) {
        countryInfo.textContent = countryName;
        countryInfo.style.display = "block";
      } else {
        hideCountryInfo();
      }
    } else {
      hideCountryInfo();
    }

    viewer.scene.requestRender();
  }, ScreenSpaceEventType.LEFT_CLICK);

  viewer[COUNTRY_LAYER_STATE_KEY] = {
    dataSource,
    handler,
  };

  return dataSource;
}

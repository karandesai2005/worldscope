import {
  Color,
  Ion,
  Rectangle,
  ScreenSpaceEventType,
  UrlTemplateImageryProvider,
  Viewer,
} from "cesium";

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
  viewer.scene.highDynamicRange = true;
  viewer.scene.globe.enableLighting = true;
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

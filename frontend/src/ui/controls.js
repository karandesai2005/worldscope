const TEMPLATE = `
  <aside class="control-panel">
    <h1 class="control-title">WORLDSCOPE</h1>
    <p class="control-subtitle">Realtime Global Monitoring</p>

    <section class="control-section" aria-label="Layer toggles">
      <label class="toggle-row" for="toggle-flights">
        <span>Flights</span>
        <input id="toggle-flights" type="checkbox" checked />
      </label>
      <label class="toggle-row" for="toggle-satellites">
        <span>Satellites</span>
        <input id="toggle-satellites" type="checkbox" checked />
      </label>
      <label class="toggle-row" for="toggle-earthquakes">
        <span>Earthquakes</span>
        <input id="toggle-earthquakes" type="checkbox" checked />
      </label>
    </section>

    <section class="control-section" aria-label="Live statistics">
      <div class="stats-grid">
        <div class="stat-item"><span>Aircraft</span><span id="stat-aircraft" class="stat-value">0</span></div>
        <div class="stat-item"><span>Satellites</span><span id="stat-satellites" class="stat-value">0</span></div>
        <div class="stat-item"><span>Earthquakes</span><span id="stat-earthquakes" class="stat-value">0</span></div>
      </div>
      <div class="status-row">
        <span><i id="socket-dot" class="status-dot"></i>Socket</span>
        <span id="socket-state">Disconnected</span>
      </div>
    </section>
  </aside>
  <div class="credit-strip">OpenSky | USGS | CelesTrak</div>
`;

export function createControls({
  onToggleFlights = () => {},
  onToggleSatellites = () => {},
  onToggleEarthquakes = () => {},
} = {}) {
  const root = document.getElementById("control-root");
  root.innerHTML = TEMPLATE;

  const flightsToggle = document.getElementById("toggle-flights");
  const satellitesToggle = document.getElementById("toggle-satellites");
  const earthquakesToggle = document.getElementById("toggle-earthquakes");

  flightsToggle.addEventListener("change", (event) => onToggleFlights(event.target.checked));
  satellitesToggle.addEventListener("change", (event) => onToggleSatellites(event.target.checked));
  earthquakesToggle.addEventListener("change", (event) => onToggleEarthquakes(event.target.checked));

  const statNodes = {
    aircraft: document.getElementById("stat-aircraft"),
    satellites: document.getElementById("stat-satellites"),
    earthquakes: document.getElementById("stat-earthquakes"),
  };

  const socketDot = document.getElementById("socket-dot");
  const socketState = document.getElementById("socket-state");

  return {
    updateStats({ aircraft, satellites, earthquakes } = {}) {
      if (typeof aircraft === "number") {
        statNodes.aircraft.textContent = aircraft.toLocaleString();
      }

      if (typeof satellites === "number") {
        statNodes.satellites.textContent = satellites.toLocaleString();
      }

      if (typeof earthquakes === "number") {
        statNodes.earthquakes.textContent = earthquakes.toLocaleString();
      }
    },
    setConnection(connected) {
      socketDot.classList.toggle("connected", connected);
      socketState.textContent = connected ? "Connected" : "Disconnected";
    },
  };
}

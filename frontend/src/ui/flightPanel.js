export function createFlightPanel() {
  const panel = document.createElement("aside");
  panel.className = "flight-panel"; // hidden by default via CSS

  panel.innerHTML = `
    <header class="flight-panel-header">
      <h2 class="flight-panel-title">Flight Details</h2>
      <button class="flight-panel-close" aria-label="Close">×</button>
    </header>
    <dl class="flight-panel-list">
      <dt>Callsign</dt><dd id="fp-callsign"></dd>
      <dt>ICAO&nbsp;24</dt><dd id="fp-icao24"></dd>
      <dt>Origin</dt><dd id="fp-origin"></dd>
      <dt>Departure</dt><dd id="fp-departure"></dd>
      <dt>Arrival</dt><dd id="fp-arrival"></dd>
      <dt>ETA</dt><dd id="fp-eta"></dd>
      <dt>Position</dt><dd id="fp-position"></dd>
      <dt>Altitude</dt><dd id="fp-altitude"></dd>
      <dt>Velocity</dt><dd id="fp-velocity"></dd>
      <dt>Vertical rate</dt><dd id="fp-vertical"></dd>
      <dt>Category</dt><dd id="fp-category"></dd>
      <dt>Classification</dt><dd id="fp-classification"></dd>
      <dt>Position source</dt><dd id="fp-source"></dd>
      <dt>On ground</dt><dd id="fp-ground"></dd>
      <dt>Last update</dt><dd id="fp-lastseen"></dd>
    </dl>
  `;

  document.body.appendChild(panel);

  const closeBtn = panel.querySelector(".flight-panel-close");
  closeBtn.addEventListener("click", hide);

  function fmtNum(val, fallback = "N/A") {
    if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
    return val.toLocaleString();
  }

  function render(details) {
    if (!details) {
      hide();
      return;
    }

    document.getElementById("fp-callsign").textContent = details.callsign || "N/A";
    document.getElementById("fp-icao24").textContent = details.icao24 || "N/A";
    document.getElementById("fp-origin").textContent = details.origin_country || "N/A";
    document.getElementById("fp-departure").textContent = details.departure || "";
    document.getElementById("fp-arrival").textContent = details.arrival || "";
    document.getElementById("fp-eta").textContent = details.eta ? new Date(details.eta).toLocaleString() : "";
    document.getElementById("fp-position").textContent =
      `${details.latitude ?? ""}, ${details.longitude ?? ""}`;
    document.getElementById("fp-altitude").textContent =
      fmtNum(details.altitude) + " m / " +
      (typeof details.altitude === "number" ? fmtNum(details.altitude * 3.28084) + " ft" : "");
    document.getElementById("fp-velocity").textContent =
      fmtNum(details.velocity) + " m/s / " +
      (typeof details.velocity === "number" ? fmtNum(details.velocity * 3.6) + " km/h" : "");
    document.getElementById("fp-vertical").textContent = fmtNum(details.vertical_rate);
    document.getElementById("fp-category").textContent = details.category ?? "N/A";
    document.getElementById("fp-classification").textContent = details.classificationType || "";
    document.getElementById("fp-source").textContent = details.position_source || "";
    document.getElementById("fp-ground").textContent = details.on_ground ? "Yes" : "No";
    document.getElementById("fp-lastseen").textContent =
      new Date(details.updatedAt).toLocaleString();

    panel.style.setProperty("--badge-color", details.classificationBadgeColor || "transparent");

    panel.classList.add("visible");
  }

  function hide() {
    panel.classList.remove("visible");
  }

  return { show: render, hide };
}

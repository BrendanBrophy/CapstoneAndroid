/********************************************************************
 *  Detect Capstone – Unified Tracker (DJI RC Compatible, no compass)
 ********************************************************************/

// Show JS errors in a simple popup
window.onerror = function (msg, url, line, col, error) {
  alert("JS ERROR: " + msg + " @ " + line + ":" + col);
};

// ---------------------------
// GLOBAL STATE
// ---------------------------
let isTracking = false;
let trackingLog = [];
let pathCoordinates = [];

let map, liveMarker, pathLine, headingLine, takeOffMarker;

let currentHeading = 0;           // from GPS course if available
let autoFollow = true;
let usingDeviceGPS = false;
let geoWatchId = null;

let latestLat = null;
let latestLng = null;

let currentTransportMode =
  localStorage.getItem("transportMode") || "Walking";

// DOM refs
let latEl, lngEl, headingEl, timeEl, logBody, compassTextEl;

// ---------------------------
// DIRECTION UTILITY (simple)
// ---------------------------
function getDirectionFromHeading(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

// ---------------------------
// MAP INIT
// ---------------------------
function initMap() {
  map = L.map("map").setView([0, 0], 16);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  liveMarker = L.marker([0, 0]).addTo(map);

  headingLine = L.polyline(
    [
      [0, 0],
      [0, 0],
    ],
    {
      color: "#ff4d4d",
      weight: 3,
      dashArray: "5,5",
    }
  ).addTo(map);

  pathLine = L.polyline([], {
    color: "#08a18b",
    weight: 4,
  }).addTo(map);
}

// ---------------------------
// DOM READY
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
  // cache DOM elements
  latEl = document.getElementById("lat");
  lngEl = document.getElementById("lng");
  headingEl = document.getElementById("heading");
  compassTextEl = document.getElementById("compassText");
  timeEl = document.getElementById("timestamp");
  logBody = document.getElementById("logBody");

  // initialise text
  if (headingEl) headingEl.textContent = "--";
  if (compassTextEl) compassTextEl.textContent = "--";

  // init map
  initMap();

  // ---------------------------
  // START / STOP TRACKING
  // ---------------------------
  const startBtn = document.getElementById("startTracking");
  const stopBtn = document.getElementById("stopTracking");

  if (startBtn && stopBtn) {
    startBtn.addEventListener("click", () => {
      isTracking = true;
      startBtn.disabled = true;
      stopBtn.disabled = false;
    });

    stopBtn.addEventListener("click", () => {
      isTracking = false;
      stopBtn.disabled = true;
      startBtn.disabled = false;
    });
  }

  // ---------------------------
  // DEVICE GPS BUTTON
  // ---------------------------
  const gpsButton = document.getElementById("toggleDeviceGPS");

  if (gpsButton) {
    gpsButton.addEventListener("click", () => {
      if (!usingDeviceGPS) {
        if (!navigator.geolocation) {
          alert("navigator.geolocation NOT available");
          return;
        }

        gpsButton.textContent = "Using Device GPS…";
        gpsButton.style.backgroundColor = "#4CAF50";
        usingDeviceGPS = true;

        // Start GPS watch
        geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            latestLat = pos.coords.latitude;
            latestLng = pos.coords.longitude;

            // GPS heading (course over ground) fallback if provided
            if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
              currentHeading = pos.coords.heading;
            }

            // Update everything
            window.updateGPS(latestLat, latestLng, Date.now());
          },
          (err) => {
            alert("GPS error: " + err.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 60000,    // give RC Plus more time for a fix
            maximumAge: 1000,
          }
        );
      } else {
        // Stop GPS
        if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
        gpsButton.textContent = "Use Device GPS";
        gpsButton.style.backgroundColor = "#ffa500";
        usingDeviceGPS = false;
      }
    });
  }

  // ---------------------------
  // RESET APP BUTTON (CUSTOM MODAL)
  // ---------------------------
  const resetBtn = document.getElementById("resetApp");
  const resetModal = document.getElementById("resetModal");
  const resetCancel = document.getElementById("resetCancel");
  const resetConfirm = document.getElementById("resetConfirm");

  if (resetBtn && resetModal && resetCancel && resetConfirm) {
    // Open modal instead of confirm()
    resetBtn.addEventListener("click", () => {
      resetModal.style.display = "flex";
    });

    // Cancel
    resetCancel.addEventListener("click", () => {
      resetModal.style.display = "none";
    });

    // Confirm reset
    resetConfirm.addEventListener("click", () => {
      resetModal.style.display = "none";

      // Stop tracking
      isTracking = false;

      const startBtn = document.getElementById("startTracking");
      const stopBtn = document.getElementById("stopTracking");
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;

      // Clear live data
      if (latEl) latEl.textContent = "--";
      if (lngEl) lngEl.textContent = "--";
      if (headingEl) headingEl.textContent = "--";
      if (compassTextEl) compassTextEl.textContent = "--";
      if (timeEl) timeEl.textContent = "--";

      // Reset data
      trackingLog = [];
      pathCoordinates = [];

      // Clear map objects safely
      try {
        if (pathLine) pathLine.setLatLngs([]);
        if (headingLine)
          headingLine.setLatLngs([
            [0, 0],
            [0, 0],
          ]);

        if (takeOffMarker && map) {
          map.removeLayer(takeOffMarker);
          takeOffMarker = null;
        }

        if (liveMarker) {
          if (latestLat !== null && latestLng !== null) {
            liveMarker.setLatLng([latestLat, latestLng]);
          } else {
            liveMarker.setLatLng([0, 0]);
          }
        }
      } catch (e) {
        alert("Reset error: " + e.message);
      }

      if (logBody) logBody.innerHTML = "";
    });
  }
});

// ---------------------------
// MARK TAKE-OFF BUTTON
// ---------------------------
const takeoffBtn = document.getElementById("markTakeOff");

if (takeoffBtn) {
  takeoffBtn.addEventListener("click", () => {

    if (trackingLog.length === 0) {
      alert("No GPS points available yet.");
      return;
    }

    const last = trackingLog[trackingLog.length - 1];

    // Add red marker to map
    if (takeOffMarker) map.removeLayer(takeOffMarker);

    takeOffMarker = L.marker([last.lat, last.lng], {
      icon: L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-red.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      })
    }).addTo(map).bindPopup("Take-Off Location");

    // Update TABLE (Take-Off column = index 5)
    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[5].textContent = "✔";

    // Update DATA
    last.takeoff = true;
  });
}


// ---------------------------
// DROP NOTE BUTTON
// ---------------------------
const dropNoteBtn = document.getElementById("dropNote");
const noteInput = document.getElementById("noteInput");

if (dropNoteBtn && noteInput) {
  dropNoteBtn.addEventListener("click", () => {

    if (trackingLog.length === 0) {
      alert("No GPS points available yet.");
      return;
    }

    const note = noteInput.value.trim();
    if (!note) {
        noteInput.classList.add("shake");
        setTimeout(() => noteInput.classList.remove("shake"), 600);
        return;
    }

    const last = trackingLog[trackingLog.length - 1];
    last.note = note;

    // Add marker to map
    L.marker([last.lat, last.lng])
      .addTo(map)
      .bindPopup("Note: " + note);

    // Update TABLE (Note column = index 4)
    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[4].textContent = note;

    noteInput.value = "";
  });
}

// ---------------------------
// TRANSPORT MODE DROPDOWN
// ---------------------------
const transportSelect = document.getElementById("transportMode");

if (transportSelect) {
  transportSelect.value = currentTransportMode;

  transportSelect.addEventListener("change", () => {
    currentTransportMode = transportSelect.value;
    localStorage.setItem("transportMode", currentTransportMode);
  });
}

// ---------------------------
// UPDATE GPS & LOGGING
// ---------------------------
window.updateGPS = function (lat, lng, timestamp) {
  if (!latEl || !lngEl || !timeEl) return;

  const t = new Date(timestamp).toLocaleTimeString();

  latEl.textContent = lat.toFixed(6);
  lngEl.textContent = lng.toFixed(6);
  timeEl.textContent = t;

  // Keep UI heading text in sync (using GPS heading if we have it)
  if (headingEl) headingEl.textContent = currentHeading.toFixed(0) + "°";
  if (compassTextEl)
    compassTextEl.textContent = getDirectionFromHeading(currentHeading);

  // Update map marker
  if (liveMarker) liveMarker.setLatLng([lat, lng]);
  if (autoFollow && map) map.setView([lat, lng]);

  // Update heading line (short line in front of marker)
  if (headingLine) {
    const dist = 0.0003;
    const rad = (currentHeading * Math.PI) / 180;
    const destLat = lat + dist * Math.cos(rad);
    const destLng = lng + dist * Math.sin(rad);

    headingLine.setLatLngs([
      [lat, lng],
      [destLat, destLng],
    ]);
  }

  if (!isTracking) return;

  // Track path
  pathCoordinates.push([lat, lng]);
  if (pathLine) pathLine.setLatLngs(pathCoordinates);

  // Logging table
  if (logBody) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t}</td>
      <td>${lat.toFixed(6)}</td>
      <td>${lng.toFixed(6)}</td>
      <td>${currentHeading.toFixed(0)}</td>
      <td>--</td>
      <td>--</td>
      <td>${currentTransportMode}</td>
      <td>--</td>
    `;
    logBody.appendChild(row);
  }

  trackingLog.push({
    time: t,
    lat,
    lng,
    heading: currentHeading,
    transport: currentTransportMode,
  });
};

// ---------------------------
// (Optional) Native heading hook – safe no-op if unused
// ---------------------------
window.updateHeadingFromNative = function (deg) {
  currentHeading = deg;
};

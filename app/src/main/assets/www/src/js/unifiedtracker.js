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
let activeUser = localStorage.getItem("loggedInUser") || "Unknown";
let isTracking = false;
let trackingLog = [];
let pathCoordinates = [];

// MAP OBJECTS DISABLED
let map = null, liveMarker = null, pathLine = null, headingLine = null, takeOffMarker = null;

let currentHeading = 0;
let autoFollow = true;
let usingDeviceGPS = false;
let geoWatchId = null;

let latestLat = null;
let latestLng = null;

let currentTransportMode =
  localStorage.getItem("transportMode") || "Walking";

// --- INFERRED TRANSPORT STATE ---
let gpsBuffer = [];          // recent GPS points for speed calc
let lastSpeedKmh = null;     // latest estimated speed
let lastInferredMode = "Other";  // latest inferred transport mode

// DOM refs
let latEl, lngEl, headingEl, timeEl, logBody, compassTextEl;
let inferredModeEl, transportLabelEl;

// ---------------------------
// DIRECTION UTILITY (simple)
// ---------------------------
function getDirectionFromHeading(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return dirs[index];
}

// ---------------------------
// SPEED / INFERRED MODE UTILS
// ---------------------------

// Haversine distance in meters
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // m
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Map speed (km/h) into one of the dropdown categories:
 *  Walking / ATV / Truck / Helicopter / Other
 */
function inferTransportFromSpeed(speedKmh) {
  if (speedKmh == null || !isFinite(speedKmh)) {
    return "Other";
  }

  // Rough heuristics, tweak if needed:
  //  0–6 km/h  → Walking
  //  6–45 km/h → ATV
  // 45–120 km/h → Truck
  // 120+ km/h  → Helicopter
  if (speedKmh < 6) return "Walking";
  if (speedKmh < 45) return "ATV";
  if (speedKmh < 120) return "Truck";
  return "Helicopter";
}

/* =====================
   MAP FULLY DISABLED
====================== */

// function initMap() { ... }  ← COMMENTED OUT
// initMap() call removed

// ---------------------------
// DOM READY
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {

  // cache DOM references
  latEl = document.getElementById("lat");
  lngEl = document.getElementById("lng");
  headingEl = document.getElementById("heading");
  compassTextEl = document.getElementById("compassText");
  timeEl = document.getElementById("timestamp");
  logBody = document.getElementById("logBody");
  inferredModeEl = document.getElementById("inferredMode");
  transportLabelEl = document.getElementById("transportLabel");

  // set initial text
  if (headingEl) headingEl.textContent = "--";
  if (compassTextEl) compassTextEl.textContent = "--";
  if (timeEl) timeEl.textContent = "--";
  if (inferredModeEl) inferredModeEl.textContent = lastInferredMode;
  if (transportLabelEl) transportLabelEl.textContent = currentTransportMode;

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

        geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            latestLat = pos.coords.latitude;
            latestLng = pos.coords.longitude;

            window.updateGPS(latestLat, latestLng, Date.now());
          },
          (err) => {
            alert("GPS error: " + err.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 60000,
            maximumAge: 1000,
          }
        );
      } else {

        if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
        gpsButton.textContent = "Use Device GPS";
        gpsButton.style.backgroundColor = "#ffa500";
        usingDeviceGPS = false;
      }
    });
  }

  // ---------------------------
  // RESET APP
  // ---------------------------
  const resetBtn = document.getElementById("resetApp");
  const resetModal = document.getElementById("resetModal");
  const resetCancel = document.getElementById("resetCancel");
  const resetConfirm = document.getElementById("resetConfirm");

  if (resetBtn && resetModal && resetCancel && resetConfirm) {

    resetBtn.addEventListener("click", () => {
      resetModal.style.display = "flex";
    });

    resetCancel.addEventListener("click", () => {
      resetModal.style.display = "none";
    });

    resetConfirm.addEventListener("click", () => {
      resetModal.style.display = "none";

      isTracking = false;

      const startBtn = document.getElementById("startTracking");
      const stopBtn = document.getElementById("stopTracking");
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;

      if (latEl) latEl.textContent = "--";
      if (lngEl) lngEl.textContent = "--";
      if (headingEl) headingEl.textContent = "--";
      if (compassTextEl) compassTextEl.textContent = "--";
      if (timeEl) timeEl.textContent = "--";
      if (inferredModeEl) inferredModeEl.textContent = "Other";
      if (transportLabelEl) transportLabelEl.textContent = currentTransportMode;

      trackingLog = [];
      pathCoordinates = [];
      gpsBuffer = [];
      lastSpeedKmh = null;
      lastInferredMode = "Other";

      if (logBody) logBody.innerHTML = "";
    });
  }
});

// ---------------------------
// MARK TAKE-OFF (map disabled)
// ---------------------------
const takeoffBtn = document.getElementById("markTakeOff");

if (takeoffBtn) {
  takeoffBtn.addEventListener("click", () => {

    if (trackingLog.length === 0) {
      alert("No GPS points available yet.");
      return;
    }

    const last = trackingLog[trackingLog.length - 1];

    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[5].textContent = "✔"; // Take-Off column

    last.takeoff = true;
  });
}

// ---------------------------
// DROP NOTE (map disabled)
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

    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[4].textContent = note; // Note column

    noteInput.value = "";
  });
}

// ---------------------------
// TRANSPORT MODE (MANUAL)
// ---------------------------
const transportSelect = document.getElementById("transportMode");

if (transportSelect) {
  transportSelect.value = currentTransportMode;

  transportSelect.addEventListener("change", () => {
    currentTransportMode = transportSelect.value;
    localStorage.setItem("transportMode", currentTransportMode);
    if (transportLabelEl) {
      transportLabelEl.textContent = currentTransportMode;
    }
  });
}

// ---------------------------
// UPDATE GPS & LOGGING
// ---------------------------
window.updateGPS = function (lat, lng, timestamp) {

  const t = new Date(timestamp).toLocaleTimeString();

  if (latEl) latEl.textContent = lat.toFixed(6);
  if (lngEl) lngEl.textContent = lng.toFixed(6);
  if (timeEl) timeEl.textContent = t;

  if (headingEl) headingEl.textContent = currentHeading.toFixed(0) + "°";
  if (compassTextEl) compassTextEl.textContent = getDirectionFromHeading(currentHeading);

  // --- SPEED / INFERRED MODE CALC ---
  gpsBuffer.push({ lat, lng, timestamp });

  // keep last 3 points
  if (gpsBuffer.length > 3) gpsBuffer.shift();

  if (gpsBuffer.length >= 2) {
    const p1 = gpsBuffer[gpsBuffer.length - 2];
    const p2 = gpsBuffer[gpsBuffer.length - 1];

    const dtSec = (p2.timestamp - p1.timestamp) / 1000;
    const distM = haversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);

    if (dtSec > 0) {
      const speedMs = distM / dtSec;
      lastSpeedKmh = speedMs * 3.6;

      // ignore crazy spikes
      if (lastSpeedKmh > 400) {
        lastSpeedKmh = null;
      }
    }

    lastInferredMode = inferTransportFromSpeed(lastSpeedKmh);
  } else {
    lastSpeedKmh = null;
    lastInferredMode = "Other";
  }

  if (inferredModeEl) {
    inferredModeEl.textContent = lastInferredMode;
  }
  if (transportLabelEl) {
    transportLabelEl.textContent = currentTransportMode;
  }

  if (!isTracking) return;

  pathCoordinates.push([lat, lng]);

  const row = document.createElement("tr");
  row.innerHTML = `
      <td>${t}</td>
      <td>${lat.toFixed(6)}</td>
      <td>${lng.toFixed(6)}</td>
      <td>${currentHeading.toFixed(0)}</td>
      <td>--</td>
      <td>--</td>
      <td>${currentTransportMode}</td>
      <td>${lastInferredMode}</td>
      <td>${activeUser}</td>
    `;
  logBody.appendChild(row);

  trackingLog.push({
    time: t,
    lat,
    lng,
    heading: currentHeading,
    transport: currentTransportMode,      // manual
    inferredTransport: lastInferredMode,  // inferred (matches dropdown list)
    speedKmh: lastSpeedKmh,
    user: activeUser
  });
};

// ---------------------------
// HEADING FROM ANDROID
// ---------------------------
window.updateHeadingFromNative = function (deg) {
  currentHeading = deg;
};

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

  // set initial text
  if (headingEl) headingEl.textContent = "--";
  if (compassTextEl) compassTextEl.textContent = "--";

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

      trackingLog = [];
      pathCoordinates = [];

      // all map clears disabled
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

    // map marker disabled:
    // L.marker([...]).addTo(map)

    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[5].textContent = "✔";

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

    // map disabled:
    // L.marker([last.lat,last.lng]).addTo(map).bindPopup(...)

    const lastRow = logBody.lastElementChild;
    if (lastRow) lastRow.children[4].textContent = note;

    noteInput.value = "";
  });
}

// ---------------------------
// TRANSPORT MODE
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

  const t = new Date(timestamp).toLocaleTimeString();

  latEl.textContent = lat.toFixed(6);
  lngEl.textContent = lng.toFixed(6);
  timeEl.textContent = t;

  if (headingEl) headingEl.textContent = currentHeading.toFixed(0) + "°";
  if (compassTextEl) compassTextEl.textContent = getDirectionFromHeading(currentHeading);

  // ALL MAP OPERATIONS DISABLED
  // if (liveMarker) liveMarker.setLatLng([lat,lng]);
  // if (map && autoFollow) map.setView([lat,lng]);

  if (!isTracking) return;

  pathCoordinates.push([lat, lng]);

  // map disabled:
  // if (pathLine) pathLine.setLatLngs(pathCoordinates);

  const row = document.createElement("tr");
  row.innerHTML = `
      <td>${t}</td>
      <td>${lat.toFixed(6)}</td>
      <td>${lng.toFixed(6)}</td>
      <td>${currentHeading.toFixed(0)}</td>
      <td>--</td>
      <td>--</td>
      <td>${currentTransportMode}</td>
      <td>${activeUser}</td>
    `;
  logBody.appendChild(row);

  trackingLog.push({
    time: t,
    lat,
    lng,
    heading: currentHeading,
    transport: currentTransportMode,
    user: activeUser
  });
};

// ---------------------------
// HEADING FROM ANDROID
// ---------------------------
window.updateHeadingFromNative = function (deg) {
  currentHeading = deg;
};

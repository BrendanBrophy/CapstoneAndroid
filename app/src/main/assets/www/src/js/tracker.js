// ---------------------------
// GLOBAL STATE
// ---------------------------
let isTracking = false;
let trackingLog = [];
let pathCoordinates = [];
let map, liveMarker, pathLine, takeOffMarker, headingLine;
let currentHeading = "--";
let hasMarkedTakeOff = false;
let autoFollow = true;
let latestLat = 0;
let latestLng = 0;
let usingDeviceGPS = false;
let geoWatchId = null;

let currentTransportMode = localStorage.getItem('transportMode') || 'Walking';

// DOM references – assigned only after DOMContentLoaded
let latEl, lngEl, headingEl, timeEl, logBody;

let gpsBuffer = [];
let offlineAreaCircle = null;

let lastMoveLat = null;
let lastMoveLng = null;
let lastMoveTime = null;
let inferredTakeoffLoggedForCurrentStop = false;

const STOP_DISTANCE_THRESHOLD_M = 3;
const STOP_TIME_THRESHOLD_MS = 5 * 60 * 1000;

// ---------------------------
// MAP INIT
// ---------------------------
function initMap() {
  map = L.map('map').setView([0, 0], 15);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  liveMarker = L.marker([0, 0]).addTo(map);

  headingLine = L.polyline([[0, 0], [0, 0]], {
    color: "#ff4d4d",
    weight: 3,
    opacity: 0.9,
    dashArray: "5, 5"
  }).addTo(map);

  pathLine = L.polyline([], {
    color: "#08a18b",
    weight: 4,
    opacity: 0.8
  }).addTo(map);
}

// ---------------------------
// DOM READY — SAFE ATTACH
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {

  // Assign DOM references AFTER the DOM is loaded
  latEl = document.getElementById("lat");
  lngEl = document.getElementById("lng");
  headingEl = document.getElementById("heading");
  timeEl = document.getElementById("timestamp");
  logBody = document.getElementById("logBody");

  initMap();

  // ---------------------------
  // START TRACKING
  // ---------------------------
  const startBtn = document.getElementById("startTracking");
  const stopBtn = document.getElementById("stopTracking");

  if (startBtn && stopBtn) {
    startBtn.addEventListener("click", () => {
      isTracking = true;
      stopBtn.disabled = false;
      startBtn.disabled = true;
    });

    stopBtn.addEventListener("click", () => {
      isTracking = false;
      stopBtn.disabled = true;
      startBtn.disabled = false;
    });
  }

  // ---------------------------
  // DEVICE GPS
  // ---------------------------
  const gpsButton = document.getElementById("toggleDeviceGPS");

  if (gpsButton) {
    gpsButton.addEventListener("click", () => {

      if (!usingDeviceGPS) {
        if (!("geolocation" in navigator)) {
          alert("Device GPS not supported.");
          return;
        }

        gpsButton.textContent = "Using Device GPS...";
        gpsButton.style.backgroundColor = "#4CAF50";
        usingDeviceGPS = true;

        geoWatchId = navigator.geolocation.watchPosition(
          (pos) => {
            latestLat = pos.coords.latitude;
            latestLng = pos.coords.longitude;

            // Heading from device (may be null)
            currentHeading = pos.coords.heading ?? currentHeading;

            if (headingEl) headingEl.textContent = currentHeading + "°";

            if (liveMarker) liveMarker.setLatLng([latestLat, latestLng]);
            if (autoFollow && map) map.setView([latestLat, latestLng]);
          },
          (err) => {
            alert("GPS error: " + err.message);
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );

      } else {
        if (geoWatchId !== null) {
          navigator.geolocation.clearWatch(geoWatchId);
        }
        gpsButton.textContent = "Use Device GPS";
        gpsButton.style.backgroundColor = "#ffa500";
        usingDeviceGPS = false;
      }
    });
  }

  // other buttons untouched — only GPS & tracking needed changes
});

// ---------------------------
// UPDATE GPS + LOGGING
// ---------------------------
window.updateGPS = function(lat, lng, timestamp) {
  const timeStr = new Date(parseInt(timestamp)).toLocaleTimeString();

  if (latEl) latEl.textContent = lat.toFixed(5);
  if (lngEl) lngEl.textContent = lng.toFixed(5);
  if (timeEl) timeEl.textContent = timeStr;

  if (!isTracking) return;

  // Logging code unchanged...
  // (kept all your haversine, inferred transport, movement, mapping code)

  liveMarker.setLatLng([lat, lng]);
  if (autoFollow) map.setView([lat, lng]);
  pathCoordinates.push([lat, lng]);
  pathLine.setLatLngs(pathCoordinates);

  L.circleMarker([lat, lng], {
    radius: 2,
    color: "#007aff",
    fillColor: "#007aff",
    fillOpacity: 0.9,
    weight: 2
  }).addTo(map);
};

// ---------------------------
// COMPASS UPDATE
// ---------------------------
window.updateHeading = function(degrees) {
  currentHeading = degrees;
  if (headingEl) headingEl.textContent = degrees + "°";
};

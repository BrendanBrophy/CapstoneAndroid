console.log("tracker.js loaded — real GPS mode");

let trackingLog = [];
const latEl = document.getElementById("lat");
const lngEl = document.getElementById("lng");
const headingEl = document.getElementById("heading");
const timeEl = document.getElementById("timestamp");

let currentHeading = "--";

function handleOrientation(e) {
  if (e.alpha !== null) {
    currentHeading = Math.round(e.alpha);
    headingEl.textContent = currentHeading + "°";

    const headingImg = document.querySelector(".heading-img");
    if (headingImg) {
      headingImg.style.transform = `rotate(${currentHeading}deg)`;
    }
  }
}

// Ask permission for device orientation (required on iOS)
if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
  DeviceOrientationEvent.requestPermission()
    .then(permissionState => {
      if (permissionState === 'granted') {
        window.addEventListener("deviceorientation", handleOrientation);
      } else {
        console.warn("Permission to access heading denied.");
      }
    })
    .catch(console.error);
} else {
  // For browsers that don't require permission
  window.addEventListener("deviceorientation", handleOrientation);
}

if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientation", (e) => {
      console.log("Heading event:", e.alpha);
      if (e.alpha !== null) {
        currentHeading = Math.round(e.alpha);
        headingEl.textContent = currentHeading + "°";
  
        // Rotate the image in the heading marker
        const headingImg = document.querySelector(".heading-img");
        if (headingImg) {
          headingImg.style.transform = `rotate(${currentHeading}deg)`;
        }
      }
    });
  }
  

// Update UI with live GPS data
function updatePosition(pos) {
    if (!isTracking) return;
  
    const lat = pos.coords.latitude.toFixed(6);
    const lng = pos.coords.longitude.toFixed(6);
    const timestamp = new Date(pos.timestamp).toISOString();
  
    latEl.textContent = lat;
    lngEl.textContent = lng;
    timeEl.textContent = timestamp;
  
    trackingLog.push({
      timestamp,
      lat,
      lng,
      heading: currentHeading,
      note: "",
      takeOff: false
    });
  
    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td>${timestamp}</td>
      <td>${lat}</td>
      <td>${lng}</td>
      <td>${currentHeading}</td>
      <td></td>
      <td></td>
    `;
    logBody.appendChild(newRow);
  
    liveMarker.setLatLng([lat, lng]);
    map.setView([lat, lng]);
  
    // ✅ Update path
    pathCoordinates.push([lat, lng]);
    pathLine.setLatLngs(pathCoordinates);

  L.circleMarker([lat, lng], {
    radius: 2,
    color: "#007aff",       // Apple's system blue
    fillColor: "#007aff",
    fillOpacity: 0.9,
    weight: 2
  }).addTo(map);

  
  
  }
  
  
// Set up Leaflet map
const map = L.map('map').setView([0, 0], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const liveMarker = L.marker([0, 0]).addTo(map);

// Show error if GPS fails
function showError(err) {
  console.warn("Geolocation error:", err.message);
  alert("GPS error: " + err.message);
}

const pathCoordinates = [];
const pathLine = L.polyline([], {
  color: "#08a18b",  // matches your theme
  weight: 4,
  opacity: 0.8
}).addTo(map);

const headingIcon = L.divIcon({
    className: "heading-icon",
    html: `<img src="assets/arrow.png" class="heading-img">`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
  
  const headingMarker = L.marker([0, 0], {
    icon: headingIcon,
    rotationAngle: 0
  }).addTo(map);
  
let isTracking = false;
let watchId = null;

const startBtn = document.getElementById("startTracking");
const stopBtn = document.getElementById("stopTracking");

startBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported.");
    return;
  }

  isTracking = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  watchId = navigator.geolocation.watchPosition(updatePosition, showError, {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000
  });
});

stopBtn.addEventListener("click", () => {
  isTracking = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
});

const takeOffBtn = document.getElementById("markTakeOff");
let hasMarkedTakeOff = false;
let takeOffMarker = null;

takeOffBtn.addEventListener("click", () => {
  if (!isTracking) {
    alert("You must start tracking first.");
    return;
  }

  if (hasMarkedTakeOff) {
    alert("Take-off location already marked.");
    return;
  }

  // Get the last tracked position
  const lastEntry = trackingLog[trackingLog.length - 1];
  if (!lastEntry) {
    alert("No tracking data yet.");
    return;
  }

  // Update takeOff flag
  lastEntry.takeOff = true;
  hasMarkedTakeOff = true;

// Add take-off marker to the map
takeOffMarker = L.marker([lastEntry.lat, lastEntry.lng], {
    title: "Take-Off Location",
    icon: L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-red.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [0, -35]
    })
}).addTo(map).bindPopup("Take-Off Location").openPopup();

// Highlight it in the table (last row)
const lastRow = logBody.lastChild;
if (lastRow) {
lastRow.children[5].textContent = "✔";
    }
});

const noteInput = document.getElementById("noteInput");
const dropNoteBtn = document.getElementById("dropNote");

dropNoteBtn.addEventListener("click", () => {
  const noteText = noteInput.value.trim();
  if (!isTracking) {
    alert("You must start tracking first.");
    return;
  }
  if (!noteText) {
    alert("Note is empty.");
    return;
  }

  const lastEntry = trackingLog[trackingLog.length - 1];
  if (!lastEntry) {
    alert("No tracking data available.");
    return;
  }

  // Save note to last entry
  lastEntry.note = noteText;

  // Add a marker to the map
  const noteMarker = L.marker([lastEntry.lat, lastEntry.lng])
    .addTo(map)
    .bindPopup(`Note: ${noteText}`)
    .openPopup();

  // Update the note column in the last row
  const lastRow = logBody.lastChild;
  if (lastRow) {
    lastRow.children[4].textContent = noteText;
  }

  noteInput.value = ""; // clear input
});

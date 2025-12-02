// ============================
// Global State
// ============================
let notes = JSON.parse(localStorage.getItem("geoNotes")) || [];
let currentCoords = null;
let watchId = null;
let loggingInterval = null;
let userHeading = 0;
let marker = null;
let map = null;

// ============================
// COMPASS HANDLING
// ============================
function startCompass() {
    if (typeof compassActive === 'undefined') {
        window.compassActive = false;
    }

    if (!compassActive) {
        console.log("Starting compass tracking...");
        
        window.updateHeadingFromNative = function (headingDeg) {
            userHeading = headingDeg;

            const arrow = document.querySelector('.custom-user-icon .arrow');
            if (arrow) {
                arrow.style.transform = `rotate(${userHeading}deg)`;
            }
        };

        compassActive = true;
    }
}

// ============================
// NATIVE AND BROWSER GPS SUPPORT
// ============================

// Used by Android → JS
window.updateGPSFromNative = function(lat, lng) {
    currentCoords = { latitude: lat, longitude: lng, heading: userHeading };

    console.log("Native GPS:", lat, lng, "Heading:", userHeading);

    // Initialize map if needed
    if (!map) {
        initializeMap(lat, lng);
    }

    // Create marker if needed
    if (!marker) {
        marker = L.marker([lat, lng]).addTo(map);
    } else {
        marker.setLatLng([lat, lng]);
    }

    map.setView([lat, lng], 16);

    // Logging
    logTrackingData(lat, lng, userHeading);

    const status = document.getElementById('status');
    if (status) {
        status.innerText = `Latitude: ${lat}, Longitude: ${lng}, Heading: ${userHeading.toFixed(2)}°`;
    }
};

// ============================
// Start Tracking
// ============================
function startTracking() {

    // ---- NATIVE GPS (DJI RC Plus, Android WebView) ----
    if (window.AndroidBridge) {
        console.log("Using native Android GPS — browser geolocation disabled.");

        localStorage.setItem("locationHistory", JSON.stringify([]));

        document.getElementById('startTrackingBtn').style.display = 'none';
        document.getElementById('stopTrackingBtn').style.display = 'inline-block';

        return;  // native GPS will handle updates automatically
    }

    // ---- BROWSER GPS (fallback for phones/laptops) ----
    if (navigator.geolocation) {
        localStorage.setItem("locationHistory", JSON.stringify([]));

        document.getElementById('startTrackingBtn').style.display = 'none';
        document.getElementById('stopTrackingBtn').style.display = 'inline-block';

        watchId = navigator.geolocation.watchPosition(updateLocation, handleError, {
            enableHighAccuracy: true,
            maximumAge: 0
        });

        if (loggingInterval === null) {
            loggingInterval = setInterval(() => {
                if (currentCoords) {
                    logTrackingData(currentCoords.latitude, currentCoords.longitude, userHeading);
                }
            }, 2000);
        }
    } else {
        document.getElementById('status').innerText = "Geolocation is not supported by this browser.";
    }
}

// ============================
// Map Initialization
// ============================
function initializeMap(lat, lng) {
    if (!map) {
        map = L.map('map').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
    }

    if (!marker) {
        console.log("Creating marker at:", lat, lng);
        marker = L.marker([lat, lng]).addTo(map);
    }
}

// ============================
// Browser GPS Update (fallback)
// ============================
function updateLocation(position) {
    const { latitude, longitude } = position.coords;
    currentCoords = { latitude, longitude, heading: userHeading };

    console.log("Browser GPS:", latitude, longitude, "Heading:", userHeading);

    if (!map) {
        initializeMap(latitude, longitude);
    }

    if (!marker) {
        marker = L.marker([latitude, longitude]).addTo(map);
    } else {
        marker.setLatLng([latitude, longitude]);
    }

    map.setView([latitude, longitude], 16);

    logTrackingData(latitude, longitude, userHeading);

    document.getElementById('status').innerText =
        `Latitude: ${latitude}, Longitude: ${longitude}, Heading: ${userHeading.toFixed(2)}°`;
}

// ============================
// Tracking Log
// ============================
function logTrackingData(lat, lng, heading) {
    let timestamp = new Date().toLocaleTimeString();
    let history = JSON.parse(localStorage.getItem("locationHistory")) || [];

    history.push(`${timestamp} - Lat: ${lat}, Lng: ${lng}, Heading: ${heading.toFixed(2)}°`);
    localStorage.setItem("locationHistory", JSON.stringify(history));
}

// ============================
// Notes Functions
// ============================
function showNoteForm() {
    document.getElementById("noteForm").style.display = "block";
}

function closeNoteForm() {
    document.getElementById("noteForm").style.display = "none";
    document.getElementById("noteText").value = "";
}

function saveNote() {
    let noteText = document.getElementById("noteText").value.trim();
    if (noteText === "" || !currentCoords) {
        alert("Enter a note and ensure tracking is active.");
        return;
    }

    let note = { lat: currentCoords.latitude, lng: currentCoords.longitude, text: noteText };
    notes.push(note);
    localStorage.setItem("geoNotes", JSON.stringify(notes));

    addNoteMarker(note);
    logNoteToTracking(note);
    closeNoteForm();
}

function logNoteToTracking(note) {
    let timestamp = new Date().toLocaleTimeString();
    let history = JSON.parse(localStorage.getItem("locationHistory")) || [];
    history.push(`${timestamp} - Note: ${note.text} (Lat: ${note.lat}, Lng: ${note.lng})`);
    localStorage.setItem("locationHistory", JSON.stringify(history));
}

function loadHistory() {
    let history = JSON.parse(localStorage.getItem("locationHistory")) || [];
    let historyDiv = document.getElementById("trackingHistory");
    historyDiv.innerHTML = history.map(entry => `<p>${entry}</p>`).join('');
}

// ============================
// Stop Tracking
// ============================
function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    document.getElementById('status').innerText = "Tracking stopped.";
    document.getElementById('stopTrackingBtn').style.display = 'none';
    document.getElementById('startTrackingBtn').style.display = 'inline-block';

    if (loggingInterval !== null) {
        clearInterval(loggingInterval);
        loggingInterval = null;
    }
}

// ============================
// Error Handling
// ============================
function handleError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            document.getElementById('status').innerText = "User denied the request for Geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            document.getElementById('status').innerText = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            document.getElementById('status').innerText = "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            document.getElementById('status').innerText = "An unknown error occurred.";
            break;
    }
}

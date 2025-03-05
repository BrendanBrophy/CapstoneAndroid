// Ensure location history is initialized from localStorage
let locationHistory = JSON.parse(localStorage.getItem("locationHistory")) || [];

/**
 * Logs the user's location, updates the UI, and stores data in localStorage.
 * @param {float} lat - The latitude of the user.
 * @param {float} lon - The longitude of the user.
 */
function logLocation(lat, lon, heading) {
    let timestamp = new Date().toLocaleTimeString();
    let headingText = heading !== null ? heading.toFixed(2) + "°" : "N/A";
    let locationEntry = `${timestamp} - Latitude: ${lat}, Longitude: ${lon}, Heading: ${headingText}`;

    let storedHistory = JSON.parse(localStorage.getItem("locationHistory")) || [];
    storedHistory.push(locationEntry);
    localStorage.setItem("locationHistory", JSON.stringify(storedHistory));

    let logDiv = document.getElementById("locationLog");
    if (logDiv) {
        logDiv.innerHTML += `<p>${locationEntry}</p>`;
    }

    console.log("Updated locationHistory:", JSON.parse(localStorage.getItem("locationHistory")));
}


// Make sure logLocation is available globally
window.logLocation = logLocation;

window.onload = function () {
    let logDiv = document.getElementById("locationLog");

    // Retrieve stored history and display it (only for reference)
    let storedHistory = JSON.parse(localStorage.getItem("locationHistory")) || [];
    if (storedHistory.length > 0 && logDiv) {
        storedHistory.forEach(entry => {
            logDiv.innerHTML += `<p>${entry}</p>`;
        });
    }
};


/**
 * Downloads the logged location history as a .txt file.
 */
function downloadHistory() {
    let storedHistory = JSON.parse(localStorage.getItem("locationHistory")) || [];

    if (storedHistory.length === 0) {
        alert("No location history to download.");
        return;
    }

    let historyText = storedHistory.join("\n");

    let blob = new Blob([historyText], { type: "text/plain" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "location_history.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


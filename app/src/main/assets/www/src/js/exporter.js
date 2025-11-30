// exporter.js
// Handles exporting the log table as CSV and KML

document.getElementById("exportData").addEventListener("click", () => {
  const logBody = document.getElementById("logBody");
  if (!logBody) {
    console.error("logBody element not found");
    return;
  }

  // ----------------------------------------------------
  // COLLECT LOG ENTRIES FROM TABLE
  // ----------------------------------------------------
  const logEntries = Array.from(logBody.children).map(row => {
    const cells = Array.from(row.children).map(cell => cell.textContent);
    const noteText = cells[4] || "";

    return {
      time: cells[0],
      lat: parseFloat(cells[1]),
      lng: parseFloat(cells[2]),
      heading: cells[3],
      note: noteText,
      takeOff: cells[5],
      transport: cells[6],
      user: cells[7]   // <-- UPDATED
    };
  }).filter(e => !Number.isNaN(e.lat) && !Number.isNaN(e.lng));

  if (logEntries.length === 0) {
    alert("No log data to export.");
    return;
  }

  // Common filename base
  const now = new Date();
  const pad = n => n.toString().padStart(2, "0");
  const filenameBase =
    `TrackPoint_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}-${pad(now.getMinutes())}`;

  // ====================================================
  // CSV EXPORT
  // ====================================================
  const csvRows = [];
  csvRows.push(["Detect GPS Export"]);
  csvRows.push([`Generated: ${now.toLocaleString()}`]);
  csvRows.push([`Total Points: ${logEntries.length}`]);

  const modeCounts = {};
  logEntries.forEach(e => {
    const mode = e.transport || "Unknown";
    modeCounts[mode] = (modeCounts[mode] || 0) + 1;
  });

  csvRows.push([]);
  csvRows.push(["Summary by Mode (points)"]);
  Object.entries(modeCounts).forEach(([mode, count]) => {
    csvRows.push([mode, count]);
  });

  csvRows.push([]);
  csvRows.push([
    "Time",
    "Lat",
    "Lng",
    "Heading",
    "Note",
    "Take-Off",
    "Transportation",
    "User"   // <-- UPDATED
  ]);

  logEntries.forEach(e => {
    csvRows.push([
      e.time,
      e.lat.toFixed(5),
      e.lng.toFixed(5),
      e.heading,
      e.note,
      e.takeOff === "✔" ? "X" : e.takeOff,
      e.transport,
      e.user     // <-- UPDATED
    ]);
  });

  const csvContent = csvRows.map(r => r.join(",")).join("\n");
  const csvName = `${filenameBase}.csv`;

  // ====================================================
  // KML EXPORT
  // ====================================================

  function formatTimeForKml(timeStr) {
    if (!timeStr) return "";
    const pad2 = n => n.toString().padStart(2, "0");

    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)/i);
    if (ampmMatch) {
      let hour = parseInt(ampmMatch[1], 10);
      const minute = ampmMatch[2];
      const ampm = ampmMatch[4].toUpperCase();
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return `${pad2(hour)}:${minute}`;
    }

    const hmsMatch = timeStr.match(/^\s*(\d{1,2}):(\d{2}):(\d{2})/);
    if (hmsMatch) return `${pad2(parseInt(hmsMatch[1], 10))}:${hmsMatch[2]}`;

    const hmMatch = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
    if (hmMatch) return `${pad2(parseInt(hmMatch[1], 10))}:${hmMatch[2]}`;

    return timeStr;
  }

  const placemarks = [];

  logEntries.forEach(e => {
    const kmlTime = formatTimeForKml(e.time);

    const placemark = `
    <Placemark>
      <name>${kmlTime}</name>
      <StyleUrl>#drivingStyle</StyleUrl>
      <description><![CDATA[
        Time: ${e.time}<br/>
        Heading: ${e.heading}<br/>
        Note: ${e.note}<br/>
        Take-Off: ${e.takeOff}<br/>
        Transport: ${e.transport}<br/>
        User: ${e.user}<br/>
      ]]></description>
      <Point>
        <coordinates>${e.lng.toFixed(5)},${e.lat.toFixed(5)},0</coordinates>
      </Point>
    </Placemark>`;

    placemarks.push(placemark);
  });

  // Single folder, simpler for now
  const folder = `
    <Folder>
      <name>Points</name>
      ${placemarks.join("\n")}
    </Folder>`;

  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${filenameBase}</name>
    ${folder}
  </Document>
</kml>`;

  const kmlName = `${filenameBase}.kml`;

  // ====================================================
  // ANDROID EXPORT VIA SAF
  // ====================================================
  if (window.AndroidBridge && typeof AndroidBridge.exportFiles === "function") {
    AndroidBridge.exportFiles(
      csvName, csvContent,
      kmlName, kmlContent
    );
    alert("Preparing export...");
    return;
  }

  alert("AndroidBridge not available.");
});

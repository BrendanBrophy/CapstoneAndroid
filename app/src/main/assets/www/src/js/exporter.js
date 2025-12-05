// exporter.js
// Handles exporting the log table as CSV and KML for the controller
// Colour scheme matches PointTrack exporter: walking=yellow, heli=green, other=blue.

document.getElementById("exportData").addEventListener("click", () => {
  const logBody = document.getElementById("logBody");
  if (!logBody) {
    console.error("logBody element not found");
    return;
  }

  // ----------------------------------------------------
  // COLLECT LOG ENTRIES FROM TABLE
  // Columns:
  // 0: Time, 1: Lat, 2: Lng, 3: Heading, 4: Note,
  // 5: Take-Off, 6: Transport, 7: User
  // ----------------------------------------------------
  const logEntries = Array.from(logBody.children)
    .map(row => {
      const cells = Array.from(row.children).map(c => (c.textContent || "").trim());

      const lat = parseFloat(cells[1]);
      const lng = parseFloat(cells[2]);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

      return {
        time: cells[0],
        lat,
        lng,
        heading: cells[3] || "",
        note: cells[4] || "",
        takeOff: cells[5] || "",
        transport: cells[6] || "",
        user: cells[7] || ""
      };
    })
    .filter(e => e !== null);

  if (logEntries.length === 0) {
    alert("No log data to export.");
    return;
  }

  // Common filename base
  const now = new Date();
  const pad = n => n.toString().padStart(2, "0");
  const filenameBase =
    `PointTrack_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
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
    "User"
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
      e.user
    ]);
  });

  const csvContent = csvRows.map(r => r.join(",")).join("\n");
  const csvName = `${filenameBase}.csv`;

  // ====================================================
  // KML EXPORT  (same colours as PointTrack exporter)
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
    if (hmsMatch) {
      const hour = pad2(parseInt(hmsMatch[1], 10));
      const minute = hmsMatch[2];
      return `${hour}:${minute}`;
    }

    const hmMatch = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
    if (hmMatch) {
      const hour = pad2(parseInt(hmMatch[1], 10));
      const minute = hmMatch[2];
      return `${hour}:${minute}`;
    }

    return timeStr;
  }

  function isTakeoff(e) {
    return e.takeOff && (e.takeOff.includes("✔") || e.takeOff.includes("X"));
  }

  // ---------- Point Placemarks (pins) ----------
  const regularPlacemarks = [];
  const takeoffPlacemarks = [];

  logEntries.forEach(e => {
    const mode = (e.transport || "").toLowerCase();
    const takeoffFlag = isTakeoff(e);
    const kmlTime = formatTimeForKml(e.time);

    let styleId;
    if (takeoffFlag) {
      styleId = "takeoffStyle";              // big blue helicopter
    } else if (mode === "walking") {
      styleId = "walkingStyle";              // small yellow pin
    } else if (mode === "helicopter") {
      styleId = "heliTransportStyle";        // small green pin
    } else {
      styleId = "drivingStyle";              // small blue pin (truck/atv/other)
    }

    const placemark = `
    <Placemark>
      <name>${kmlTime}</name>
      <styleUrl>#${styleId}</styleUrl>
      <description><![CDATA[
        Time: ${e.time}<br/>
        Heading: ${e.heading}<br/>
        Note: ${e.note}<br/>
        Take-Off: ${e.takeOff}<br/>
        Transport: ${e.transport}<br/>
        User: ${e.user}
      ]]></description>
      <Point>
        <coordinates>${e.lng.toFixed(5)},${e.lat.toFixed(5)},0</coordinates>
      </Point>
    </Placemark>`;

    if (takeoffFlag) {
      takeoffPlacemarks.push(placemark);
    } else {
      regularPlacemarks.push(placemark);
    }
  });

  const regularPointsFolder = `
    <Folder>
      <name>Points - Regular</name>
      ${regularPlacemarks.join("\n")}
    </Folder>`;

  const takeoffPointsFolder = `
    <Folder>
      <name>Points - Takeoff</name>
      ${takeoffPlacemarks.join("\n")}
    </Folder>`;

  // ---------- Paths: segment between each pair, coloured by CURRENT mode ----------
  let transportSegments = "";

  for (let i = 1; i < logEntries.length; i++) {
    const prev = logEntries[i - 1];
    const curr = logEntries[i];

    const mode = (curr.transport || "").toLowerCase();
    let styleId;
    if (mode === "walking") {
      styleId = "walkingLine";
    } else if (mode === "helicopter") {
      styleId = "heliLine";
    } else {
      styleId = "drivingLine"; // default for truck/atv/other
    }

    transportSegments += `
    <Placemark>
      <styleUrl>#${styleId}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          ${prev.lng.toFixed(5)},${prev.lat.toFixed(5)},0
          ${curr.lng.toFixed(5)},${curr.lat.toFixed(5)},0
        </coordinates>
      </LineString>
    </Placemark>`;
  }

  const pathsFolder = `
    <Folder>
      <name>Paths</name>
      ${transportSegments}
    </Folder>`;

  // ---------- Full KML document ----------
  const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${filenameBase}</name>

    <!-- PIN STYLES (match PointTrack exporter) -->
    <Style id="takeoffStyle">
      <IconStyle>
        <scale>1.3</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/heliport.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Style id="walkingStyle">
      <IconStyle>
        <scale>0.9</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Style id="drivingStyle">
      <IconStyle>
        <scale>0.9</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <Style id="heliTransportStyle">
      <IconStyle>
        <scale>0.9</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png</href>
        </Icon>
      </IconStyle>
    </Style>

    <!-- LINE STYLES (match PointTrack exporter) -->
    <Style id="walkingLine">
      <LineStyle>
        <color>ff00ffff</color> <!-- yellow -->
        <width>4</width>
      </LineStyle>
    </Style>

    <Style id="drivingLine">
      <LineStyle>
        <color>ffff0000</color> <!-- blue -->
        <width>4</width>
      </LineStyle>
    </Style>

    <Style id="heliLine">
      <LineStyle>
        <color>ff00ff00</color> <!-- green -->
        <width>4</width>
      </LineStyle>
    </Style>

    <!-- Draw order: paths, then regular pins, then takeoff pins -->
    ${pathsFolder}
    ${regularPointsFolder}
    ${takeoffPointsFolder}

  </Document>
</kml>`;

  const kmlName = `${filenameBase}.kml`;

  // ====================================================
  // ANDROID EXPORT VIA SAF (controller)
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

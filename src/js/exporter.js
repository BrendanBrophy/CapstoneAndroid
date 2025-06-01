document.getElementById("exportData").addEventListener("click", () => {
    if (trackingLog.length === 0) {
      alert("No data to export.");
      return;
    }
  
    let csv = "Time,Latitude,Longitude,Heading,Note,TakeOff\n";
  
    trackingLog.forEach(entry => {
      csv += `${entry.timestamp},${entry.lat},${entry.lng},${entry.heading},"${entry.note}",${entry.takeOff}\n`;
    });
  
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracking_log.csv";
    a.click();
  
    URL.revokeObjectURL(url);
  });
  
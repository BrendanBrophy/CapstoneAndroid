// gps.js
function startGPS(onUpdate, onError) {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported.");
    return null;
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const timestamp = new Date(pos.timestamp).toISOString();
      onUpdate({ lat, lng, timestamp });
    },
    onError,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );
}

function stopGPS(watchId) {
  if (watchId) navigator.geolocation.clearWatch(watchId);
}

// heading.js

// This function is called from Kotlin using evaluateJavascript()
// It will receive true north heading in degrees
window.updateHeading = function(degrees) {
  const headingDisplay = document.getElementById("heading");
  if (headingDisplay) {
    headingDisplay.textContent = degrees + "°";
  }
};

// (Optional) Comment out old browser-based heading code if present:
// window.addEventListener("deviceorientationabsolute", ...);
// window.addEventListener("deviceorientation", ...);

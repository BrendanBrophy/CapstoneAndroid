let headingHandler = null;

function startHeading(onHeadingUpdate) {
  headingHandler = function (e) {
    if (e.alpha !== null) {
      const heading = Math.round(e.alpha);
      onHeadingUpdate(heading);
    }
  };

  window.addEventListener("deviceorientation", headingHandler);
}

function stopHeading() {
  if (headingHandler) {
    window.removeEventListener("deviceorientation", headingHandler);
    headingHandler = null;
  }
}

const faderTicks = [12, 6, 0, -6, -12, -24, -48, -60, -80];
const minDb = -80;
const maxDb = 12;

function sysExValueToDb(sysExValue) {
  return -80 + sysExValue / 16;
}

function dbToSysExValue(db) {
  return (db + 80) * 16;
}

function dbToNormalized(y) {
  y = -y + 12;

  const sequence = faderTicks.map(s => -(s - maxDb));

  if (y < sequence[0]) {
    y = sequence[0];
  }
  if (y > sequence[sequence.length - 1]) {
    y = sequence[sequence.length - 1];
  }
  let lowerIndex = 0;
  let upperIndex = 0;

  for (let i = 0; i < sequence.length - 1; i++) {
    if (y >= sequence[i] && y <= sequence[i + 1]) {
      lowerIndex = i;
      upperIndex = i + 1;
      break;
    }
  }

  const lowerValue = sequence[lowerIndex];
  const upperValue = sequence[upperIndex];
  const fraction = (y - lowerValue) / (upperValue - lowerValue);

  const index = lowerIndex + fraction;
  return 1 - (index / (sequence.length - 1));
}

function normalizedToDb(x) {
  const sequence = faderTicks;

  if (x < 0) {
    x = 0
  };
  if (x > 1) {
    x = 1
  };

  const index = (1 - x) * (sequence.length - 1);

  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  const fraction = index - lowerIndex;

  const lowerValue = sequence[lowerIndex];
  const upperValue = sequence[upperIndex];

  return lowerValue + (upperValue - lowerValue) * fraction;
}

function onDocumentReady(callback) {
  if (document.attachEvent ? document.readyState === "complete" :
    document.readyState !== "loading") {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

function createFader(faderIndex, mixerContainer, faderTemplate) {
  let faderValue = 0; // 0..1
  let knobMouseOffset = 0;

  const fader = faderTemplate.content.cloneNode(true);

  const color = CHANNEL_COLORS[faderIndex];

  if (color != null) {
    const colorbar = fader.querySelector(".colorbar");
    colorbar.style.background = color;
  }

  const nameInput = fader.querySelector(".fader-name-input");
  nameInput.value = "" + (faderIndex + 1);

  const dbValueIndicator = fader.querySelector(".db-value-indicator");

  const faderContainer = fader.querySelector(".fader-container");
  const faderOverlay = fader.querySelector(".fader-mouse-overlay");

  const knob = fader.querySelector(".fader-knob");

  const faderRightTicks = fader.querySelector(".fader-right-ticks");

  faderTicks.forEach((tickDb) => {
    const tick = document.createElement('div');
    tick.className = tickDb === 0 ? "marker0" : "fader-tick" + " db" + tickDb;

    tick.style.top = (100 - dbToNormalized(tickDb) * 100) + "%";

    faderRightTicks.appendChild(tick);
  });

  function updateFader() {
    const rect = faderContainer.getBoundingClientRect();

    knob.style.top = (rect.height * (1 - faderValue)) + "px";

    const db = normalizedToDb(faderValue);

    dbValueIndicator.innerHTML = (db < 0 ? "" : "+") + db.toFixed(2);
  }

  function containerTouchStart(event) {
    const knobRect = knob.getBoundingClientRect();
    const rect = event.target.getBoundingClientRect();
    let mouseY = (event.clientY == null && event.touches ? event.touches[0].clientY : event.clientY) - rect.top;

    const mouseOffset = parseFloat(knob.style.top) - mouseY;
    
    if (!isNaN(mouseOffset) && Math.abs(mouseOffset) <= knobRect.height / 2) {
      knobMouseOffset = mouseOffset;
    }

    containerMouseMove(event);
  }

  function containerTouchEnd(event) {
    knobMouseOffset = 0;
  }

  function containerMouseMove(event) {
    console.log(" MOVE", knobMouseOffset)

    const rect = event.target.getBoundingClientRect();
    let mouseY = (event.clientY == null && event.touches ? event.touches[0].clientY : event.clientY) - rect.top;    

    if (knobMouseOffset) {
      mouseY += knobMouseOffset;
    }

    const positionY = 1 - mouseY / rect.height;

    if (event.buttons || (event.touches && event.touches.length)) {
      if (positionY >= 0 && positionY <= 1 && positionY !== faderValue) {
        faderValue = positionY;
        updateFader();
      }
    }
  }

  faderOverlay.addEventListener("mousemove", containerMouseMove);
  faderOverlay.addEventListener("touchmove", containerMouseMove);
  faderOverlay.addEventListener("touchstart", containerTouchStart);
  faderOverlay.addEventListener("touchend", containerTouchEnd);

  
  mixerContainer.appendChild(fader);
}

onDocumentReady(() => {
  function hasTouchSupport() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Disable context menu
  if (hasTouchSupport()) {
    window.oncontextmenu = function(event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };
  }

  const mixerContainer = document.querySelector("#mixer");
  const faderTemplate = document.querySelector("#fader");

  for (let faderIndex = 0; faderIndex < NUMBER_OF_CHANNELS; faderIndex++) {
    createFader(faderIndex, mixerContainer, faderTemplate);
  }
});
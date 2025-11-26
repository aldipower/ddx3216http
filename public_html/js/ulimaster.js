const sockIO = io();

const faderTicks = [12, 6, 0, -6, -12, -24, -48, -60, -80];
const minDb = -80;
const maxDb = 12;

function hasTouchSupport() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// function sysExValueToDb(sysExValue) {
//   return -80 + sysExValue / 16;
// }

// function dbToSysExValue(db) {
//   return (db + 80) * 16;
// }

function sysExPanToNormalized(sysExValue) {
  return sysExValue / 60
}

function normalizedPanToSysEx(value) {
  return Math.round(value * 60);
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
  let faderValue = dbToNormalized(0); // 0..1
  let panValue = 0.5;

  let knobMouseOffset = 0;

  const fader = faderTemplate.content.cloneNode(true);

  const color = CHANNEL_COLORS[faderIndex];

  if (color != null) {
    fader.querySelector(".colorbar").style.background = color;
    fader.querySelector(".colorbar.bottom").style.background = color;
  }

  const faderName = localStorage.getItem("faderName" + faderIndex) || "";

  const nameInput = fader.querySelector(".fader-name-input");
  nameInput.value = faderName === "" ? "" + (faderIndex + 1) : faderName;

  nameInput.addEventListener("change", () => {
    if (nameInput.value === "") {
      nameInput.value = faderIndex + 1 + "";
    }

    localStorage.setItem("faderName" + faderIndex, nameInput.value);
  });

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

  function changeFaderValue(value) {
    if (value > 1) {
      value = 1;
    } else if (value < 0) {
      value = 0;
    }

    if (value !== faderValue) {
      faderValue = value;
      sockIO.emit("vol",
        JSON.stringify({
          "channel": faderIndex + 1,
          "parameter": "",
          "value": normalizedToDb(faderValue),
        })
      );
    }
  }

  let faderTapedTwice = false;

  function containerTouchStart(event) {
    if (hasTouchSupport() && event.clientX) {
      return;
    }

    if (event.clientX != null) {
      if (faderTapedTwice) {
        faderTapedTwice = false;
        changeFaderValue(dbToNormalized(0));
        updateFader();
        return;
      } else {
        faderTapedTwice = true;
        setTimeout(function () {
          faderTapedTwice = false;
        }, 250);
      }
    }

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
    const rect = event.target.getBoundingClientRect();
    let mouseY = (event.clientY == null && event.touches ? event.touches[0].clientY : event.clientY) - rect.top;

    if (knobMouseOffset) {
      mouseY += knobMouseOffset;
    }

    const positionY = 1 - mouseY / rect.height;

    if (event.buttons || (event.touches && event.touches.length)) {
      if (positionY >= 0 && positionY <= 1 && positionY !== faderValue) {
        changeFaderValue(positionY);
        updateFader();
      }
    }
  }

  faderOverlay.addEventListener("mousedown", containerTouchStart);
  faderOverlay.addEventListener("mouseup", containerTouchEnd);
  faderOverlay.addEventListener("mouseout", containerTouchEnd);
  faderOverlay.addEventListener("mousemove", containerMouseMove);
  faderOverlay.addEventListener("touchmove", containerMouseMove);
  faderOverlay.addEventListener("touchstart", containerTouchStart);
  faderOverlay.addEventListener("touchend", containerTouchEnd);

  const muteButton = fader.querySelector(".mute-btn");

  const handleMuteButtonClick = function (event) {
    muteButton.classList.toggle('active');

    sockIO.emit("mute",
      JSON.stringify({
        "channel": faderIndex + 1,
        "parameter": "",
        "value": muteButton.classList.contains("active") ? 1 : 0,
      })
    );
  }

  muteButton.addEventListener("click", handleMuteButtonClick);

  const minusButton = fader.querySelector(".minus-btn");
  const plusButton = fader.querySelector(".plus-btn");

  minusButton.addEventListener("click", function (event) {
    changeFaderValue(dbToNormalized(normalizedToDb(faderValue) - 0.1));
    updateFader();
  });
  plusButton.addEventListener("click", function (event) {
    changeFaderValue(dbToNormalized(normalizedToDb(faderValue) + 0.1));
    updateFader();
  });

  const secContainer = fader.querySelector(".sec-container");
  const secOverlay = fader.querySelector(".sec-mouse-overlay");

  const secSlideIndicator = fader.querySelector(".sec-slide-indicator");
  const secValueIndicator = fader.querySelector(".sec-value-indicator");

  function updateSecFader() {
    const rect = secContainer.getBoundingClientRect();

    secSlideIndicator.style.width = (100 * sysExPanToNormalized(normalizedPanToSysEx(panValue))) + "%";

    let panDisplayed = normalizedPanToSysEx(panValue) - 30;

    if (panDisplayed === 0) {
      panDisplayed = "C";
    } else if (panDisplayed < 0) {
      panDisplayed = "L" + Math.abs(panDisplayed);
    } else if (panDisplayed > 0) {
      panDisplayed = "R" + Math.abs(panDisplayed);
    }

    secValueIndicator.innerHTML = panDisplayed;
  }

  function changePanValue(value) {
    if (value > 1) {
      value = 1;
    } else if (value < 0) {
      value = 0;
    }

    if (value !== faderValue) {
      panValue = value;

      sockIO.emit("pan",
        JSON.stringify({
          "channel": faderIndex + 1,
          "parameter": "",
          "value": normalizedPanToSysEx(panValue) - 30,
        })
      );
    }
  }

  let secTapedTwice = false;

  function secOverlayMouseDown(event) {
    if (event.clientX == null) {
      return;
    }

    if (secTapedTwice) {
      secTapedTwice = false;
      changePanValue(0.5);
      updateSecFader();
      return;
    } else {
      secTapedTwice = true;
      setTimeout(function () {
        secTapedTwice = false;
      }, 250);
    }

    secOverlayMouseMove(event);
  }

  function secOverlayMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    let mouseX = (event.clientX == null && event.touches ? event.touches[0].clientX : event.clientX) - rect.left;

    const positionX = mouseX / rect.width;

    if (event.buttons || (event.touches && event.touches.length)) {
      if (positionX >= 0 && positionX <= 1) {
        changePanValue(positionX);
        updateSecFader();
      }
    }
  }

  secOverlay.addEventListener("mousemove", secOverlayMouseMove);
  secOverlay.addEventListener("mousedown", secOverlayMouseDown);
  secOverlay.addEventListener("touchmove", secOverlayMouseMove);
  secOverlay.addEventListener("touchstart", secOverlayMouseDown);

  mixerContainer.appendChild(fader);

  function redraw() {
    updateFader();
    updateSecFader();
  }

  redraw();

  window.addEventListener("resize", redraw);

  function setVol(db) {
    faderValue = dbToNormalized(db);
    updateFader();
  }

  function setMute(muted) {
    if (muted) {
      if (!muteButton.classList.contains("active")) {
        muteButton.classList.add("active");
      }
    } else {
      if (muteButton.classList.contains("active")) {
        muteButton.classList.remove("active");
      }
    }
  }

  function setPan(db) {
    panValue = sysExPanToNormalized(db + 30);
    updateSecFader();
  }

  sockIO.on('connect', function () {
    const volume = JSON.stringify({
      "channel": faderIndex + 1,
      "setting": "vol",
      "parameter": ""
    });

    sockIO.emit("get", volume, setVol);

    const mute = JSON.stringify({
      "channel": faderIndex + 1,
      "setting": "mute",
      "parameter": ""
    });

    sockIO.emit("get", mute, setMute);

    const pan = JSON.stringify({
      "channel": faderIndex + 1,
      "setting": "pan",
      "parameter": ""
    });

    sockIO.emit("get", pan, setPan);
  });

  sockIO.on('midi', function (msg) {
    if (msg.channelNumber == null || msg.channelNumber - 1 !== faderIndex) {
      return;
    }

    console.log("Midi from Desk", msg);

    const type = msg.setting;

    if (type === "vol") {
      setVol(msg.value);
    } else if (type === "mute") {
      setMute(msg.value);
    } else if (type === "pan") {
      setPan(msg.value);
    }
  });
}

onDocumentReady(() => {
  // Disable context menu
  if (hasTouchSupport()) {
    window.oncontextmenu = function (event) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };
  }

  sockIO.on('connect', function () {
    // sockIO.on('midi', function (msg) {
    //   console.log("Midi from Desk", msg);
    //   var selector = ".channel-strip[data-event=" + msg.setting + "]";
    //   if (msg.parameter !== undefined) {
    //     selector += "[data-parameter=" + msg.parameter + "]";
    //   }
    //   var slider = $(selector + " .fader[data-channel=" + msg.channelNumber + "]");
    //   if (slider.length < 1) {
    //     console.log("Looks like we're not showing channel", msg.channelNumber, " event ", msg.setting, "param", msg.parameter);
    //     return;
    //   }
    //   slider.slider("setValue", msg.value);
    // });

  });

  const mixerContainer = document.querySelector("#mixer");
  const faderTemplate = document.querySelector("#fader");

  for (let faderIndex = 0; faderIndex < NUMBER_OF_CHANNELS; faderIndex++) {
    createFader(faderIndex, mixerContainer, faderTemplate);
  }

  document.querySelector(".fullscreen-icon").addEventListener("click", () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.querySelector(".app").requestFullscreen();
    }
  });
});
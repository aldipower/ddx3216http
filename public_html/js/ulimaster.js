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
  let knobGrabbed = false;

  const fader = faderTemplate.content.cloneNode(true);

  const color = CHANNEL_COLORS[faderIndex];

  if (color != null) {
    const colorbar = fader.querySelector(".colorbar");
    colorbar.style.background = color;
  }

  const nameInput = fader.querySelector(".fader-name-input");
  nameInput.value = ""+(faderIndex+1); 

  const faderContainer = fader.querySelector(".fader-container");

  const knob = fader.querySelector(".fader-knob");

  function updateFader() {
    const rect = faderContainer.getBoundingClientRect();

    knob.style.top = (rect.height * (1-faderValue)) + "px";

    console.log("updateFader", knob.style.top, faderValue, rect.height)
  }

  function knobMouseDown(event) {
    console.log("mousedown")
    knobGrabbed = true;
  }

  function knobMouseUp(event) {
    knobGrabbed = false;
  }

  function containerMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;

    const positionY = 1 - mouseY / rect.height;

    if (event.buttons) {
      faderValue = positionY;
      updateFader();
    }

    console.log(`faderIndex ${faderIndex} containerMouseMove `, mouseY, positionY, event)
  }

  faderContainer.addEventListener("mousemove", containerMouseMove);
  knob.addEventListener("mousedown", knobMouseDown);
  knob.addEventListener("mouseout", knobMouseUp);
  knob.addEventListener("mouseup", knobMouseUp);

  mixerContainer.appendChild(fader);
}

onDocumentReady(() => {
  const mixerContainer = document.querySelector("#mixer");
  const faderTemplate = document.querySelector("#fader");

  console.log("NUMBER_OF_CHANNELS", NUMBER_OF_CHANNELS)

  for (let faderIndex = 0; faderIndex < NUMBER_OF_CHANNELS; faderIndex++) {
    createFader(faderIndex, mixerContainer, faderTemplate);
  }
});


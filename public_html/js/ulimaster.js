function onDocumentReady(callback) {
  if (document.attachEvent ? document.readyState === "complete" :
    document.readyState !== "loading") {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

function createFader(faderIndex, mixerContainer, faderTemplate) {
  const fader = faderTemplate.content.cloneNode(true);

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


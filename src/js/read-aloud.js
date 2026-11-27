// One speech session follows the article across its two reading surfaces.
export function createReadAloud({ passages, onError = () => {} }) {
  const synth = window.speechSynthesis;
  const supported = Boolean(synth && window.SpeechSynthesisUtterance);
  const listeners = new Set();
  let state = "idle", chunks = [], index = 0, offset = 0, boundary = 0, session = 0;
  let utterance, voices = [];
  const language = document.documentElement.lang || "en";

  function publish(next) {
    state = next;
    for (const listener of listeners) listener(state);
  }

  function loadVoices() { voices = synth.getVoices(); }
  if (supported) {
    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
  }

  function voice() {
    const matching = voices.filter((item) => item.lang.split("-")[0] === language.split("-")[0]);
    const score = (item) => Number(/natural|neural|enhanced|premium/i.test(item.name)) * 8 +
      Number(item.lang.toLowerCase() === language.toLowerCase()) * 2 + Number(item.default);
    return matching.sort((a, b) => score(b) - score(a))[0];
  }

  function stop() {
    session++;
    if (supported && state !== "idle") synth.cancel();
    utterance = null;
    chunks = [];
    index = offset = boundary = 0;
    if (state !== "idle") publish("idle");
  }

  function speak() {
    if (index >= chunks.length) { stop(); return; }
    const token = ++session;
    utterance = new SpeechSynthesisUtterance(chunks[index].slice(offset));
    utterance.lang = language;
    const selected = voice();
    if (selected) utterance.voice = selected;
    boundary = 0;
    utterance.onboundary = (event) => {
      if (token === session && event.name === "word") boundary = event.charIndex;
    };
    utterance.onend = () => {
      if (token !== session) return;
      index++;
      offset = 0;
      speak();
    };
    utterance.onerror = (event) => {
      if (token !== session) return;
      stop();
      if (event.error !== "canceled" && event.error !== "interrupted") onError();
    };
    try { synth.speak(utterance); }
    catch { stop(); onError(); }
  }

  function toggle() {
    if (!supported) return;
    if (state === "playing") {
      // Cancel and continue at the last word: native pause/resume can get stuck
      // on mobile engines. Small utterances also avoid long-text cutoffs.
      session++;
      offset += boundary;
      synth.cancel();
      publish("paused");
      return;
    }
    if (state === "idle") {
      chunks = passages().flatMap((text) => text.match(/[^.!?]+[.!?]+[”’"']*|[^.!?]+$/g) || [text])
        .flatMap((text) => text.trim().match(/.{1,240}(?:\s+|$)|\S+/g) || [text]).map((text) => text.trim()).filter(Boolean);
      if (!chunks.length) return;
      index = offset = 0;
      loadVoices();
    }
    publish("playing");
    speak();
  }

  window.addEventListener("pagehide", stop);
  return {
    supported, toggle, stop,
    subscribe(listener) {
      if (!supported) return;
      listeners.add(listener);
      listener(state);
    },
  };
}

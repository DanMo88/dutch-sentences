/* Slow Dutch speech via the Web Speech API. Calls stay inside the tap handler. */
(function () {
  const RATE = 0.7;
  const listeners = new Set();
  let support = "pending";
  let token = 0;
  let keepAlive = 0;

  function hasSynth() {
    return typeof window !== "undefined" && "speechSynthesis" in window && window.speechSynthesis;
  }

  function nameOf(voice) {
    return `${voice.name || ""} ${voice.voiceURI || ""}`;
  }

  function langOf(voice) {
    return String(voice.lang || "").toLowerCase().replaceAll("_", "-");
  }

  function chooseVoice(voices) {
    let best = null;
    let bestScore = 0;
    for (const voice of voices || []) {
      const lang = langOf(voice);
      const named = /nederlands|netherlands|dutch|fenna/i.test(nameOf(voice));
      const nl = lang.startsWith("nl");
      const nlNl = lang === "nl-nl" || lang.startsWith("nl-nl-");
      let score = 0;
      if (nl && named) score = 100;
      else if (nl) score = 60;
      else if (named) score = 20;
      else continue;
      if (nlNl) score += 15;
      if (nl && /fenna/i.test(nameOf(voice))) score += 25;
      if (voice.localService) score += 1;
      if (score > bestScore) {
        best = voice;
        bestScore = score;
      }
    }
    return best;
  }

  function currentSupport() {
    if (!hasSynth()) return "unsupported";
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return "pending";
    return chooseVoice(voices) ? "nl" : "fallback";
  }

  function emit() {
    const next = currentSupport();
    support = next;
    listeners.forEach((fn) => fn(support));
  }

  function init() {
    if (!hasSynth()) {
      support = "unsupported";
      return;
    }
    emit();
    window.speechSynthesis.addEventListener("voiceschanged", emit);
  }

  function watch(fn) {
    listeners.add(fn);
    fn(support);
    return () => listeners.delete(fn);
  }

  function makeUtterance(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL";
    utterance.rate = RATE;
    utterance.pitch = 1;
    utterance.volume = 1;
    const voice = chooseVoice(window.speechSynthesis.getVoices());
    if (voice) {
      try {
        utterance.voice = voice;
      } catch (error) {
        /* Some engines reject a stand-in voice. lang nl-NL still applies. */
      }
    }
    return utterance;
  }

  function armKeepAlive(my) {
    window.clearInterval(keepAlive);
    keepAlive = window.setInterval(() => {
      if (my !== token || !hasSynth()) {
        window.clearInterval(keepAlive);
        return;
      }
      const synth = window.speechSynthesis;
      if (!synth.speaking && !synth.pending) {
        window.clearInterval(keepAlive);
        return;
      }
      if (synth.paused) synth.resume();
    }, 1000);
  }

  function stop() {
    token += 1;
    window.clearInterval(keepAlive);
    if (!hasSynth()) return;
    try {
      window.speechSynthesis.cancel();
    } catch (error) {
      /* ignore */
    }
  }

  function speak(texts, hooks) {
    const done = hooks || {};
    if (!hasSynth()) {
      done.onError?.("unsupported");
      return;
    }
    const synth = window.speechSynthesis;
    const my = ++token;
    try {
      synth.cancel();
    } catch (error) {
      /* ignore */
    }

    let heard = false;
    const enqueue = () => {
      texts.forEach((text, index) => {
        const utterance = makeUtterance(text);
        utterance.onstart = () => {
          if (my !== token) return;
          heard = true;
          done.onStart?.(index);
        };
        utterance.onend = () => {
          if (my !== token) return;
          if (index === texts.length - 1) done.onEnd?.();
        };
        utterance.onerror = (event) => {
          if (my !== token) return;
          const reason = event.error || "error";
          if (reason === "canceled" || reason === "interrupted") return;
          done.onError?.(reason);
        };
        synth.speak(utterance);
      });
      if (synth.paused) synth.resume();
    };

    /* Speak in this turn so mobile browsers treat it as a user gesture. */
    enqueue();
    armKeepAlive(my);
    window.setTimeout(() => {
      if (my !== token || heard) return;
      if (synth.speaking || synth.pending) return;
      enqueue();
    }, 160);
  }

  window.DutchSpeech = {
    RATE,
    init,
    speak,
    stop,
    watch,
    chooseVoice,
    get support() {
      return support;
    },
  };
})();

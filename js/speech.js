/* Same voice as 90 Dagen: pre-generated nl-NL-FennaNeural MP3s at -15%. */
(function () {
  const listeners = new Set();
  let support = "nl";
  let token = 0;
  const au = new Audio();
  au.preload = "auto";

  /* Must match tools/build.py slug(). */
  function slug(text) {
    return String(text).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      .slice(0, 100).replace(/-+$/g, "");
  }

  function srcFor(text) {
    const raw = String(text).trim();
    const kind = /[.?!]$/.test(raw) ? "s" : "w";
    return "audio/" + kind + "-" + slug(raw) + ".mp3";
  }

  function emit() {
    listeners.forEach((fn) => fn(support));
  }

  function init() {
    support = "nl";
    emit();
  }

  function watch(fn) {
    listeners.add(fn);
    fn(support);
    return () => listeners.delete(fn);
  }

  function stop() {
    token += 1;
    try { au.pause(); } catch (error) { /* ignore */ }
    au.removeAttribute("src");
    try { au.load(); } catch (error) { /* ignore */ }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (error) { /* ignore */ }
    }
  }

  function fallbackSpeak(texts, hooks, startAt, my) {
    const done = hooks || {};
    if (!(typeof window !== "undefined" && "speechSynthesis" in window)) {
      done.onError?.("unsupported");
      return;
    }
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch (error) { /* ignore */ }
    texts.slice(startAt).forEach((text, offset) => {
      const index = startAt + offset;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "nl-NL";
      utterance.rate = 0.75;
      utterance.onstart = () => {
        if (my !== token) return;
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
  }

  function speak(texts, hooks) {
    const done = hooks || {};
    const items = (texts || []).map((item) => (typeof item === "object" && item
      ? { text: String(item.text), src: item.src || srcFor(item.text) }
      : { text: String(item), src: srcFor(item) }));
    const list = items.map((item) => item.text);
    if (!list.length) {
      done.onEnd?.();
      return;
    }
    const my = ++token;
    try { au.pause(); } catch (error) { /* ignore */ }
    let i = 0;

    const step = () => {
      if (my !== token) return;
      if (i >= list.length) {
        done.onEnd?.();
        return;
      }
      const index = i;
      done.onStart?.(index);
      au.onended = () => {
        if (my !== token) return;
        i += 1;
        step();
      };
      au.onerror = () => {
        if (my !== token) return;
        fallbackSpeak(list, done, index, my);
      };
      au.src = items[index].src;
      au.playbackRate = 1;
      const play = au.play();
      if (play && play.catch) {
        play.catch(() => {
          if (my !== token) return;
          done.onError?.("not-allowed");
        });
      }
    };

    step();
  }

  window.DutchSpeech = {
    RATE: 0.85,
    init,
    slug,
    speak,
    stop,
    watch,
    chooseVoice: function () { return { name: "nl-NL-FennaNeural" }; },
    get support() {
      return support;
    },
  };
})();

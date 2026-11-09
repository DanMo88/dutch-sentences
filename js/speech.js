/* Same voice as 90 Dagen: pre-generated nl-NL-FennaNeural MP3s at -15%.
   Word taps stay instant by preloading/decoding clips for the current
   (and next) sentence into a reusable Audio pool before the learner taps. */
(function () {
  const listeners = new Set();
  let support = "nl";
  let token = 0;
  /** Shared fallback element when a clip is not yet in the pool. */
  const au = new Audio();
  au.preload = "auto";
  /** @type {Map<string, {el: HTMLAudioElement, ready: boolean}>} */
  const pool = new Map();
  /** Soft lead-in on Azure TTS word clips (~0.2s). Skip a little once ready. */
  const WORD_LEAD = 0.12;
  let playing = null;

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

  function isWordSrc(src) {
    return /\/w-/.test(src) || /^audio\/w-/.test(src);
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

  function stopElement(el) {
    if (!el) return;
    try { el.pause(); } catch (error) { /* ignore */ }
    try { el.currentTime = 0; } catch (error) { /* ignore */ }
    el.onended = null;
    el.onerror = null;
  }

  function stop() {
    token += 1;
    stopElement(playing);
    playing = null;
    stopElement(au);
    au.removeAttribute("src");
    try { au.load(); } catch (error) { /* ignore */ }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (error) { /* ignore */ }
    }
  }

  function ensureEntry(src) {
    let entry = pool.get(src);
    if (entry) return entry;
    const el = new Audio();
    el.preload = "auto";
    el.src = src;
    entry = { el, ready: false };
    const mark = () => { entry.ready = true; };
    el.addEventListener("canplaythrough", mark, { once: true });
    el.addEventListener("loadeddata", mark, { once: true });
    try { el.load(); } catch (error) { /* ignore */ }
    /* Also warm the service-worker / HTTP cache. */
    try { fetch(src, { credentials: "same-origin", cache: "force-cache" }).catch(() => {}); } catch (error) { /* ignore */ }
    pool.set(src, entry);
    return entry;
  }

  function preload(srcs) {
    const list = Array.from(new Set((srcs || []).filter(Boolean)));
    list.forEach((src) => ensureEntry(src));
    return list;
  }

  function leadFor(src) {
    if (!isWordSrc(src)) return 0;
    return WORD_LEAD;
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

  function pickPlayer(src) {
    const entry = pool.get(src);
    if (entry && entry.ready) return entry.el;
    if (entry) return entry.el;
    return null;
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
    preload(items.map((item) => item.src));
    const my = ++token;
    stopElement(playing);
    playing = null;
    try { au.pause(); } catch (error) { /* ignore */ }
    let i = 0;

    const step = () => {
      if (my !== token) return;
      if (i >= list.length) {
        playing = null;
        done.onEnd?.();
        return;
      }
      const index = i;
      const src = items[index].src;
      done.onStart?.(index);

      const pooled = pickPlayer(src);
      const el = pooled || au;
      playing = el;

      el.onended = () => {
        if (my !== token) return;
        i += 1;
        step();
      };
      el.onerror = () => {
        if (my !== token) return;
        playing = null;
        fallbackSpeak(list, done, index, my);
      };

      const absolute = (() => {
        try { return new URL(src, location.href).href; } catch (error) { return src; }
      })();
      if (el === au || (el.src && el.src !== absolute)) {
        el.src = src;
      }

      let started = false;
      const start = () => {
        if (my !== token || started) return;
        started = true;
        try {
          const lead = leadFor(src);
          if (lead > 0 && el.readyState >= 1 && Number.isFinite(el.duration) && el.duration > lead + 0.2) {
            el.currentTime = lead;
          } else {
            el.currentTime = 0;
          }
        } catch (error) {
          try { el.currentTime = 0; } catch (err) { /* ignore */ }
        }
        el.playbackRate = 1;
        const play = el.play();
        if (play && play.catch) {
          play.catch(() => {
            if (my !== token) return;
            done.onError?.("not-allowed");
          });
        }
      };

      if (el.readyState >= 2) {
        start();
      } else {
        const onReady = () => start();
        el.addEventListener("canplaythrough", onReady, { once: true });
        el.addEventListener("loadeddata", onReady, { once: true });
        try { el.load(); } catch (error) { /* ignore */ }
        setTimeout(onReady, 120);
      }
    };

    step();
  }

  window.DutchSpeech = {
    RATE: 0.85,
    init,
    slug,
    srcFor,
    speak,
    stop,
    preload,
    watch,
    chooseVoice: function () { return { name: "nl-NL-FennaNeural" }; },
    get support() {
      return support;
    },
  };
})();

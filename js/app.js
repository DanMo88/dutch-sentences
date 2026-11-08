(function () {
  const Z = "\u200c";
  const E = "\u0654";
  const app = document.getElementById("app");
  const STORE = "dutch-sentences-progress-v1";
  const LEVEL_NOTE = {
    A1: "از صفر: معرفی، خانواده، عدد، خانه، غذا",
    A2: "زندگی روزمره: خرید، کار، سفر، گذشته",
    B1: "حرف زدن درباره" + E + " نظر، تجربه و برنامه",
    B2: "جمله" + Z + "های بلندتر، بحث و کار",
  };

  const state = {
    screen: "home",
    course: null,
    lesson: null,
    lessonId: 1,
    level: "A1",
    index: 0,
    tiles: [],
    order: [],
    placed: [],
    status: "building",
    hideVoiceTip: false,
    speechBlocked: false,
    speechProblem: "",
    justSolved: false,
    shake: false,
    popId: null,
    loading: false,
    loadError: "",
  };

  let progress = { done: [], at: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Array.isArray(saved.done)) progress = { done: saved.done, at: saved.at || {} };
  } catch (error) { /* ignore */ }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (error) { /* ignore */ }
  }

  let active = null;
  const cache = {};

  function toFa(n) {
    return String(n).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[ch]));
  }

  function rich(text) {
    return String(text).split(/(\{[^}]+\})/g).map((part) => {
      const match = part.match(/^\{([^}]+)\}$/);
      if (!match) return esc(part);
      return `<bdi class="nl" lang="nl" dir="ltr">${esc(match[1])}</bdi>`;
    }).join("");
  }

  function core(word) {
    return String(word).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  }

  function wordItem(word, visual) {
    const c = core(word) || word;
    return { text: c, src: "audio/w-" + DutchSpeech.slug(c) + ".mp3", visual };
  }

  function allLessons() {
    if (!state.course) return [];
    return state.course.levels.flatMap((level) => level.lessons.map((l) => ({ ...l, level: level.id })));
  }

  function lessonMeta(id) {
    return allLessons().find((l) => l.id === id);
  }

  function isDone(id) {
    return progress.done.includes(id);
  }

  function nextLessonId() {
    const list = allLessons();
    const open = list.find((l) => !isDone(l.id));
    return open ? open.id : (list[0]?.id || 1);
  }

  function current() {
    return state.lesson.sentences[state.index];
  }

  function wordsOf(sentence) {
    return sentence.nl.replace(/[.?!]+$/, "").split(/\s+/);
  }

  function tileById(id) {
    return state.tiles.find((tile) => tile.id === id);
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function deal() {
    const words = wordsOf(current());
    state.tiles = words.map((text, index) => ({ id: `w${index}`, text }));
    let order = shuffle(state.tiles.map((tile) => tile.id));
    const solved = (list) => list.map((id) => tileById(id).text).join(" ") === words.join(" ");
    let guard = 0;
    while (solved(order) && guard < 12) {
      order = shuffle(order);
      guard += 1;
    }
    if (solved(order) && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    state.order = order;
    state.placed = [];
    state.status = "building";
  }

  function bankTiles() {
    const used = new Set(state.placed);
    return state.order.filter((id) => !used.has(id)).map(tileById);
  }

  function fitMarks() {
    if (state.status !== "wrong") return state.placed.map(() => null);
    const words = wordsOf(current());
    return state.placed.map((id, index) => tileById(id).text === words[index]);
  }

  function iconChevron() {
    return '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconSpeaker() {
    return '<svg class="speaker" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 10h3.2L12 6.2v11.6L7.2 14H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M17.8 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }

  function iconCheck() {
    return '<svg class="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function voiceTip() {
    if (state.hideVoiceTip) return "";
    if (DutchSpeech.support === "unsupported" || state.speechBlocked) {
      return "این مرورگر صدا را پخش نکرد. جمله را می" + Z + "توانی بسازی؛ برای شنیدن، صدای {Nederlands} را در تنظیمات گوشی فعال کن.";
    }
    return "";
  }

  function hintLine(primary, secondary) {
    return `<p class="feedback building"><span>${esc(primary)}</span><span>${esc(secondary)}</span></p>`;
  }

  function feedbackHtml() {
    if (state.status === "wrong") {
      const marks = fitMarks();
      const text = marks.some(Boolean)
        ? "نزدیک شدی. واژه" + Z + "های سبز سر جای خودشان هستند. بقیه را جابه" + Z + "جا کن."
        : "این ترتیب درست نیست. واژه" + Z + "ای را از جمله بردار و جای دیگری بگذار.";
      return `<p class="feedback wrong">${esc(text)}</p>`;
    }
    if (state.status === "correct") {
      return `<p class="feedback correct">${esc("درست است. لمس هر واژه فقط همان را تکرار می" + Z + "کند.")}</p>`;
    }
    return hintLine(
      "هر واژه را لمس کنی، آهسته می" + Z + "شنوی.",
      "لمس واژه" + E + " داخل جمله، آن را برمی" + Z + "دارد."
    );
  }

  function tileHtml(tile, mode, fit) {
    const action = mode === "locked" ? "replay-word" : mode === "placed" ? "remove" : "add";
    const label = mode === "locked"
      ? `${tile.text}. شنیدن واژه`
      : mode === "placed" ? `${tile.text}. برداشتن و شنیدن` : `${tile.text}. افزودن و شنیدن`;
    const classes = ["tile"];
    if (state.popId === tile.id) classes.push("pop");
    if (fit) classes.push("is-fit");
    return `<button type="button" class="${classes.join(" ")}" data-action="${action}" data-id="${tile.id}" data-word="${esc(tile.text)}" lang="nl" dir="ltr" aria-label="${esc(label)}">${esc(tile.text)}</button>`;
  }

  function flagsHtml() {
    return `
      <div class="flag-wrap">
        <img class="flag" src="images/shir-o-khorshid.svg" width="1050" height="600" alt="پرچم تاریخی شیر و خورشید" />
        <img class="flag flag-nl" src="images/nl.svg" width="900" height="600" alt="پرچم هلند" />
      </div>`;
  }

  function renderHome() {
    const course = state.course;
    if (!course) {
      return `<section class="home">${flagsHtml()}<h1 class="home-title" dir="ltr" lang="en">Dutch Sentences</h1>
        <p class="lede">${state.loadError ? esc(state.loadError) : "در حال آماده" + Z + "سازی درس" + Z + "ها…"}</p></section>`;
    }
    const lessons = allLessons();
    const totalSentences = lessons.reduce((sum, l) => sum + l.count, 0);
    const nextId = nextLessonId();
    const next = lessonMeta(nextId);
    const started = progress.at[nextId] > 0;
    const allDone = lessons.length && lessons.every((l) => isDone(l.id));
    const ctaLabel = allDone
      ? "مرور درس ۱"
      : (started ? "ادامه" + E + " درس " : (progress.done.length ? "درس بعدی: " : "شروع درس ")) + toFa(nextId);
    const levelTabs = course.levels.map((level) => {
      const done = level.lessons.filter((l) => isDone(l.id)).length;
      return `<button type="button" class="lvl-tab${state.level === level.id ? " is-on" : ""}" data-action="level" data-level="${level.id}" aria-pressed="${state.level === level.id}">
        <bdi dir="ltr" lang="en">${level.id}</bdi><small>${toFa(done)}/${toFa(level.lessons.length)}</small></button>`;
    }).join("");
    const level = course.levels.find((l) => l.id === state.level) || course.levels[0];
    const rows = level.lessons.map((l) => {
      const done = isDone(l.id);
      const isNext = l.id === nextId && !allDone;
      return `<li><button type="button" class="lesson-row${done ? " is-done" : ""}${isNext ? " is-next" : ""}" data-action="open" data-id="${l.id}">
        <span class="lesson-num">${done ? iconCheck() : toFa(l.id)}</span>
        <span class="lesson-txt"><span class="lesson-title">${esc(l.titleFa)}</span>
        <span class="lesson-sub">درس ${toFa(l.id)} · ${toFa(l.count)} جمله${isNext ? " · نوبت توست" : ""}</span></span>
        ${iconChevron()}
      </button></li>`;
    }).join("");
    return `
      <section class="home">
        ${flagsHtml()}
        <h1 class="home-title" dir="ltr" lang="en">Dutch Sentences</h1>
        <div class="rule" aria-hidden="true"></div>
        <p class="home-sub">جمله${Z}سازی هلندی از صفر تا <bdi dir="ltr" lang="en">B2</bdi></p>
        <p class="lede">واژه${Z}ها را بچین، تلفظ آهسته را بشنو و آخر هر درس یک متن کوتاه بخوان.</p>
        <button type="button" class="btn btn-gold" data-action="open" data-id="${allDone ? 1 : nextId}">${esc(ctaLabel)}</button>
        ${next && !allDone ? `<p class="next-title">${esc(next.titleFa)}</p>` : ""}
        <ul class="facts">
          <li>${toFa(lessons.length)} درس</li>
          <li>${toFa(totalSentences.toLocaleString("en-US"))} جمله</li>
          <li>تلفظ آهسته</li>
          <li>متن پایان درس</li>
        </ul>
        <div class="lvl-tabs" role="group" aria-label="سطح">${levelTabs}</div>
        <p class="lvl-note"><b>${esc(level.titleFa)}</b> · ${esc(LEVEL_NOTE[level.id] || "")}</p>
        <ol class="lesson-list">${rows}</ol>
        <p class="fine">میکروفون نمی${Z}خواهد. پیشرفتت فقط روی همین گوشی ذخیره می${Z}شود.</p>
      </section>
    `;
  }

  function topBar(countHtml, pct, sub) {
    return `
      <header class="top">
        <button type="button" class="icon-btn" data-action="home" aria-label="بازگشت به فهرست">${iconChevron()}</button>
        <div class="brand">
          <div class="brand-en" dir="ltr" lang="en">Dutch Sentences</div>
          <div class="brand-fa">${sub}</div>
        </div>
        <span class="top-spacer" aria-hidden="true"></span>
        <div class="progress">
          <span class="count">${countHtml}</span>
          <div class="track" aria-hidden="true"><div class="fill" style="width:${pct}%"></div></div>
        </div>
      </header>`;
  }

  function renderLoading() {
    return `<section class="lesson">${topBar("…", 0, "درس " + toFa(state.lessonId))}
      <div class="lesson-body"><p class="lede">${state.loadError ? esc(state.loadError) : "در حال باز کردن درس…"}</p>
      ${state.loadError ? `<button type="button" class="btn btn-navy" data-action="open" data-id="${state.lessonId}">دوباره امتحان کن</button>` : ""}</div></section>`;
  }

  function renderLesson(animateNotes, shake) {
    const lesson = state.lesson;
    const sentence = current();
    const total = lesson.sentences.length;
    const pct = ((state.index + 1) / total) * 100;
    const marks = fitMarks();
    const locked = state.status === "correct";
    const placed = state.placed.map((id, index) => tileHtml(tileById(id), locked ? "locked" : "placed", marks[index] === true)).join("");
    const bank = bankTiles().map((tile) => tileHtml(tile, "bank", false)).join("");
    const buildClass = ["build"];
    if (!state.placed.length) buildClass.push("is-empty");
    if (state.status === "wrong") buildClass.push("is-wrong");
    if (locked) buildClass.push("is-correct");
    if (shake) buildClass.push("shake");
    const end = (sentence.nl.match(/[.?!]+$/) || ["."])[0];
    const punct = locked ? `<span class="punct" lang="nl">${esc(end)}</span>` : "";
    const emptyBuild = state.placed.length ? "" : `<span class="placeholder">واژه${Z}ها این${Z}جا می${Z}نشینند</span>`;
    const bankBlock = locked ? "" : `
        <p class="section-label">واژه${Z}ها</p>
        <div class="bank" dir="ltr">
          ${bank || `<p class="bank-empty">برای جابه${Z}جا، واژه${Z}ای را از جمله بردار.</p>`}
        </div>`;
    const notes = locked ? `
        <section class="notes${animateNotes ? " enter" : ""}">
          <p class="notes-kicker">نکته${E} این جمله</p>
          <button type="button" class="sentence-replay" data-action="replay-sentence" dir="ltr" lang="nl" aria-label="${esc("شنیدن جمله: " + sentence.nl)}">
            <span>${esc(sentence.nl)}</span>
            ${iconSpeaker()}
          </button>
          <ul>${sentence.notes.map((note) => `<li>${rich(note)}</li>`).join("")}</ul>
          <button type="button" class="btn btn-gold btn-next" data-action="next">${state.index === total - 1 ? "متن پایان درس" : "جمله" + E + " بعدی"}</button>
        </section>` : "";
    return `
      <section class="lesson" data-status="${state.status}" data-index="${state.index}">
        ${topBar(`${toFa(state.index + 1)} از ${toFa(total)}`, pct, `درس ${toFa(lesson.id)} · ${esc(lesson.titleFa)}`)}
        <div class="voice-banner" data-voice-banner hidden>
          <span data-voice-text></span>
          <button type="button" data-action="dismiss-voice" aria-label="بستن راهنما">×</button>
        </div>
        <p class="speech-problem" data-speech-problem hidden></p>
        <div class="lesson-body">
          <p class="eyebrow">این را به هلندی بساز</p>
          <h2 class="meaning">${esc(sentence.fa)}</h2>
          <div class="label-row">
            <span>جمله${E} تو</span>
            <span class="speak-ind" hidden><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>آهسته</span>
          </div>
          <div class="${buildClass.join(" ")}" dir="ltr" lang="nl">${placed || emptyBuild}${punct}</div>
          ${feedbackHtml()}
          ${bankBlock}
        </div>
        <div class="notes-slot">${notes}</div>
      </section>`;
  }

  function renderDone() {
    const lesson = state.lesson;
    const meta = allLessons();
    const pos = meta.findIndex((l) => l.id === lesson.id);
    const next = meta[pos + 1];
    const reading = lesson.reading || [];
    const readNl = reading.map((line, i) => `<span class="read-line" data-line="${i}">${esc(line.nl)}</span>`).join(" ");
    const readFa = reading.map((line) => esc(line.fa)).join(" ");
    const rows = lesson.sentences.map((sentence, index) => `
      <button type="button" class="replay-row" data-action="replay-done" data-index="${index}" data-done="${index}" lang="nl" dir="ltr" aria-label="${esc("شنیدن جمله: " + sentence.nl)}">
        <span class="replay-top">${iconSpeaker()}<span class="replay-nl">${esc(sentence.nl)}</span></span>
        <span class="replay-fa" dir="rtl" lang="fa">${esc(sentence.fa)}</span>
      </button>`).join("");
    return `
      <section class="done">
        ${topBar("تمام", 100, `درس ${toFa(lesson.id)} · ${esc(lesson.titleFa)}`)}
        <p class="speech-problem" data-speech-problem hidden></p>
        <div class="done-body">
          <p class="done-kicker">آفرین</p>
          <h2 class="done-title">درس ${toFa(lesson.id)} تمام شد</h2>
          ${reading.length ? `
          <section class="reading" aria-label="متن پایان درس">
            <div class="reading-head">
              <p class="reading-kicker">متن پایان درس</p>
              <button type="button" class="play-read" data-action="play-reading">${iconSpeaker()}<span>آهسته بشنو</span></button>
            </div>
            <button type="button" class="reading-nl" data-action="play-reading" dir="ltr" lang="nl" aria-label="شنیدن متن">${readNl}</button>
            <p class="reading-label">ترجمه</p>
            <p class="reading-fa">${readFa}</p>
          </section>` : ""}
          ${lesson.recap ? `<p class="recap">${rich(lesson.recap)}</p>` : ""}
          <p class="section-label">جمله${Z}های این درس را دوباره بشنو</p>
          <div class="replay-list">${rows}</div>
          ${next ? `<button type="button" class="btn btn-navy" data-action="open" data-id="${next.id}">درس بعدی: ${toFa(next.id)} · ${esc(next.titleFa)}</button>` : `<p class="done-pill">همه${E} درس${Z}ها را تمام کردی!</p>`}
          <button type="button" class="btn btn-ghost" data-action="restart">از اول همین درس</button>
          <button type="button" class="btn btn-ghost" data-action="home">فهرست درس${Z}ها</button>
        </div>
      </section>`;
  }

  function applyVisual() {
    document.querySelectorAll(".is-speaking").forEach((el) => el.classList.remove("is-speaking"));
    document.querySelector(".build")?.classList.remove("is-speaking-sentence");
    const indicator = document.querySelector(".speak-ind");
    if (!active) {
      if (indicator) indicator.hidden = true;
      return;
    }
    if (indicator && state.screen === "lesson") indicator.hidden = false;
    if (active.type === "word") {
      document.querySelector(`.tile[data-id="${active.id}"]`)?.classList.add("is-speaking");
    } else if (active.type === "sentence") {
      document.querySelector(".build")?.classList.add("is-speaking-sentence");
      document.querySelector(".sentence-replay")?.classList.add("is-speaking");
    } else if (active.type === "done") {
      document.querySelector(`[data-done="${active.index}"]`)?.classList.add("is-speaking");
    } else if (active.type === "reading") {
      document.querySelector(".reading")?.classList.add("is-speaking");
    }
  }

  function updateVoiceBanner() {
    const banner = document.querySelector("[data-voice-banner]");
    if (!banner) return;
    const text = voiceTip();
    banner.hidden = !text;
    const slot = banner.querySelector("[data-voice-text]");
    if (slot) slot.innerHTML = rich(text);
  }

  function updateSpeechProblem() {
    const el = document.querySelector("[data-speech-problem]");
    if (!el) return;
    el.hidden = !state.speechProblem;
    el.textContent = state.speechProblem;
  }

  function announce(text) {
    const live = document.getElementById("live");
    if (!live) return;
    live.textContent = "";
    window.setTimeout(() => { live.textContent = text; }, 40);
  }

  function scrollTop() {
    window.scrollTo(0, 0);
    app.scrollTo?.(0, 0);
  }

  function render() {
    const animateNotes = state.justSolved;
    const shake = state.shake;
    const screen = state.screen;
    app.dataset.screen = screen;
    document.body.dataset.screen = screen;
    app.innerHTML = screen === "home"
      ? renderHome()
      : screen === "loading"
        ? renderLoading()
        : screen === "done" ? renderDone() : renderLesson(animateNotes, shake);
    state.justSolved = false;
    state.shake = false;
    state.popId = null;
    applyVisual();
    updateVoiceBanner();
    updateSpeechProblem();
    if (animateNotes) {
      const notes = document.querySelector(".notes");
      if (notes) window.requestAnimationFrame(() => notes.scrollIntoView({ behavior: "smooth", block: "end" }));
    }
  }

  function speakItems(items) {
    active = items[0]?.visual || null;
    applyVisual();
    DutchSpeech.speak(items.map((item) => (item.src ? { text: item.text, src: item.src } : item.text)), {
      onStart(index) {
        state.speechProblem = "";
        updateSpeechProblem();
        active = items[index].visual;
        applyVisual();
      },
      onEnd() {
        active = null;
        applyVisual();
      },
      onError(reason) {
        active = null;
        applyVisual();
        if (reason === "not-allowed") {
          state.speechProblem = "مرورگر صدا را قطع کرد. یک بار دیگر لمس کن.";
          updateSpeechProblem();
          return;
        }
        state.speechBlocked = true;
        updateVoiceBanner();
      },
    });
  }

  function placedWords() {
    return state.placed.map((id) => tileById(id).text);
  }

  function afterAdd(id) {
    const sentence = current();
    const words = wordsOf(sentence);
    const complete = state.placed.length === words.length;
    const correct = complete && placedWords().join(" ") === words.join(" ");
    const visual = { type: "word", id };
    const word = tileById(id).text;
    state.popId = id;
    if (correct) {
      state.status = "correct";
      state.justSolved = true;
      render();
      speakItems([wordItem(word, visual), { text: sentence.nl, visual: { type: "sentence" } }]);
      announce("درست است. نکته" + E + " این جمله پایین صفحه است.");
      return;
    }
    if (complete) {
      state.status = "wrong";
      state.shake = true;
      render();
      speakItems([wordItem(word, visual)]);
      announce(document.querySelector(".feedback")?.textContent || "");
      return;
    }
    state.status = "building";
    render();
    speakItems([wordItem(word, visual)]);
  }

  function addTile(id) {
    if (state.status === "correct") return;
    if (!tileById(id) || state.placed.includes(id)) return;
    state.placed.push(id);
    afterAdd(id);
  }

  function onPlaced(id, action) {
    const tile = tileById(id);
    if (!tile) return;
    if (action === "replay-word" || state.status === "correct") {
      speakItems([wordItem(tile.text, { type: "word", id })]);
      return;
    }
    state.placed = state.placed.filter((item) => item !== id);
    state.status = "building";
    state.popId = id;
    render();
    speakItems([wordItem(tile.text, { type: "word", id })]);
  }

  function finishLesson() {
    const id = state.lesson.id;
    if (!progress.done.includes(id)) progress.done.push(id);
    delete progress.at[id];
    save();
    state.screen = "done";
    render();
    scrollTop();
    announce("درس " + toFa(id) + " تمام شد. حالا متن پایان درس را بخوان.");
  }

  function nextSentence() {
    if (state.status !== "correct") return;
    DutchSpeech.stop();
    active = null;
    if (state.index >= state.lesson.sentences.length - 1) {
      finishLesson();
      return;
    }
    state.index += 1;
    progress.at[state.lesson.id] = state.index;
    save();
    deal();
    render();
    scrollTop();
  }

  function fetchJson(url) {
    if (cache[url]) return Promise.resolve(cache[url]);
    return fetch(url + "?v=" + (window.DS_VERSION || "1")).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    }).then((data) => {
      cache[url] = data;
      return data;
    });
  }

  function lessonUrl(id) {
    return "data/lessons/" + String(id).padStart(3, "0") + ".json";
  }

  function openLesson(id, fromStart) {
    DutchSpeech.stop();
    active = null;
    state.lessonId = id;
    state.loadError = "";
    const meta = lessonMeta(id);
    if (meta) state.level = meta.level;
    if (!cache[lessonUrl(id)]) {
      state.screen = "loading";
      render();
      scrollTop();
    }
    fetchJson(lessonUrl(id)).then((lesson) => {
      if (state.lessonId !== id) return;
      state.lesson = lesson;
      const resume = fromStart ? 0 : (progress.at[id] || 0);
      state.index = Math.min(resume, lesson.sentences.length - 1);
      state.screen = "lesson";
      deal();
      render();
      scrollTop();
      if (lessonMeta(id + 1)) fetchJson(lessonUrl(id + 1)).catch(() => {});
    }).catch(() => {
      state.loadError = "درس باز نشد. اینترنت را بررسی کن و دوباره امتحان کن.";
      state.screen = "loading";
      render();
    });
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !app.contains(button)) return;
    const action = button.dataset.action;
    if (action === "open") {
      const id = Number(button.dataset.id);
      openLesson(id, isDone(id));
      return;
    }
    if (action === "level") {
      state.level = button.dataset.level;
      render();
      return;
    }
    if (action === "restart") {
      progress.at[state.lesson.id] = 0;
      save();
      openLesson(state.lesson.id, true);
      return;
    }
    if (action === "home") {
      DutchSpeech.stop();
      active = null;
      state.screen = "home";
      render();
      scrollTop();
      return;
    }
    if (action === "dismiss-voice") {
      state.hideVoiceTip = true;
      updateVoiceBanner();
      return;
    }
    if (action === "add") { addTile(button.dataset.id); return; }
    if (action === "remove" || action === "replay-word") { onPlaced(button.dataset.id, action); return; }
    if (action === "replay-sentence") {
      if (state.status !== "correct") return;
      speakItems([{ text: current().nl, visual: { type: "sentence" } }]);
      return;
    }
    if (action === "next") { nextSentence(); return; }
    if (action === "play-reading") {
      const lesson = state.lesson;
      if (!lesson || !lesson.reading) return;
      speakItems([{
        text: lesson.reading.map((line) => line.nl).join(" "),
        src: lesson.readingAudio,
        visual: { type: "reading" },
      }]);
      return;
    }
    if (action === "replay-done") {
      const index = Number(button.dataset.index);
      const sentence = state.lesson.sentences[index];
      if (!sentence) return;
      speakItems([{ text: sentence.nl, visual: { type: "done", index } }]);
    }
  }

  DutchSpeech.init();
  DutchSpeech.watch(() => updateVoiceBanner());
  app.addEventListener("click", onClick);
  render();
  fetchJson("data/course.json").then((course) => {
    state.course = course;
    const meta = lessonMeta(nextLessonId());
    if (meta) state.level = meta.level;
    render();
  }).catch(() => {
    state.loadError = "فهرست درس" + Z + "ها باز نشد. اینترنت را بررسی کن و صفحه را دوباره باز کن.";
    render();
  });
})();

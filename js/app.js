(function () {
  const Z = "\u200c";
  const E = "\u0654";
  const lesson = window.DUTCH_LESSON;
  const app = document.getElementById("app");

  const state = {
    screen: "home",
    index: 0,
    tiles: [],
    order: [],
    placed: [],
    status: "building",
    completedLesson: false,
    hideVoiceTip: false,
    speechBlocked: false,
    speechProblem: "",
    justSolved: false,
    shake: false,
    popId: null,
  };

  let active = null;

  function toFa(n) {
    return String(n).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function rich(text) {
    return String(text).split(/(\{[^}]+\})/g).map((part) => {
      const match = part.match(/^\{([^}]+)\}$/);
      if (!match) return esc(part);
      return `<bdi class="nl" lang="nl" dir="ltr">${esc(match[1])}</bdi>`;
    }).join("");
  }

  function current() {
    return lesson.sentences[state.index];
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
    const words = current().words;
    state.tiles = words.map((text, index) => ({ id: `w${index}`, text }));
    let order = shuffle(state.tiles.map((tile) => tile.id));
    const solved = (list) => list.every((id, index) => id === `w${index}`);
    let guard = 0;
    while (solved(order) && guard < 8) {
      order = shuffle(order);
      guard += 1;
    }
    if (solved(order) && order.length > 1) {
      [order[0], order[1]] = [order[1], order[0]];
    }
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
    const words = current().words;
    return state.placed.map((id, index) => tileById(id).text === words[index]);
  }

  function iconChevron() {
    return '<svg class="chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function iconSpeaker() {
    return '<svg class="speaker" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 10h3.2L12 6.2v11.6L7.2 14H4z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M17.8 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  }

  function voiceTip() {
    if (state.hideVoiceTip) return "";
    if (DutchSpeech.support === "unsupported" || state.speechBlocked) {
      return "این مرورگر صدا را پخش نکرد. جمله را می" + Z + "توانی بسازی؛ برای شنیدن، صدای {Nederlands} را در تنظیمات گوشی فعال کن.";
    }
    if (DutchSpeech.support === "fallback") {
      return "صدای هلندی پیدا نشد. گفتار با {nl-NL} درخواست می" + Z + "شود؛ برای تلفظ بهتر، صدای {Nederlands} را در تنظیمات گوشی فعال کن.";
    }
    return "";
  }

  function homeCta() {
    if (state.completedLesson) return { action: "restart", label: "دوباره از اول" };
    const started = state.index > 0 || state.placed.length > 0 || state.status === "correct";
    if (started) return { action: "resume", label: "ادامه" + E + " درس ۱" };
    return { action: "start", label: "شروع درس ۱" };
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
      : mode === "placed"
        ? `${tile.text}. برداشتن و شنیدن`
        : `${tile.text}. افزودن و شنیدن`;
    const classes = ["tile"];
    if (state.popId === tile.id) classes.push("pop");
    if (fit) classes.push("is-fit");
    return `<button type="button" class="${classes.join(" ")}" data-action="${action}" data-id="${tile.id}" data-word="${esc(tile.text)}" lang="nl" dir="ltr" aria-label="${esc(label)}">${esc(tile.text)}</button>`;
  }

  function renderHome() {
    const first = lesson.sentences[0];
    const cta = homeCta();
    const doneNote = state.completedLesson
      ? `<p class="done-pill">درس ۱ را یک بار تمام کردی.</p>`
      : "";
    return `
      <section class="home">
        <div class="flag-wrap">
          <img class="flag" src="images/shir-o-khorshid.svg" width="420" height="240" alt="پرچم تاریخی شیر و خورشید" />
        </div>
        <p class="eyebrow">سطح مطلق <bdi dir="ltr" lang="en">A1</bdi> · درس ۱</p>
        <div class="home-grow"></div>
        <h1 class="home-title" dir="ltr" lang="en">Dutch Sentences</h1>
        <div class="rule" aria-hidden="true"></div>
        <p class="home-sub">جمله${Z}سازی هلندی از صفر</p>
        <p class="lede">هشت جمله${E} کوتاه برای معرفی خودت. واژه${Z}ها را بچین و تلفظ آهسته را بشنو.</p>
        <div class="preview" aria-hidden="true">
          <p class="preview-nl" dir="ltr" lang="nl">${esc(first.sentence)}</p>
          <p class="preview-fa" dir="rtl">${esc(first.meaning)}</p>
        </div>
        ${doneNote}
        <div class="home-grow"></div>
        <button type="button" class="btn btn-gold" data-action="${cta.action}">${esc(cta.label)}</button>
        <ul class="facts">
          <li>۸ جمله</li>
          <li>تلفظ آهسته</li>
          <li>نکته${E} دستوری</li>
        </ul>
        <p class="fine">میکروفون نمی${Z}خواهد. صدا فقط پخش می${Z}شود.</p>
      </section>
    `;
  }

  function renderLesson(animateNotes, shake) {
    const sentence = current();
    const total = lesson.sentences.length;
    const pct = ((state.index + 1) / total) * 100;
    const marks = fitMarks();
    const locked = state.status === "correct";
    const placed = state.placed.map((id, index) => tileHtml(
      tileById(id),
      locked ? "locked" : "placed",
      marks[index] === true
    )).join("");
    const bank = bankTiles().map((tile) => tileHtml(tile, "bank", false)).join("");
    const buildClass = ["build"];
    if (!state.placed.length) buildClass.push("is-empty");
    if (state.status === "wrong") buildClass.push("is-wrong");
    if (locked) buildClass.push("is-correct");
    if (shake) buildClass.push("shake");
    const punct = locked ? `<span class="punct" lang="nl">${esc(sentence.sentence.endsWith("?") ? "?" : ".")}</span>` : "";
    const emptyBuild = state.placed.length
      ? ""
      : `<span class="placeholder">واژه${Z}ها این${Z}جا می${Z}نشینند</span>`;
    const bankBlock = locked
      ? ""
      : `
        <p class="section-label">واژه${Z}ها</p>
        <div class="bank" dir="ltr">
          ${bank || `<p class="bank-empty">برای جابه${Z}جا، واژه${Z}ای را از جمله بردار.</p>`}
        </div>
      `;
    const notes = locked
      ? `
        <section class="notes${animateNotes ? " enter" : ""}">
          <p class="notes-kicker">نکته${E} این جمله</p>
          <button type="button" class="sentence-replay" data-action="replay-sentence" dir="ltr" lang="nl" aria-label="${esc("شنیدن جمله: " + sentence.sentence)}">
            <span>${esc(sentence.sentence)}</span>
            ${iconSpeaker()}
          </button>
          <ul>${sentence.notes.map((note) => `<li>${rich(note)}</li>`).join("")}</ul>
          <button type="button" class="btn btn-gold btn-next" data-action="next">${
            state.index === total - 1 ? "پایان درس" : "جمله" + E + " بعدی"
          }</button>
        </section>
      `
      : "";

    return `
      <section class="lesson" data-status="${state.status}" data-index="${state.index}">
        <header class="top">
          <button type="button" class="icon-btn" data-action="home" aria-label="بازگشت به شروع">${iconChevron()}</button>
          <div class="brand">
            <div class="brand-en" dir="ltr" lang="en">Dutch Sentences</div>
            <div class="brand-fa">${esc(lesson.titleFa)}</div>
          </div>
          <span class="top-spacer" aria-hidden="true"></span>
          <div class="progress">
            <span class="count">${toFa(state.index + 1)} از ${toFa(total)}</span>
            <div class="track" aria-hidden="true"><div class="fill" style="width:${pct}%"></div></div>
          </div>
        </header>
        <div class="voice-banner" data-voice-banner hidden>
          <span data-voice-text></span>
          <button type="button" data-action="dismiss-voice" aria-label="بستن راهنما">×</button>
        </div>
        <p class="speech-problem" data-speech-problem hidden></p>
        <div class="lesson-body">
          <p class="eyebrow">این را به هلندی بساز</p>
          <h2 class="meaning">${esc(sentence.meaning)}</h2>
          <div class="label-row">
            <span>جمله${E} تو</span>
            <span class="speak-ind" hidden>
              <span class="bars" aria-hidden="true"><i></i><i></i><i></i></span>
              آهسته
            </span>
          </div>
          <div class="${buildClass.join(" ")}" dir="ltr" lang="nl">
            ${placed || emptyBuild}
            ${punct}
          </div>
          ${feedbackHtml()}
          ${bankBlock}
        </div>
        <div class="notes-slot">${notes}</div>
      </section>
    `;
  }

  function renderDone() {
    const rows = lesson.sentences.map((sentence, index) => `
      <button type="button" class="replay-row" data-action="replay-done" data-index="${index}" data-done="${index}" lang="nl" dir="ltr" aria-label="${esc("شنیدن جمله: " + sentence.sentence)}">
        <span class="replay-top">
          ${iconSpeaker()}
          <span class="replay-nl">${esc(sentence.sentence)}</span>
        </span>
        <span class="replay-fa" dir="rtl" lang="fa">${esc(sentence.meaning)}</span>
      </button>
    `).join("");
    const recap = "در جمله" + Z + "های خبری، فعل معمولاً واژه" + E + " دوم بود. در سؤال با {hoe} و {waar}، فعل قبل از فاعل آمد.";
    return `
      <section class="done">
        <header class="top">
          <button type="button" class="icon-btn" data-action="home" aria-label="بازگشت به شروع">${iconChevron()}</button>
          <div class="brand">
            <div class="brand-en" dir="ltr" lang="en">Dutch Sentences</div>
            <div class="brand-fa">درس ۱</div>
          </div>
          <span class="top-spacer" aria-hidden="true"></span>
          <div class="progress">
            <span class="count">تمام</span>
            <div class="track" aria-hidden="true"><div class="fill" style="width:100%"></div></div>
          </div>
        </header>
        <div class="done-body">
          <p class="done-kicker">آفرین</p>
          <h2 class="done-title">درس ۱ تمام شد</h2>
          <p class="recap">${rich(recap)}</p>
          <p class="section-label">جمله${Z}ها را دوباره بشنو</p>
          <div class="replay-list">${rows}</div>
          <button type="button" class="btn btn-navy" data-action="restart">از اول درس ۱</button>
        </div>
      </section>
    `;
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
    window.setTimeout(() => {
      live.textContent = text;
    }, 40);
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
      : screen === "done"
        ? renderDone()
        : renderLesson(animateNotes, shake);
    state.justSolved = false;
    state.shake = false;
    state.popId = null;
    const theme = document.querySelector('meta[name="theme-color"]');
    if (theme) theme.setAttribute("content", screen === "home" ? "#102033" : "#fff8f1");
    applyVisual();
    updateVoiceBanner();
    updateSpeechProblem();
    if (animateNotes) {
      const notes = document.querySelector(".notes");
      if (notes) {
        window.requestAnimationFrame(() => {
          notes.scrollIntoView({ behavior: "smooth", block: "end" });
        });
      }
    }
  }

  function speakItems(items) {
    active = items[0]?.visual || null;
    applyVisual();
    DutchSpeech.speak(items.map((item) => item.text), {
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
          state.speechProblem = "مرورگر صدا را قطع کرد. یک بار دیگر همان واژه را لمس کن.";
          updateSpeechProblem();
          return;
        }
        if (
          reason === "synthesis-failed" ||
          reason === "language-unavailable" ||
          reason === "voice-unavailable" ||
          reason === "audio-busy"
        ) {
          state.speechBlocked = true;
          updateVoiceBanner();
        }
      },
    });
  }

  function placedWords() {
    return state.placed.map((id) => tileById(id).text);
  }

  function afterAdd(id) {
    const sentence = current();
    const complete = state.placed.length === sentence.words.length;
    const correct = complete && placedWords().join(" ") === sentence.words.join(" ");
    const visual = { type: "word", id };
    const word = tileById(id).text;
    if (correct) {
      state.status = "correct";
      state.justSolved = true;
      state.popId = id;
      render();
      speakItems([
        { text: word, visual },
        { text: sentence.sentence, visual: { type: "sentence" } },
      ]);
      announce("درست است. نکته" + E + " دستوری پایین صفحه است.");
      return;
    }
    if (complete) {
      state.status = "wrong";
      state.shake = true;
      state.popId = id;
      render();
      speakItems([{ text: word, visual }]);
      announce(document.querySelector(".feedback")?.textContent || "");
      return;
    }
    state.status = "building";
    state.popId = id;
    render();
    speakItems([{ text: word, visual }]);
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
      speakItems([{ text: tile.text, visual: { type: "word", id } }]);
      return;
    }
    state.placed = state.placed.filter((item) => item !== id);
    state.status = "building";
    state.popId = id;
    render();
    speakItems([{ text: tile.text, visual: { type: "word", id } }]);
  }

  function nextSentence() {
    if (state.status !== "correct") return;
    DutchSpeech.stop();
    active = null;
    if (state.index >= lesson.sentences.length - 1) {
      state.completedLesson = true;
      state.screen = "done";
      render();
      scrollTop();
      announce("درس ۱ تمام شد.");
      return;
    }
    state.index += 1;
    deal();
    render();
    scrollTop();
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || !app.contains(button)) return;
    const action = button.dataset.action;
    if (action === "start" || action === "resume") {
      DutchSpeech.stop();
      active = null;
      state.screen = "lesson";
      render();
      scrollTop();
      return;
    }
    if (action === "restart") {
      DutchSpeech.stop();
      active = null;
      state.completedLesson = false;
      state.index = 0;
      state.screen = "lesson";
      deal();
      render();
      scrollTop();
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
    if (action === "add") {
      addTile(button.dataset.id);
      return;
    }
    if (action === "remove" || action === "replay-word") {
      onPlaced(button.dataset.id, action);
      return;
    }
    if (action === "replay-sentence") {
      if (state.status !== "correct") return;
      speakItems([{ text: current().sentence, visual: { type: "sentence" } }]);
      return;
    }
    if (action === "next") {
      nextSentence();
      return;
    }
    if (action === "replay-done") {
      const index = Number(button.dataset.index);
      const sentence = lesson.sentences[index];
      if (!sentence) return;
      speakItems([{ text: sentence.sentence, visual: { type: "done", index } }]);
    }
  }

  DutchSpeech.init();
  DutchSpeech.watch(() => updateVoiceBanner());
  deal();
  app.addEventListener("click", onClick);
  render();
})();

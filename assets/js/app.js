const STORAGE_KEY = "rutastack-v1";

const state = {
  view: "home",
  lessonId: "mapa",
  storyId: "pregunta",
  storyStep: 0,
  decision: 0,
  query: "",
  picked: {},
};

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { done: {}, decisions: {} };
    const data = JSON.parse(raw);
    return {
      done: data.done && typeof data.done === "object" ? data.done : {},
      decisions: data.decisions && typeof data.decisions === "object" ? data.decisions : {},
    };
  } catch {
    return { done: {}, decisions: {} };
  }
}

let progress = loadProgress();

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function pathIds() {
  return TRACKS.flatMap((track) => track.ids);
}

function lessonIndex(id) {
  return pathIds().indexOf(id);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function doneCount() {
  return pathIds().filter((id) => progress.done[id]).length;
}

function decisionCount() {
  return DECISIONS.filter((item) => progress.decisions[item.id]).length;
}

function hashFor() {
  if (state.view === "lesson") return "#/leccion/" + state.lessonId;
  if (state.view === "story") return "#/recorrido/" + state.storyId + "/" + state.storyStep;
  if (state.view === "decisions") return "#/decisiones/" + state.decision;
  if (state.view === "glossary") return "#/glosario";
  return "#/";
}

function readHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [head, a, b] = parts;
  if (head === "leccion" && LESSONS[a]) {
    state.view = "lesson";
    state.lessonId = a;
    return;
  }
  if (head === "recorrido" && STORIES.some((story) => story.id === a)) {
    state.view = "story";
    state.storyId = a;
    const story = STORIES.find((item) => item.id === a);
    const step = Number(b);
    state.storyStep = Number.isInteger(step) && step >= 0 && step < story.steps.length ? step : 0;
    return;
  }
  if (head === "decisiones") {
    state.view = "decisions";
    const index = Number(a);
    state.decision = Number.isInteger(index) && index >= 0 && index < DECISIONS.length ? index : 0;
    return;
  }
  if (head === "glosario") {
    state.view = "glossary";
    return;
  }
  state.view = "home";
}

function go(next) {
  Object.assign(state, next);
  const hash = hashFor();
  if (location.hash !== hash) history.pushState(null, "", hash);
  render();
}

function renderBlocks(blocks) {
  return blocks.map((block) => {
    if (block.t === "p") return `<p>${esc(block.text)}</p>`;
    if (block.t === "h") return `<h3>${esc(block.text)}</h3>`;
    if (block.t === "ul") {
      return `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
    }
    if (block.t === "ol") {
      return `<ol>${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ol>`;
    }
    if (block.t === "note") {
      return `<aside class="note note-${esc(block.kind)}"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
    }
    if (block.t === "code") {
      const body = block.lines.map((line) => esc(line)).join("\n");
      return `<figure class="code"><figcaption>${esc(block.file)}</figcaption><pre><code>${body}</code></pre></figure>`;
    }
    if (block.t === "table") {
      const head = block.heads.map((cell) => `<th>${esc(cell)}</th>`).join("");
      const rows = block.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`)
        .join("");
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    if (block.t === "src") {
      const external = /^https?:/.test(block.href);
      const attrs = external ? ' target="_blank" rel="noreferrer"' : "";
      return `<p class="src"><a href="${esc(block.href)}"${attrs}>${esc(block.label)}</a></p>`;
    }
    return "";
  }).join("");
}

function renderLesson(id) {
  const lesson = LESSONS[id];
  const index = lessonIndex(id);
  const ids = pathIds();
  const prev = index > 0 ? ids[index - 1] : null;
  const next = index < ids.length - 1 ? ids[index + 1] : null;
  const picked = state.picked[id];
  const options = lesson.quiz.options.map((option, optionIndex) => {
    const chosen = picked === optionIndex;
    const cls = chosen ? (option.ok ? "is-ok" : "is-bad") : "";
    return `<button type="button" class="option ${cls}" data-quiz="${esc(id)}" data-option="${optionIndex}">${esc(option.t)}</button>`;
  }).join("");
  let why = "";
  if (picked !== undefined) {
    const option = lesson.quiz.options[picked];
    why = `<p class="why ${option.ok ? "is-ok" : "is-bad"}">${esc(option.why)}</p>`;
  }
  const mark = progress.done[id] ? `<p class="pill pill-ok">Pieza marcada</p>` : "";
  return `
    <article class="sheet">
      <p class="kicker">${String(index + 1).padStart(2, "0")} · ${lesson.minutes} min</p>
      ${mark}
      <h2>${esc(lesson.title)}</h2>
      <p class="lede">${esc(lesson.summary)}</p>
      ${renderBlocks(lesson.blocks)}
      <section class="quiz">
        <h3>Compruébalo</h3>
        <p>${esc(lesson.quiz.q)}</p>
        <div class="options">${options}</div>
        ${why}
      </section>
      <nav class="pager">
        ${prev ? `<button type="button" data-go="lesson" data-id="${esc(prev)}">← ${esc(LESSONS[prev].title)}</button>` : "<span></span>"}
        ${next ? `<button type="button" data-go="lesson" data-id="${esc(next)}">${esc(LESSONS[next].title)} →</button>` : `<button type="button" data-go="decisions" data-step="0">Ir a las decisiones →</button>`}
      </nav>
    </article>`;
}

function renderHome() {
  const bands = MAP.map((band) => {
    const chips = band.chips
      .map((chip) => `<button type="button" class="chip" data-go="lesson" data-id="${esc(chip.id)}">${esc(chip.label)}</button>`)
      .join("");
    return `<section class="band"><p class="kicker">${esc(band.kicker)}</p><p>${esc(band.text)}</p><div class="chips">${chips}</div></section>`;
  }).join("");
  const order = BUILD_ORDER.map((step) => `
    <li>
      <button type="button" data-go="lesson" data-id="${esc(step.lesson)}">
        <span>${esc(step.n)}</span>
        <strong>${esc(step.title)}</strong>
        <em>${esc(step.text)}</em>
      </button>
    </li>`).join("");
  const stories = STORIES.map((story) => `
    <button type="button" class="story-card" data-go="story" data-id="${esc(story.id)}">
      <span class="kicker">Recorrido</span>
      <strong>${esc(story.title)}</strong>
      <em>${esc(story.lede)}</em>
    </button>`).join("");
  return `
    <article class="sheet sheet-wide">
      <p class="kicker">Planea · un solo dominio para todo el stack</p>
      <h2>Cada pieza tiene un dueño.</h2>
      <p class="lede">Esta app no despliega el stack. Te lo enseña. Planea es una app de frentes y toneladas: la misma historia atraviesa la pantalla, el API, el agente, los datos y el pull request.</p>
      <div class="score">
        <span>${doneCount()} de ${pathIds().length} piezas</span>
        <span>${decisionCount()} de ${DECISIONS.length} decisiones</span>
      </div>
      <div class="map">${bands}</div>
      <h3>En qué orden se construye</h3>
      <p>Snowflake, Eve y Grafana esperan. Primero hay una pantalla que guarda una fila y un PR que no toca producción.</p>
      <ol class="order">${order}</ol>
      <h3>Sigue una historia completa</h3>
      <div class="story-row">${stories}</div>
      <button type="button" class="text-link" data-go="decisions" data-step="0">Entrenar las 8 decisiones →</button>
    </article>`;
}

function renderStory() {
  const story = STORIES.find((item) => item.id === state.storyId);
  const step = story.steps[state.storyStep];
  const rail = story.steps.map((item, index) => {
    const cls = index === state.storyStep ? "is-current" : index < state.storyStep ? "is-past" : "";
    return `<button type="button" class="rail-step ${cls}" data-go="step" data-step="${index}"><i>${String(index + 1).padStart(2, "0")}</i>${esc(item.piece)}</button>`;
  }).join("");
  const atEnd = state.storyStep === story.steps.length - 1;
  return `
    <article class="sheet">
      <p class="kicker">Recorrido · ${esc(story.title)}</p>
      <h2>${esc(step.title)}</h2>
      <p class="lede">${esc(story.lede)}</p>
      <div class="story-layout">
        <div class="rail">${rail}</div>
        <div>
          <p class="piece">${esc(step.piece)}</p>
          <p>${esc(step.text)}</p>
          <button type="button" class="text-link" data-go="lesson" data-id="${esc(step.lesson)}">Abrir la pieza: ${esc(LESSONS[step.lesson].title)} →</button>
          <nav class="pager">
            <button type="button" data-go="step" data-step="${Math.max(0, state.storyStep - 1)}" ${state.storyStep === 0 ? "disabled" : ""}>← Atrás</button>
            ${atEnd
              ? `<button type="button" data-go="home">Volver al mapa</button>`
              : `<button type="button" data-go="step" data-step="${state.storyStep + 1}">Siguiente →</button>`}
          </nav>
        </div>
      </div>
    </article>`;
}

function renderDecisions() {
  const item = DECISIONS[state.decision];
  const picked = state.picked["d:" + item.id];
  const options = item.options.map((option, optionIndex) => {
    const chosen = picked === optionIndex;
    const cls = chosen ? (option.ok ? "is-ok" : "is-bad") : "";
    return `<button type="button" class="option ${cls}" data-decision="${esc(item.id)}" data-option="${optionIndex}">${esc(option.t)}</button>`;
  }).join("");
  let why = "";
  if (picked !== undefined) {
    const option = item.options[picked];
    why = `<p class="why ${option.ok ? "is-ok" : "is-bad"}">${esc(option.why)}</p>`;
  }
  const last = state.decision === DECISIONS.length - 1;
  return `
    <article class="sheet">
      <p class="kicker">Decisión ${state.decision + 1} de ${DECISIONS.length} · ${decisionCount()} acertadas</p>
      <h2>¿Quién es el dueño?</h2>
      <p class="lede">${esc(item.prompt)}</p>
      <div class="options">${options}</div>
      ${why}
      <nav class="pager">
        <button type="button" data-go="decision-step" data-step="${Math.max(0, state.decision - 1)}" ${state.decision === 0 ? "disabled" : ""}>← Atrás</button>
        ${last
          ? `<button type="button" data-go="home">Volver al mapa</button>`
          : `<button type="button" data-go="decision-step" data-step="${state.decision + 1}">Siguiente →</button>`}
      </nav>
    </article>`;
}

function renderGlossary() {
  const q = state.query.trim().toLowerCase();
  const items = GLOSSARY
    .slice()
    .sort((a, b) => a.term.localeCompare(b.term, "es"))
    .filter((item) => !q || item.term.toLowerCase().includes(q) || item.text.toLowerCase().includes(q))
    .map((item) => `
      <article class="gloss">
        <header>
          <h3>${esc(item.term)}</h3>
          <button type="button" data-go="lesson" data-id="${esc(item.lesson)}">${esc(LESSONS[item.lesson].title)}</button>
        </header>
        <p>${esc(item.text)}</p>
      </article>`)
    .join("");
  return `
    <article class="sheet">
      <p class="kicker">Glosario</p>
      <h2>Los nombres, en una frase.</h2>
      <label class="search">Buscar
        <input id="glossary-search" type="search" value="${esc(state.query)}" placeholder="harness, RLS, preview…" autocomplete="off">
      </label>
      <div class="gloss-list">${items || "<p>Nada con ese texto.</p>"}</div>
    </article>`;
}

function renderSidebar() {
  const groups = TRACKS.map((track) => {
    const links = track.ids.map((id) => {
      const current = state.view === "lesson" && state.lessonId === id ? "is-current" : "";
      const done = progress.done[id] ? "is-done" : "";
      return `<button type="button" class="nav-lesson ${current} ${done}" data-go="lesson" data-id="${esc(id)}"><i></i>${esc(LESSONS[id].title)}</button>`;
    }).join("");
    return `<div class="nav-group"><p>${esc(track.title)}</p>${links}</div>`;
  }).join("");
  const home = state.view === "home" ? "is-current" : "";
  const glossary = state.view === "glossary" ? "is-current" : "";
  const decisions = state.view === "decisions" ? "is-current" : "";
  return `
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <div>
        <strong>RutaStack</strong>
        <em>Planea, pieza por pieza</em>
      </div>
    </div>
    <button type="button" class="nav-toggle" data-go="toggle-nav" aria-expanded="false">Índice</button>
    <button type="button" class="nav-top ${home}" data-go="home">Inicio</button>
    <button type="button" class="nav-top ${decisions}" data-go="decisions">Decisiones</button>
    <button type="button" class="nav-top ${glossary}" data-go="glossary">Glosario</button>
    ${groups}
    <p class="nav-foot">${doneCount()} / ${pathIds().length} piezas · ${decisionCount()} / ${DECISIONS.length} decisiones</p>
    <button type="button" class="nav-reset" data-go="reset">Reiniciar progreso</button>`;
}

function render(options) {
  const keepScroll = options && options.keepScroll;
  const scrollTop = window.scrollY;
  const root = document.getElementById("app");
  let main = renderHome();
  if (state.view === "lesson") main = renderLesson(state.lessonId);
  if (state.view === "story") main = renderStory();
  if (state.view === "decisions") main = renderDecisions();
  if (state.view === "glossary") main = renderGlossary();
  root.innerHTML = `<aside class="side">${renderSidebar()}</aside><main class="main">${main}</main>`;
  const search = document.getElementById("glossary-search");
  if (search) {
    search.focus();
    const caret = state.caret == null ? search.value.length : state.caret;
    search.setSelectionRange(caret, caret);
  }
  window.scrollTo(0, keepScroll ? scrollTop : 0);
}

document.body.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;

  if (button.dataset.quiz) {
    const optionIndex = Number(button.dataset.option);
    const lesson = LESSONS[button.dataset.quiz];
    state.picked[button.dataset.quiz] = optionIndex;
    if (lesson.quiz.options[optionIndex].ok) progress.done[button.dataset.quiz] = true;
    saveProgress();
    render({ keepScroll: true });
    return;
  }

  if (button.dataset.decision) {
    const optionIndex = Number(button.dataset.option);
    const item = DECISIONS.find((entry) => entry.id === button.dataset.decision);
    state.picked["d:" + item.id] = optionIndex;
    if (item.options[optionIndex].ok) progress.decisions[item.id] = true;
    saveProgress();
    render({ keepScroll: true });
    return;
  }

  const action = button.dataset.go;
  if (!action) return;
  if (action === "home") go({ view: "home" });
  if (action === "glossary") go({ view: "glossary" });
  if (action === "decisions") {
    const decision = button.dataset.step !== undefined ? Number(button.dataset.step) : state.decision;
    go({ view: "decisions", decision });
  }
  if (action === "lesson") go({ view: "lesson", lessonId: button.dataset.id });
  if (action === "story") go({ view: "story", storyId: button.dataset.id, storyStep: 0 });
  if (action === "step") go({ view: "story", storyStep: Number(button.dataset.step) });
  if (action === "decision-step") go({ view: "decisions", decision: Number(button.dataset.step) });
  if (action === "toggle-nav") {
    const side = document.querySelector(".side");
    const open = side.classList.toggle("is-open");
    button.setAttribute("aria-expanded", open ? "true" : "false");
    return;
  }
  if (action === "reset") {
    const ok = window.confirm("Se borra el progreso de piezas y decisiones en este navegador.");
    if (!ok) return;
    progress = { done: {}, decisions: {} };
    state.picked = {};
    saveProgress();
    render();
  }
});

document.body.addEventListener("input", (event) => {
  if (event.target.id !== "glossary-search") return;
  state.query = event.target.value;
  state.caret = event.target.selectionStart;
  render({ keepScroll: true });
});

window.addEventListener("popstate", () => {
  readHash();
  render();
});

readHash();
render();

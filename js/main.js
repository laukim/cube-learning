import {
  applyAlg,
  applyMove,
  cloneFacelets,
  COLOR_HEX,
  FACES,
  scrambleCube,
  setFacelet,
  solvedFacelets,
} from "./cube.js";
import { consumeAlgMove, initAlgProgress, restoreAlgMove } from "./alg-progress.js";
import { createErnoCube } from "./erno-view.js";
import { analyzeCross, CROSS_TIPS, scrambleCross } from "./cross-trainer.js";
import { analyzeF2L, F2L_TIPS, scrambleF2L } from "./f2l-trainer.js";
import { renderCaseDiagram } from "./case-diagram.js";
import { analyzeOll, expandWideAlg, getOllDrillInfo, OLL_TIPS, scrambleOll } from "./oll-trainer.js";
import { analyzePll, getPllDrillInfo, PLL_TIPS, scramblePll } from "./pll-trainer.js";
import { ALG_LIBRARY, analyze, STEPS } from "./solver.js";

function setHintCopy(el, text) {
  if (!el) return;
  el.textContent = text || "";
  el.style.whiteSpace = text && text.includes("\n") ? "pre-line" : "";
}

function setHintDiagram(el, diagram) {
  if (!el) return;
  const html = renderCaseDiagram(diagram);
  if (!html) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = html;
}

function bindStickyAlg(sticky, hint, stage) {
  const alg = hint?.alg && !hint.alg.includes("…") ? hint.alg : "";
  if (!alg) return { ...hint, stage };
  if (sticky && sticky.fullAlg === alg) {
    return { ...sticky, ...hint, stage, fullAlg: sticky.fullAlg, remaining: sticky.remaining };
  }
  const prog = initAlgProgress(expandWideAlg(alg));
  return { ...hint, stage, fullAlg: prog.fullAlg, remaining: prog.remaining };
}

function displayAlgFromSticky(sticky, fallbackAlg) {
  if (sticky && sticky.fullAlg) {
    return sticky.remaining || "— done —";
  }
  return fallbackAlg || "";
}

const ernoBox = document.getElementById("erno-container");
const stepsEl = document.getElementById("steps");
const hintCard = document.getElementById("hint-card");
const solvedBanner = document.getElementById("solved-banner");

let facelets = solvedFacelets();
let paintColor = "white";
let netDraft = null;
let lastHintAlg = "";
let appMode = "guide"; // guide | cross | f2l | oll | pll | match | algs
let lastF2lAlg = "";
let lastCrossAlg = "";
let lastOllAlg = "";
let lastPllAlg = "";
/** Last valid OLL/PLL case hint — kept while mid-alg temporarily breaks F2L. */
let stickyOllHint = null;
let stickyPllHint = null;
/** When true, ignore ERNO twist events (we're driving facelets ourselves). */
let syncingFromUi = false;
/** True while an undo animation is in flight — next onTwist pops history. */
let undoingMove = false;
/** User-facing move notation (not scramble playback). */
let moveHistory = [];

const MOVE_PAD_KEY = "bylayer-show-move-pad";
const stageMain = document.querySelector(".stage-main");
const movePad = document.getElementById("move-pad");
const btnUndo = document.getElementById("btn-undo");
const btnTogglePad = document.getElementById("btn-toggle-pad");
const moveTraceAlg = document.getElementById("move-trace-alg");
const moveTraceLast = document.getElementById("move-trace-last");

const CENTER_COLOR = {
  U: "yellow",
  D: "white",
  F: "green",
  B: "blue",
  L: "orange",
  R: "red",
};

let erno = null;

function updateMoveTrace() {
  if (!moveHistory.length) {
    moveTraceAlg.textContent = "—";
    moveTraceLast.hidden = true;
    moveTraceLast.textContent = "";
  } else {
    const recent = moveHistory.slice(-24);
    moveTraceAlg.textContent = recent.join(" ");
    const last = moveHistory[moveHistory.length - 1];
    moveTraceLast.hidden = false;
    moveTraceLast.textContent = `last ${last}`;
  }
  const canVirtualY =
    moveHistory.length > 0 && /^y2?$|^y'$/.test(moveHistory[moveHistory.length - 1]);
  btnUndo.disabled = (!erno?.canUndo() && !canVirtualY) || undoingMove || syncingFromUi;
}

function clearMoveHistory() {
  moveHistory = [];
  updateMoveTrace();
}

function recordTwist(move) {
  if (undoingMove) {
    undoingMove = false;
    moveHistory.pop();
  } else {
    moveHistory.push(move);
  }
  updateMoveTrace();
}

function advanceStickyOnTwist(cubeMove) {
  if (!cubeMove) return;
  const sticky = appMode === "pll" ? stickyPllHint : appMode === "oll" ? stickyOllHint : null;
  if (!sticky?.fullAlg) return;

  if (undoingMove) {
    sticky.remaining = restoreAlgMove(sticky.remaining, cubeMove);
  } else {
    const { remaining, matched } = consumeAlgMove(sticky.remaining, cubeMove);
    if (matched) sticky.remaining = remaining;
  }
}

function handleTwist(payload) {
  if (syncingFromUi) return;

  const { cubeMove, viewMove, virtual } =
    typeof payload === "string"
      ? { cubeMove: payload, viewMove: payload, virtual: false }
      : payload;

  try {
    if (!virtual && cubeMove) {
      applyMove(facelets, cubeMove);
      advanceStickyOnTwist(cubeMove);
    }
    if (viewMove) recordTwist(viewMove);
    refreshGuide();
  } catch (err) {
    console.warn("twist sync failed", cubeMove ?? viewMove, err);
    undoingMove = false;
    updateMoveTrace();
  }
}

function mountErno() {
  erno?.destroy();
  erno = createErnoCube(ernoBox, {
    shouldIgnoreTwist: () => syncingFromUi,
    onTwist: handleTwist,
  });
  updateMoveTrace();
}

function refreshGuide() {
  if (appMode === "cross") {
    refreshCross();
    return;
  }
  if (appMode === "f2l") {
    refreshF2L();
    return;
  }
  if (appMode === "oll") {
    refreshOll();
    return;
  }
  if (appMode === "pll") {
    refreshPll();
    return;
  }

  const result = analyze(facelets);
  stepsEl.innerHTML = STEPS.map((step, i) => {
    const done = result.stepsDone[i];
    const current = !result.solved && result.stepIndex === i;
    const cls = ["step", done ? "is-done" : "", current ? "is-current" : ""].filter(Boolean).join(" ");
    return `<li class="${cls}">
      <span class="step-num">${done ? "✓" : i + 1}</span>
      <div>
        <h3>${step.title}</h3>
        <p>${step.blurb}</p>
      </div>
    </li>`;
  }).join("");

  if (result.solved) {
    hintCard.hidden = true;
    solvedBanner.hidden = false;
    lastHintAlg = "";
    return;
  }

  solvedBanner.hidden = true;
  const h = result.hint;
  if (!h) {
    hintCard.hidden = true;
    return;
  }

  hintCard.hidden = false;
  document.getElementById("hint-kicker").textContent = `Step ${result.stepIndex + 1} · ${STEPS[result.stepIndex].title}`;
  document.getElementById("hint-title").textContent = h.title;
  document.getElementById("hint-copy").textContent = h.copy;
  document.getElementById("hint-alg").textContent = h.alg;
  document.getElementById("hint-note").textContent = h.note || "";
  lastHintAlg = h.alg && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-apply-alg").hidden = !lastHintAlg;
}

function refreshF2L() {
  const result = analyzeF2L(facelets);
  const prog = document.getElementById("f2l-progress");
  prog.innerHTML = result.slots
    .map(
      (s) =>
        `<div class="f2l-slot ${s.done ? "is-done" : ""}" title="${s.name}">
          <span class="f2l-slot-id">${s.id}</span>
          <span class="f2l-slot-mark">${s.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("f2l-solved-banner");
  const card = document.getElementById("f2l-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastF2lAlg = "";
    return;
  }

  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("f2l-hint-kicker").textContent = `F2L · ${result.solvedCount}/4 slots`;
  document.getElementById("f2l-hint-title").textContent = h.title;
  document.getElementById("f2l-hint-copy").textContent = h.copy;
  document.getElementById("f2l-hint-alg").textContent = h.alg || "—";
  document.getElementById("f2l-hint-note").textContent = h.note || "";
  lastF2lAlg = h.alg && h.alg.trim() ? h.alg : "";
  document.getElementById("btn-f2l-apply").hidden = !lastF2lAlg;
}

function refreshCross() {
  const result = analyzeCross(facelets);
  const prog = document.getElementById("cross-progress");
  prog.innerHTML = result.edges
    .map(
      (e) =>
        `<div class="f2l-slot ${e.done ? "is-done" : ""}" title="${e.name}">
          <span class="f2l-slot-id">${e.id.replace("D", "")}</span>
          <span class="f2l-slot-mark">${e.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("cross-solved-banner");
  const card = document.getElementById("cross-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastCrossAlg = "";
    return;
  }

  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("cross-hint-kicker").textContent = `Cross · ${result.solvedCount}/4 edges`;
  document.getElementById("cross-hint-title").textContent = h.title;
  document.getElementById("cross-hint-copy").textContent = h.copy;
  document.getElementById("cross-hint-alg").textContent = h.alg || "—";
  document.getElementById("cross-hint-note").textContent = h.note || "";
  lastCrossAlg = h.alg && h.alg.trim() && !h.alg.includes("…") && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-cross-apply").hidden = !lastCrossAlg;
}

function refreshOll() {
  const result = analyzeOll(facelets);
  const prog = document.getElementById("oll-progress");
  prog.innerHTML = [
    { id: "1", label: "Cross", done: result.crossDone },
    { id: "2", label: "Finish", done: result.complete },
  ]
    .map(
      (s) =>
        `<div class="f2l-slot ${s.done ? "is-done" : ""}" title="${s.label}">
          <span class="f2l-slot-id">${s.id}</span>
          <span class="f2l-slot-mark">${s.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("oll-solved-banner");
  const card = document.getElementById("oll-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastOllAlg = "";
    stickyOllHint = null;
    return;
  }

  if (result.stage === "cross" || result.stage === "finish") {
    stickyOllHint = bindStickyAlg(stickyOllHint, result.hint, result.stage);
  }

  let h = result.hint;
  let stage = result.stage;
  if (result.stage === "need-f2l" && stickyOllHint?.alg) {
    h = {
      title: stickyOllHint.title,
      copy:
        "Mid-alg — the first moves break F2L on purpose. Finish the remaining moves below (or tap Apply / Undo).",
      alg: stickyOllHint.alg,
      note: stickyOllHint.note,
      diagram: stickyOllHint.diagram,
    };
    stage = stickyOllHint.stage;
  } else if (result.stage === "need-f2l") {
    stickyOllHint = null;
  }

  const shownAlg = displayAlgFromSticky(stickyOllHint, h.alg);

  solvedEl.hidden = true;
  card.hidden = false;
  const stageLabel =
    stage === "cross"
      ? `Step 1 · Cross · drill ${getOllDrillInfo().name}`
      : stage === "finish"
        ? `Step 2 · Finish · drill ${getOllDrillInfo().name}`
        : `2-look OLL · ${getOllDrillInfo().name}`;
  document.getElementById("oll-hint-kicker").textContent = stageLabel;
  document.getElementById("oll-hint-title").textContent = h.title;
  setHintDiagram(document.getElementById("oll-hint-diagram"), h.diagram);
  setHintCopy(document.getElementById("oll-hint-copy"), h.copy);
  document.getElementById("oll-hint-alg").textContent = shownAlg || "—";
  document.getElementById("oll-hint-note").textContent = h.note || "";
  lastOllAlg =
    stickyOllHint?.remaining && stickyOllHint.remaining !== "— done —"
      ? stickyOllHint.remaining
      : shownAlg && shownAlg !== "— done —" && !shownAlg.includes("…")
        ? shownAlg
        : "";
  document.getElementById("btn-oll-apply").hidden = !lastOllAlg;
}

function refreshPll() {
  const result = analyzePll(facelets);
  const prog = document.getElementById("pll-progress");
  prog.innerHTML = [
    { id: "1", label: "Corners", done: result.cornersDone || result.complete },
    { id: "2", label: "Edges", done: result.complete },
  ]
    .map(
      (s) =>
        `<div class="f2l-slot ${s.done ? "is-done" : ""}" title="${s.label}">
          <span class="f2l-slot-id">${s.id}</span>
          <span class="f2l-slot-mark">${s.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("pll-solved-banner");
  const card = document.getElementById("pll-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastPllAlg = "";
    stickyPllHint = null;
    return;
  }

  if (result.stage === "corners" || result.stage === "edges") {
    stickyPllHint = bindStickyAlg(stickyPllHint, result.hint, result.stage);
  }

  let h = result.hint;
  let stage = result.stage;
  if (
    (result.stage === "need-f2l" || result.stage === "need-oll") &&
    stickyPllHint?.alg
  ) {
    h = {
      title: stickyPllHint.title,
      copy:
        "Mid-alg — F2L looks broken until you finish. Do the remaining moves below (or tap Apply / Undo).",
      alg: stickyPllHint.alg,
      note: stickyPllHint.note,
      diagram: stickyPllHint.diagram,
    };
    stage = stickyPllHint.stage;
  } else if (result.stage === "need-f2l" || result.stage === "need-oll") {
    stickyPllHint = null;
  }

  const shownAlg = displayAlgFromSticky(stickyPllHint, h.alg);

  solvedEl.hidden = true;
  card.hidden = false;
  const drill = getPllDrillInfo();
  const stageLabel =
    stage === "corners"
      ? `Step 1 · Corners · ${drill.name}`
      : stage === "edges"
        ? `Step 2 · Edges · ${drill.name}`
        : `PLL · ${drill.name}`;
  document.getElementById("pll-hint-kicker").textContent = stageLabel;
  document.getElementById("pll-hint-title").textContent = h.title;
  setHintDiagram(document.getElementById("pll-hint-diagram"), h.diagram);
  setHintCopy(document.getElementById("pll-hint-copy"), h.copy);
  document.getElementById("pll-hint-alg").textContent = shownAlg || "—";
  document.getElementById("pll-hint-note").textContent = h.note || "";
  lastPllAlg =
    stickyPllHint?.remaining && stickyPllHint.remaining !== "— done —"
      ? stickyPllHint.remaining
      : shownAlg && shownAlg !== "— done —" && !shownAlg.includes("…")
        ? shownAlg
        : "";
  document.getElementById("btn-pll-apply").hidden = !lastPllAlg;
}

function buildPllTips() {
  const el = document.getElementById("pll-tips");
  el.innerHTML = PLL_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}

function buildOllTips() {
  const el = document.getElementById("oll-tips");
  el.innerHTML = OLL_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}

function buildCrossTips() {
  const el = document.getElementById("cross-tips");
  el.innerHTML = CROSS_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}

function buildF2LTips() {
  const el = document.getElementById("f2l-tips");
  el.innerHTML = F2L_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}

function setPanelCopy(mode) {
  const title = document.getElementById("panel-title");
  const blurb = document.getElementById("panel-blurb");
  const btnScramble = document.getElementById("btn-scramble");
  const btnCross = document.getElementById("btn-cross-case");
  const btnF2l = document.getElementById("btn-f2l-case");
  const btnOll = document.getElementById("btn-oll-case");
  const btnOllAgain = document.getElementById("btn-oll-again");
  const btnPll = document.getElementById("btn-pll-case");
  const btnPllAgain = document.getElementById("btn-pll-again");
  const btnHint = document.getElementById("btn-hint");

  btnScramble.hidden = true;
  btnCross.hidden = true;
  btnF2l.hidden = true;
  btnOll.hidden = true;
  btnOllAgain.hidden = true;
  btnPll.hidden = true;
  btnPllAgain.hidden = true;

  if (mode === "cross") {
    title.textContent = "White cross drill";
    blurb.innerHTML =
      "White on the bottom. Build the <strong>+</strong> — four edges, each side colour matching its centre. Tap <strong>New cross</strong>, then solve one edge at a time.";
    btnCross.hidden = false;
    btnHint.textContent = "Cross hint";
  } else if (mode === "f2l") {
    title.textContent = "F2L — corner and edge go in as a pair";
    blurb.innerHTML =
      "You already solve corners, then edges. F2L does <strong>both at once</strong>. Cross stays. Use <code class=\"inline-alg\">y</code> so the pair you’re working on is <strong>front-right</strong>, then read the hint.";
    btnF2l.hidden = false;
    btnHint.textContent = "F2L hint";
  } else if (mode === "oll") {
    const d = getOllDrillInfo();
    title.textContent = "2-look OLL — fixed case order";
    blurb.innerHTML = `Practice in order (now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}). <strong>Again</strong> = same case · <strong>Next OLL</strong> = next in the list.`;
    btnOll.hidden = false;
    btnOllAgain.hidden = false;
    btnHint.textContent = "OLL hint";
  } else if (mode === "pll") {
    const d = getPllDrillInfo();
    title.textContent = "Beginner PLL — fixed case order";
    blurb.innerHTML = `Practice in order (now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}). <strong>Again</strong> = same case · <strong>Next PLL</strong> = next in the list.`;
    btnPll.hidden = false;
    btnPllAgain.hidden = false;
    btnHint.textContent = "PLL hint";
  } else {
    title.textContent = "White on bottom. Yellow on top. Seven steps you already know.";
    blurb.innerHTML =
      "Righty = <code class=\"inline-alg\">R U R' U'</code> · Lefty = <code class=\"inline-alg\">L' U' L U</code>. Scramble, match your cube, or follow hints one step at a time.";
    btnScramble.hidden = false;
    btnHint.textContent = "Next hint";
  }
}

function render() {
  refreshGuide();
}

/** Drive the ERNO cube; facelets update from onTwist (or we apply first when skipping events). */
function doMove(move) {
  flashMovePad(move);
  erno?.twist(move);
}

function flashMovePad(move) {
  const btn = document.querySelector(`.move-btn[data-move="${CSS.escape(move)}"]`);
  if (!btn || movePad.hidden) return;
  btn.classList.remove("is-flash");
  // reflow so rapid repeats still animate
  void btn.offsetWidth;
  btn.classList.add("is-flash");
  window.setTimeout(() => btn.classList.remove("is-flash"), 280);
}

function doAlg(alg) {
  if (!alg || alg.includes("intuitive") || alg.includes("repeat")) return;
  erno?.twistAlg(expandWideAlg(alg));
}

function resetCube() {
  facelets = solvedFacelets();
  undoingMove = false;
  clearMoveHistory();
  stickyOllHint = null;
  stickyPllHint = null;
  mountErno();
  refreshGuide();
}

function playScrambleAlg(alg) {
  facelets = solvedFacelets();
  if (alg) applyAlg(facelets, alg);
  undoingMove = false;
  clearMoveHistory();
  stickyOllHint = null;
  stickyPllHint = null;
  mountErno();
  if (alg) {
    syncingFromUi = true;
    erno.setSuppressOrbitDetect(true);
    updateMoveTrace();
    // Scramble is cube-space; temporarily clear viewer yaw (fresh mount is 0)
    erno.twistAlg(alg);
    erno.whenIdle(() => {
      erno.clearHistory();
      syncingFromUi = false;
      erno.setSuppressOrbitDetect(false);
      updateMoveTrace();
      erno.healVisual();
    });
  }
  refreshGuide();
}

function undoLastMove() {
  if (!erno || syncingFromUi || undoingMove) return;

  // Prefer ERNO undo for real face turns / animated y
  if (erno.canUndo()) {
    undoingMove = true;
    updateMoveTrace();
    if (!erno.undo()) {
      undoingMove = false;
      updateMoveTrace();
    }
    return;
  }

  // Leftover virtual orbit y from older sessions (orbit no longer remaps F)
  const last = moveHistory[moveHistory.length - 1];
  if (!last || last[0] !== "y") {
    updateMoveTrace();
    return;
  }

  moveHistory.pop();
  refreshGuide();
  updateMoveTrace();
}

function setMovePadVisible(visible) {
  stageMain.classList.toggle("move-pad-hidden", !visible);
  movePad.hidden = !visible;
  btnTogglePad.setAttribute("aria-pressed", visible ? "true" : "false");
  btnTogglePad.textContent = visible ? "Hide moves" : "Show moves";
  try {
    localStorage.setItem(MOVE_PAD_KEY, visible ? "1" : "0");
  } catch {
    /* ignore */
  }
  // Give the cube more room after the pad collapses
  requestAnimationFrame(() => erno?.resize());
}

document.querySelectorAll(".move-btn").forEach((btn) => {
  btn.addEventListener("click", () => doMove(btn.dataset.move));
});

btnUndo.addEventListener("click", () => undoLastMove());

btnTogglePad.addEventListener("click", () => {
  const visible = btnTogglePad.getAttribute("aria-pressed") !== "true";
  setMovePadVisible(visible);
});

document.getElementById("btn-reset").addEventListener("click", () => {
  resetCube();
});

document.getElementById("btn-scramble").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCube(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-cross-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCross(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-f2l-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-oll-again").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleOll(draft, "again");
  playScrambleAlg(alg);
  setPanelCopy("oll");
});

document.getElementById("btn-oll-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleOll(draft, "next");
  playScrambleAlg(alg);
  setPanelCopy("oll");
});

document.getElementById("btn-pll-again").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scramblePll(draft, "again");
  playScrambleAlg(alg);
  setPanelCopy("pll");
});

document.getElementById("btn-pll-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scramblePll(draft, "next");
  playScrambleAlg(alg);
  setPanelCopy("pll");
});

document.getElementById("btn-hint").addEventListener("click", () => {
  if (appMode === "cross") {
    refreshCross();
    document.getElementById("cross-hint-card").hidden = false;
    document.getElementById("cross-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "f2l") {
    refreshF2L();
    document.getElementById("f2l-hint-card").hidden = false;
    document.getElementById("f2l-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "oll") {
    refreshOll();
    document.getElementById("oll-hint-card").hidden = false;
    document.getElementById("oll-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "pll") {
    refreshPll();
    document.getElementById("pll-hint-card").hidden = false;
    document.getElementById("pll-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  refreshGuide();
  if (!solvedBanner.hidden) return;
  hintCard.hidden = false;
  hintCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
});

document.getElementById("btn-apply-alg").addEventListener("click", () => {
  if (lastHintAlg) doAlg(lastHintAlg);
});

document.getElementById("btn-f2l-apply").addEventListener("click", () => {
  if (lastF2lAlg) doAlg(lastF2lAlg);
});

document.getElementById("btn-cross-apply").addEventListener("click", () => {
  if (lastCrossAlg) doAlg(lastCrossAlg);
});

document.getElementById("btn-oll-apply").addEventListener("click", () => {
  if (lastOllAlg) doAlg(lastOllAlg);
});

document.getElementById("btn-pll-apply").addEventListener("click", () => {
  if (lastPllAlg) doAlg(lastPllAlg);
});

const panels = {
  guide: document.getElementById("panel-guide"),
  cross: document.getElementById("panel-cross"),
  f2l: document.getElementById("panel-f2l"),
  oll: document.getElementById("panel-oll"),
  pll: document.getElementById("panel-pll"),
  match: document.getElementById("panel-match"),
  algs: document.getElementById("panel-algs"),
};

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".mode-tab").forEach((t) => {
      t.classList.toggle("is-active", t === tab);
      t.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    const mode = tab.dataset.mode;
    appMode = mode;
    Object.entries(panels).forEach(([key, el]) => {
      el.hidden = key !== mode;
    });
    setPanelCopy(mode);
    if (mode === "cross") refreshCross();
    if (mode === "f2l") refreshF2L();
    if (mode === "oll") refreshOll();
    if (mode === "pll") refreshPll();
    if (mode === "guide") refreshGuide();
  });
});

const paletteEl = document.getElementById("palette");
const netEl = document.getElementById("color-net");
const PALETTE = ["white", "yellow", "green", "blue", "orange", "red"];

function buildPalette() {
  paletteEl.innerHTML = "";
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c === paintColor ? " is-active" : "");
    b.style.background = COLOR_HEX[c];
    b.title = c;
    b.setAttribute("aria-label", c);
    b.addEventListener("click", () => {
      paintColor = c;
      buildPalette();
    });
    paletteEl.appendChild(b);
  }
}

function syncNetFromCube() {
  netDraft = cloneFacelets(facelets);
}

function buildNet() {
  if (!netDraft) syncNetFromCube();
  netEl.innerHTML = "";
  const layout = [
    { face: "U", cls: "net-U" },
    { face: "L", cls: "net-L" },
    { face: "F", cls: "net-F" },
    { face: "R", cls: "net-R" },
    { face: "B", cls: "net-B" },
    { face: "D", cls: "net-D" },
  ];
  for (const { face, cls } of layout) {
    const faceDiv = document.createElement("div");
    faceDiv.className = `net-face ${cls}`;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "net-cell";
      const idx = FACES.indexOf(face) * 9 + i;
      cell.style.background = COLOR_HEX[netDraft[idx]];
      if (i === 4) {
        cell.disabled = true;
        cell.title = `${face} centre`;
      } else {
        cell.addEventListener("click", () => {
          setFacelet(netDraft, face, i, paintColor);
          buildNet();
        });
      }
      faceDiv.appendChild(cell);
    }
    netEl.appendChild(faceDiv);
  }
}

document.getElementById("btn-net-reset").addEventListener("click", () => {
  netDraft = solvedFacelets();
  buildNet();
});

document.getElementById("btn-net-apply").addEventListener("click", () => {
  if (!netDraft) return;
  for (const face of FACES) setFacelet(netDraft, face, 4, CENTER_COLOR[face]);
  facelets = cloneFacelets(netDraft);
  undoingMove = false;
  clearMoveHistory();
  // 3D cube stays on its twist history; reset visual to solved — match mode is for hints
  mountErno();
  refreshGuide();
  document.getElementById("tab-guide").click();
});

document.getElementById("tab-match").addEventListener("click", () => {
  syncNetFromCube();
  buildNet();
});

function buildAlgList() {
  const el = document.getElementById("alg-list");
  el.innerHTML = ALG_LIBRARY.map((a) => {
    const canTry =
      a.alg &&
      !a.alg.includes("intuitive") &&
      !a.alg.includes("repeat") &&
      !a.alg.includes("(see");
    return `<article class="alg-item">
      <h3>${a.name}</h3>
      <p><strong>${a.group}.</strong> ${a.when}. ${a.tip}</p>
      <code class="alg">${a.alg}</code>
      ${
        canTry
          ? `<div style="margin-top:0.55rem">
        <button type="button" class="btn btn-small btn-ghost" data-alg="${a.alg.replace(/"/g, "&quot;")}">Try on cube</button>
      </div>`
          : ""
      }
    </article>`;
  }).join("");

  el.querySelectorAll("[data-alg]").forEach((btn) => {
    btn.addEventListener("click", () => doAlg(btn.dataset.alg));
  });
}

const KEY_MOVES = {
  u: "U",
  e: "U'",
  r: "R",
  i: "R'",
  f: "F",
  g: "F'",
  d: "D",
  s: "D'",
  l: "L",
  k: "L'",
  b: "B",
  n: "B'",
  y: "y",
};

window.addEventListener("keydown", (e) => {
  if (e.target?.matches?.("input, textarea")) return;
  // Holding a key must not spam turns — that looks like a snap / no animation
  if (e.repeat) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.altKey && !e.shiftKey) {
    e.preventDefault();
    undoLastMove();
    return;
  }
  if (key === "y" && e.shiftKey) {
    e.preventDefault();
    doMove("y'");
    return;
  }
  const move = KEY_MOVES[key];
  if (move) {
    e.preventDefault();
    doMove(move);
  }
});

window.addEventListener("resize", () => {
  erno?.resize();
});

try {
  setMovePadVisible(localStorage.getItem(MOVE_PAD_KEY) !== "0");
} catch {
  setMovePadVisible(true);
}

buildPalette();
buildCrossTips();
buildOllTips();
buildPllTips();
buildAlgList();
buildF2LTips();
syncNetFromCube();
buildNet();
setPanelCopy("guide");
mountErno();
render();
clearMoveHistory();
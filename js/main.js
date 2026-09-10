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
import { consumeAlgMove, initAlgProgress, restoreAlgMove } from "./alg-progress.js?v=2look5";
import { createErnoCube } from "./erno-view.js?v=2look5";
import { analyzeCross, CROSS_TIPS, scrambleCross } from "./cross-trainer.js";
import { analyzeF2lDrill, countSlotsSolved, F2L_TIPS, getF2lDrillInfo, popBaselineIds, poppedSolvedSlots, scrambleF2L, shouldFlashPop, solvedSlotIds, stableSolvedSlotIds } from "./f2l-trainer.js?v=conn1";
import { renderCaseDiagram } from "./case-diagram.js";
import { analyzeOll, expandWideAlg, getOllDrillInfo, getOllLook, OLL_TIPS, scrambleOll, setOllLook } from "./oll-trainer.js";
import { analyzePll, getPllDrillInfo, PLL_TIPS, scramblePll } from "./pll-trainer.js";
import { ALG_LIBRARY, analyze, STEPS } from "./solver.js";
import {
  analyzeRoux,
  ROUX_ALG_LIBRARY,
  ROUX_STEPS,
} from "./roux-solver.js";
import {
  analyzeFirstBlock,
  analyzeSecondBlock,
  FB_TIPS,
  SB_TIPS,
  scrambleFb,
  scrambleSb,
} from "./roux-blocks.js";
import {
  analyzeCmll,
  CMLL_TIPS,
  getCmllDrillInfo,
  scrambleCmll,
} from "./cmll-trainer.js";
import {
  analyzeLse,
  getLseDrillInfo,
  LSE_TIPS,
  lseProgress,
  scrambleLse,
} from "./lse-trainer.js";
import {
  armTimer,
  buildAnalysis,
  createTimer,
  currentSplitMs,
  elapsedMs,
  findPauses,
  formatClock,
  formatSolveReport,
  loadSolveHistory,
  methodTimerConfig,
  noteProgress,
  recordSolve,
  renderAnalysisHtml,
  resetTimer,
  SPLIT_SHORT,
  startTimer,
} from "./solve-timer.js";


function activeSteps() {
  return solveMethod === "roux" ? ROUX_STEPS : STEPS;
}

function activeAnalyze(f) {
  return solveMethod === "roux" ? analyzeRoux(f) : analyze(f);
}

function activeAlgLibrary() {
  return solveMethod === "roux" ? ROUX_ALG_LIBRARY : ALG_LIBRARY;
}

function solvedBannerDoneCopy() {
  return solveMethod === "roux" ? " Full Roux solve done." : " Full CFOP solve done.";
}

function syncSlicePad() {
  const sliceRow = document.getElementById("move-row-slice");
  if (!sliceRow) return;
  sliceRow.hidden = !(solveMethod === "roux" || appMode === "pll" || appMode === "oll");
}

function syncMethodChrome() {
  const tag = document.getElementById("brand-tag");
  if (tag) {
    tag.textContent =
      solveMethod === "roux" ? "FB · SB · CMLL · LSE" : "Cross · F2L · OLL · PLL";
  }
  document.querySelectorAll(".method-btn").forEach((btn) => {
    const on = btn.dataset.method === solveMethod;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll(".mode-tab[data-methods]").forEach((tab) => {
    const allowed = (tab.dataset.methods || "").split(/\s+/);
    tab.hidden = !allowed.includes(solveMethod);
  });
  syncSlicePad();
  const panel = document.getElementById("guide-panel");
  if (panel) {
    panel.setAttribute(
      "aria-label",
      solveMethod === "roux" ? "Roux guide and drills" : "CFOP guide and drills"
    );
  }
}

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
const solvedBannerTitle = document.getElementById("solved-banner-title");
const solvedBannerCopy = document.getElementById("solved-banner-copy");
const solveTimerEl = document.getElementById("solve-timer");
const solveTimerClock = document.getElementById("solve-timer-clock");
const solveTimerStatus = document.getElementById("solve-timer-status");
const solveTimerSplits = document.getElementById("solve-timer-splits");
const solveAnalysisEl = document.getElementById("solve-analysis");

let facelets = solvedFacelets();
let paintColor = "white";
let netDraft = null;
let lastHintAlg = "";
let appMode = "guide"; // guide | cross | f2l | oll | pll | fb | sb | cmll | lse | match | algs
let solveMethod = "cfop"; // cfop | roux
let lastF2lAlg = "";
let lastCrossAlg = "";
let lastOllAlg = "";
let lastPllAlg = "";
let lastFbAlg = "";
let lastSbAlg = "";
let lastCmllAlg = "";
let lastLseAlg = "";
/** Last valid OLL/PLL/CMLL case hint — kept while mid-alg temporarily breaks state. */
let stickyOllHint = null;
let stickyPllHint = null;
let stickyCmllHint = null;
/** When true, ignore ERNO twist events (we're driving facelets ourselves). */
let syncingFromUi = false;
/** True while an undo animation is in flight — next onTwist pops history. */
let undoingMove = false;
/** User-facing move notation (not scramble playback). */
let moveHistory = [];
/** Scramble alg for the current timed Guide solve (empty during drills). */
let timedScramble = "";
/** { move, ms } from timer start — used to flag thinking pauses. */
let solveTrace = [];
let timedUndos = 0;
let lastSolveReport = "";
/** First time each F2L slot-count was reached during a timed solve. */
let f2lPairMarks = [];
let f2lPairsLogged = 0;
let f2lLocked = false;
/** Last cross-intact solved F2L slots — ignores mid-alg phantom solves. */
let f2lStableSlots = [];
let popFlashTimer = 0;
let solveTimer = createTimer();
let timerRaf = 0;
let analysisShownForSolve = false;

const MOVE_PAD_KEY = "bylayer-show-move-pad";
const PHONE_PAD_KEY = "bylayer-phone-move-pad";
const OLL_LOOK_KEY = "bylayer-oll-look";

function isCompactLayout() {
  return window.matchMedia("(max-width: 920px)").matches;
}

const btnHints = document.getElementById("btn-hints");
const btnCloseHints = document.getElementById("btn-close-hints");
const guidePanel = document.getElementById("guide-panel");
let hintsPinned = false;
let restoreHintsTimer = 0;

function setHintsOpen(open) {
  if (!isCompactLayout()) {
    document.body.classList.remove("hints-open");
    return;
  }
  document.body.classList.toggle("hints-open", open);
  if (guidePanel) guidePanel.setAttribute("aria-hidden", open ? "false" : "true");
  if (btnHints) {
    btnHints.setAttribute("aria-pressed", open ? "true" : "false");
    btnHints.textContent = open ? "Hide guide" : "Guide";
  }
}

function enterPlayFocus() {
  if (!isCompactLayout()) return;
  hintsPinned = false;
  window.clearTimeout(restoreHintsTimer);
  setHintsOpen(false);
}

function scheduleRestoreHints() {
  // Stay in play until Guide is tapped. Auto-opening the sheet after every
  // flick made the guide cover the cube again.
  window.clearTimeout(restoreHintsTimer);
}
const stageMain = document.querySelector(".stage-main");
const movePad = document.getElementById("move-pad");
const btnUndo = document.getElementById("btn-undo");
const btnTogglePad = document.getElementById("btn-toggle-pad");
const moveTraceAlg = document.getElementById("move-trace-alg");
const moveTraceLast = document.getElementById("move-trace-last");
const flickToast = document.getElementById("flick-toast");
let flickToastTimer = 0;

const CENTER_COLOR = {
  U: "yellow",
  D: "white",
  F: "blue",
  B: "green",
  L: "orange",
  R: "red",
};

let erno = null;

function flashFlickToast(label) {
  if (!flickToast || !label) return;
  flickToast.textContent = label;
  flickToast.classList.remove("is-on");
  void flickToast.offsetWidth;
  flickToast.classList.add("is-on");
  window.clearTimeout(flickToastTimer);
  flickToastTimer = window.setTimeout(() => {
    flickToast.classList.remove("is-on");
  }, 1600);
}

function updateMoveTrace() {
  if (!moveHistory.length) {
    moveTraceAlg.textContent = "—";
    moveTraceLast.hidden = true;
    moveTraceLast.textContent = "";
    btnUndo.textContent = "Undo";
    btnUndo.title = "Undo last move (Z)";
  } else {
    const recent = moveHistory.slice(-24);
    moveTraceAlg.textContent = recent.join(" ");
    const last = moveHistory[moveHistory.length - 1];
    moveTraceLast.hidden = false;
    moveTraceLast.textContent = `last ${last}`;
    btnUndo.textContent = `Undo ${last}`;
    btnUndo.title = `Undo ${last} (Z)`;
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
    const undone = moveHistory.pop();
    if (solveTimer.phase === "running" || solveTimer.phase === "done") {
      timedUndos += 1;
      solveTrace.pop();
    }
    updateMoveTrace();
    flashFlickToast(undone ? `undid ${undone}` : `undid ${move}`);
    return;
  }
  moveHistory.push(move);
  if (solveTimer.phase === "running") {
    solveTrace.push({ move, ms: elapsedMs(solveTimer, performance.now()) });
  }
  updateMoveTrace();
  flashFlickToast(move);
}

function stopTimerTick() {
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = 0;
  }
}

function startTimerTick() {
  stopTimerTick();
  const loop = (now) => {
    paintTimer(now);
    if (solveTimer.phase === "running") timerRaf = requestAnimationFrame(loop);
  };
  timerRaf = requestAnimationFrame(loop);
}

function hideSolveAnalysis() {
  analysisShownForSolve = false;
  lastSolveReport = "";
  if (solveAnalysisEl) {
    solveAnalysisEl.hidden = true;
    solveAnalysisEl.innerHTML = "";
  }
  if (solvedBannerTitle) solvedBannerTitle.textContent = "Solved.";
  if (solvedBannerCopy) solvedBannerCopy.textContent = solvedBannerDoneCopy();
}

function showSolveAnalysis() {
  if (analysisShownForSolve || solveTimer.phase !== "done") return;
  analysisShownForSolve = true;
  const history = loadSolveHistory();
  const previous = history[history.length - 1];
  const totalMoves = solveTimer.splits.reduce((sum, s) => sum + s.moves, 0);
  const timerCfg = methodTimerConfig(solveMethod);
  const analysis = buildAnalysis({
    totalMs: elapsedMs(solveTimer, solveTimer.endMs),
    splits: solveTimer.splits,
    totalMoves,
    previousTotalMs: previous?.totalMs ?? null,
    steps: timerCfg.steps,
    splitGroups: timerCfg.splitGroups,
    stepCoaching: timerCfg.stepCoaching,
    splitShort: timerCfg.splitShort,
    methodId: solveMethod,
  });
  const solution = moveHistory.join(" ");
  const pauses = findPauses(solveTrace);
  analysis.scramble = timedScramble;
  analysis.solution = solution;
  analysis.canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  lastSolveReport = formatSolveReport(analysis, {
    scramble: timedScramble,
    solution,
    undos: timedUndos,
    pauses,
    at: Date.now(),
    splits: solveTimer.splits,
    f2lPairs: f2lPairMarks,
  });
  analysis.report = lastSolveReport;
  recordSolve({
    at: Date.now(),
    totalMs: analysis.totalMs,
    totalMoves: analysis.totalMoves,
    scramble: timedScramble,
    solution,
    undos: timedUndos,
    pauses: pauses.map((p) => ({ after: p.after, before: p.before, ms: p.ms })),
    splits: solveTimer.splits.map((s) => ({
      id: s.id,
      ms: s.ms,
      moves: s.moves,
      alg: s.alg || "",
    })),
    f2lPairs: f2lPairMarks.map((p) => ({ pair: p.pair, ms: p.ms })),
  });
  if (solvedBannerTitle) solvedBannerTitle.textContent = `Solved in ${formatClock(analysis.totalMs)}.`;
  if (solvedBannerCopy) solvedBannerCopy.textContent = ` ${analysis.totalMoves} moves · slowest ${analysis.slowest.short}.`;
  if (solveAnalysisEl) {
    solveAnalysisEl.hidden = false;
    solveAnalysisEl.innerHTML = renderAnalysisHtml(analysis);
    if (appMode === "guide") {
      solveAnalysisEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }
  hintsPinned = true;
  setHintsOpen(true);
}

function reportText() {
  return document.getElementById("solve-report-text")?.value || lastSolveReport;
}

function selectReportField() {
  const el = document.getElementById("solve-report-text");
  if (!el) return false;
  el.removeAttribute("readonly");
  el.focus();
  el.select();
  try {
    el.setSelectionRange(0, el.value.length);
  } catch {
    /* ignore */
  }
  return true;
}

function copyReportNow() {
  const text = reportText();
  if (!text) return false;
  selectReportField();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  const el = document.getElementById("solve-report-text");
  if (el) el.setAttribute("readonly", "");
  if (ok) return true;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
  return false;
}

function markCopyButton(btn, ok) {
  if (!btn) return;
  const prev = btn.dataset.label || btn.textContent;
  btn.dataset.label = prev;
  btn.textContent = ok ? "Copied" : "Long-press the report";
  window.setTimeout(() => {
    btn.textContent = prev;
  }, 2200);
}

function syncScrambleCardVisibility() {
  const card = document.getElementById("scramble-card");
  if (!card) return;
  // Hide once the solve starts so the dock scramble doesn't cover the cube.
  const hide = solveTimer.phase === "running" || solveTimer.phase === "done";
  card.hidden = hide;
  card.setAttribute("aria-hidden", hide ? "true" : "false");
}

function paintScrambleCard(alg) {
  const card = document.getElementById("scramble-card");
  const kicker = document.getElementById("scramble-kicker");
  const el = document.getElementById("scramble-alg");
  if (!card || !el) return;
  const shown = String(alg || "").trim();
  card.classList.toggle("has-scramble", Boolean(shown));
  if (kicker) {
    kicker.textContent = shown
      ? "Do this on your cube · white D · blue F · tap for a new one"
      : "Real cube";
  }
  el.textContent = shown || "Tap for a scramble";
  syncScrambleCardVisibility();
}

function openGuideTab() {
  if (appMode === "guide") return;
  document.getElementById("tab-guide")?.click();
}

function issueFullScramble() {
  openGuideTab();
  const draft = solvedFacelets();
  const alg = scrambleCube(draft);
  playScrambleAlg(alg, { timeSolve: true, instant: true });
}

function timerStatusText(now) {
  if (solveTimer.phase === "armed") return "Ready — first turn starts the clock";
  if (solveTimer.phase === "done") return `Solved · ${formatClock(elapsedMs(solveTimer, now))}`;
  if (solveTimer.phase === "running") {
    const steps = activeSteps();
    const live = solveTimer.lastDone < steps.length ? steps[solveTimer.lastDone] : null;
    if (!live) return "Running";
    return `Step ${solveTimer.lastDone + 1} · ${live.title} · ${formatClock(currentSplitMs(solveTimer, now))}`;
  }
  return "Scramble to time a full solve";
}

function paintTimerSplits(now) {
  if (!solveTimerSplits) return;
  const steps = activeSteps();
  const liveIndex = solveTimer.phase === "running" && solveTimer.lastDone < steps.length ? solveTimer.lastDone : -1;
  const chips = [];
  for (const split of solveTimer.splits) {
    chips.push(
      `<li><span>${SPLIT_SHORT[split.id] || split.title}</span><strong>${formatClock(split.ms)}</strong></li>`
    );
  }
  if (liveIndex >= 0) {
    const step = steps[liveIndex];
    chips.push(
      `<li class="is-live"><span>${SPLIT_SHORT[step.id] || step.title}</span><strong>${formatClock(currentSplitMs(solveTimer, now))}</strong></li>`
    );
  }
  solveTimerSplits.hidden = chips.length === 0;
  solveTimerSplits.innerHTML = chips.join("");
}

function paintTimer(now = performance.now()) {
  if (!solveTimerEl) return;
  solveTimerEl.dataset.phase = solveTimer.phase;
  solveTimerClock.textContent = formatClock(elapsedMs(solveTimer, now));
  solveTimerStatus.textContent = timerStatusText(now);
  paintTimerSplits(now);
  syncScrambleCardVisibility();
}

function markF2lPairProgress() {
  if (solveTimer.lastDone < 1) return;
  const n = countSlotsSolved(facelets);
  if (n <= f2lPairsLogged) return;
  f2lPairsLogged = n;
  f2lPairMarks.push({
    pair: n,
    ms: elapsedMs(solveTimer, performance.now()),
  });
}

function syncF2lStableSlots() {
  const stable = stableSolvedSlotIds(facelets);
  if (stable) f2lStableSlots = stable;
}

function flashF2lPop(slots) {
  const el = document.getElementById("pop-flash");
  const label = document.getElementById("pop-flash-label");
  if (label) label.textContent = slots?.length ? `POP ${slots.join(" · ")}` : "POP";
  if (!el) return;
  window.clearTimeout(popFlashTimer);
  document.body.classList.add("is-f2l-pop");
  el.style.background = "#ff2a2a";
  el.style.zIndex = "9999";
  let step = 0;
  const pulse = () => {
    el.style.opacity = step % 2 === 0 ? "0.8" : "0.08";
    step += 1;
    if (step < 6) {
      popFlashTimer = window.setTimeout(pulse, 120);
      return;
    }
    el.style.opacity = "0";
    document.body.classList.remove("is-f2l-pop");
  };
  pulse();
}

function noteF2lPop(prevIds, cubeMove) {
  if (undoingMove) return;
  if (!shouldFlashPop(appMode, { timerPhase: solveTimer.phase, lastDone: solveTimer.lastDone, f2lLocked })) return;
  if (prevIds.length === 4) f2lLocked = true;
  if (f2lLocked || solveTimer.lastDone >= 2) return;
  const popped = poppedSolvedSlots(prevIds, facelets, cubeMove);
  if (!popped.length) return;
  flashF2lPop(popped);
}

function stampNewSplits() {
  for (const split of solveTimer.splits) {
    if (split.alg != null) continue;
    if (!split.moves) {
      split.alg = "";
      split.trace = [];
      continue;
    }
    const start = solveTrace.length - split.moves;
    const slice = solveTrace.slice(Math.max(0, start));
    split.alg = slice.map((x) => x.move).join(" ");
    split.trace = slice.map((x) => ({ move: x.move, ms: x.ms }));
  }
}

function syncSolveTimer() {
  if (solveTimer.phase !== "running") {
    paintTimer();
    return;
  }
  const result = activeAnalyze(facelets);
  noteProgress(solveTimer, {
    now: performance.now(),
    moveCount: moveHistory.length,
    stepsDone: result.stepsDone,
    solved: result.solved,
    steps: activeSteps(),
  });
  stampNewSplits();
  markF2lPairProgress();
  if (solveTimer.phase === "done") {
    stopTimerTick();
    showSolveAnalysis();
  }
  paintTimer();
}

function readyFullSolveTimer() {
  stopTimerTick();
  armTimer(solveTimer);
  hideSolveAnalysis();
  paintTimer();
}

function clearSolveTimer() {
  stopTimerTick();
  resetTimer(solveTimer);
  hideSolveAnalysis();
  paintTimer();
}

function advanceStickyOnTwist(cubeMove) {
  if (!cubeMove) return;
  const sticky =
    appMode === "pll" ? stickyPllHint : appMode === "oll" ? stickyOllHint : appMode === "cmll" ? stickyCmllHint : null;
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

  const prevSlots = popBaselineIds(facelets, f2lStableSlots);

  try {
    if (solveTimer.phase === "armed") {
      const alreadyDone = activeAnalyze(facelets).stepsDone.filter(Boolean).length;
      startTimer(solveTimer, performance.now(), moveHistory.length, alreadyDone, activeSteps());
      startTimerTick();
    }
    if (!virtual && cubeMove) {
      applyMove(facelets, cubeMove);
      advanceStickyOnTwist(cubeMove);
    }
    if (viewMove) recordTwist(viewMove);
    if (solveTimer.phase === "running") markF2lPairProgress();
    noteF2lPop(prevSlots, cubeMove);
    syncF2lStableSlots();
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
    onPlayStart: enterPlayFocus,
    onPlayEnd: scheduleRestoreHints,
  });
  updateMoveTrace();
}

function refreshGuide() {
  syncSolveTimer();
  paintF2lCaseChrome();

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
  if (appMode === "fb") {
    refreshFb();
    return;
  }
  if (appMode === "sb") {
    refreshSb();
    return;
  }
  if (appMode === "cmll") {
    refreshCmll();
    return;
  }
  if (appMode === "lse") {
    refreshLse();
    return;
  }

  const guideSteps = activeSteps();
  const result = activeAnalyze(facelets);
  const splitByIndex = new Map(solveTimer.splits.map((s) => [s.index, s]));
  stepsEl.innerHTML = guideSteps.map((step, i) => {
    const done = result.stepsDone[i];
    const current = !result.solved && result.stepIndex === i;
    const cls = ["step", done ? "is-done" : "", current ? "is-current" : ""].filter(Boolean).join(" ");
    const split = splitByIndex.get(i);
    const timeHtml = split ? `<span class="step-time">${formatClock(split.ms)}</span>` : "";
    return `<li class="${cls}">
      <span class="step-num">${done ? "✓" : i + 1}</span>
      <div>
        <h3>${step.title}${timeHtml}</h3>
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
  document.getElementById("hint-kicker").textContent = `Step ${result.stepIndex + 1} · ${activeSteps()[result.stepIndex].title}`;
  document.getElementById("hint-title").textContent = h.title;
  document.getElementById("hint-copy").textContent = h.copy;
  document.getElementById("hint-alg").textContent = h.alg;
  document.getElementById("hint-note").textContent = h.note || "";
  lastHintAlg = h.alg && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-apply-alg").hidden = !lastHintAlg;
}


function refreshFb() {
  const result = analyzeFirstBlock(facelets);
  const prog = document.getElementById("fb-progress");
  prog.innerHTML = result.progress
    .map(
      (p) =>
        `<div class="f2l-slot ${p.done ? "is-done" : ""}" title="${p.label}">
          <span class="f2l-slot-id">${p.id}</span>
          <span class="f2l-slot-mark">${p.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");
  const solvedEl = document.getElementById("fb-solved-banner");
  const card = document.getElementById("fb-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastFbAlg = "";
    return;
  }
  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("fb-hint-kicker").textContent = `FB · ${result.progress.filter((p) => p.done).length}/5`;
  document.getElementById("fb-hint-title").textContent = h.title;
  document.getElementById("fb-hint-copy").textContent = h.copy;
  document.getElementById("fb-hint-alg").textContent = h.alg || "—";
  document.getElementById("fb-hint-note").textContent = h.note || "";
  lastFbAlg = h.alg && h.alg.trim() && !h.alg.includes("…") && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-fb-apply").hidden = !lastFbAlg;
}

function refreshSb() {
  const result = analyzeSecondBlock(facelets);
  const prog = document.getElementById("sb-progress");
  prog.innerHTML = result.progress
    .map(
      (p) =>
        `<div class="f2l-slot ${p.done ? "is-done" : ""}" title="${p.label}">
          <span class="f2l-slot-id">${p.id}</span>
          <span class="f2l-slot-mark">${p.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");
  const solvedEl = document.getElementById("sb-solved-banner");
  const card = document.getElementById("sb-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastSbAlg = "";
    return;
  }
  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("sb-hint-kicker").textContent = `SB · ${result.progress.filter((p) => p.done).length}/5`;
  document.getElementById("sb-hint-title").textContent = h.title;
  document.getElementById("sb-hint-copy").textContent = h.copy;
  document.getElementById("sb-hint-alg").textContent = h.alg || "—";
  document.getElementById("sb-hint-note").textContent = h.note || "";
  lastSbAlg = h.alg && h.alg.trim() && !h.alg.includes("…") && !h.alg.includes("intuitive") ? h.alg : "";
  document.getElementById("btn-sb-apply").hidden = !lastSbAlg;
}

function refreshCmll() {
  const result = analyzeCmll(facelets);
  const prog = document.getElementById("cmll-progress");
  prog.innerHTML = [
    { id: "1", label: "Orient", done: result.oriented || result.complete },
    { id: "2", label: "Permute", done: result.complete },
  ]
    .map(
      (x) =>
        `<div class="f2l-slot ${x.done ? "is-done" : ""}" title="${x.label}">
          <span class="f2l-slot-id">${x.id}</span>
          <span class="f2l-slot-mark">${x.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("cmll-solved-banner");
  const card = document.getElementById("cmll-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastCmllAlg = "";
    stickyCmllHint = null;
    return;
  }

  if (result.hint?.alg) {
    stickyCmllHint = bindStickyAlg(stickyCmllHint, result.hint, result.oriented ? "permute" : "orient");
  }

  let h = result.hint;
  const shownAlg = displayAlgFromSticky(stickyCmllHint, h?.alg);
  solvedEl.hidden = true;
  card.hidden = false;
  const d = getCmllDrillInfo();
  document.getElementById("cmll-hint-kicker").textContent = d.started
    ? `CMLL · ${d.name} · ${d.index + 1}/${d.total}`
    : "2-look CMLL";
  document.getElementById("cmll-hint-title").textContent = h?.title || "CMLL";
  setHintDiagram(document.getElementById("cmll-hint-diagram"), h?.diagram);
  setHintCopy(document.getElementById("cmll-hint-copy"), h?.copy || "");
  document.getElementById("cmll-hint-alg").textContent = shownAlg || "—";
  document.getElementById("cmll-hint-note").textContent = h?.note || "";
  lastCmllAlg =
    stickyCmllHint?.remaining && stickyCmllHint.remaining !== "— done —"
      ? stickyCmllHint.remaining
      : shownAlg && shownAlg !== "— done —" && !String(shownAlg).includes("…")
        ? shownAlg
        : "";
  document.getElementById("btn-cmll-apply").hidden = !lastCmllAlg;
}

function refreshLse() {
  const result = analyzeLse(facelets);
  const prog = document.getElementById("lse-progress");
  prog.innerHTML = lseProgress(facelets)
    .map(
      (p) =>
        `<div class="f2l-slot ${p.done ? "is-done" : ""}" title="${p.label}">
          <span class="f2l-slot-id">${p.label}</span>
          <span class="f2l-slot-mark">${p.done ? "✓" : "·"}</span>
        </div>`
    )
    .join("");

  const solvedEl = document.getElementById("lse-solved-banner");
  const card = document.getElementById("lse-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    card.hidden = true;
    lastLseAlg = "";
    return;
  }
  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  const d = getLseDrillInfo();
  document.getElementById("lse-hint-kicker").textContent = d.started
    ? `LSE · ${d.name} · ${d.index + 1}/${d.total}`
    : "LSE";
  document.getElementById("lse-hint-title").textContent = h.title;
  document.getElementById("lse-hint-copy").textContent = h.copy;
  document.getElementById("lse-hint-alg").textContent = h.alg || "—";
  document.getElementById("lse-hint-note").textContent = h.note || "";
  lastLseAlg = h.alg && h.alg.trim() && !h.alg.includes("…") ? h.alg : "";
  document.getElementById("btn-lse-apply").hidden = !lastLseAlg;
}

function paintF2lCaseChrome() {
  const overlay = document.getElementById("f2l-case-overlay");
  const overlayId = document.getElementById("f2l-case-overlay-id");
  const overlayHand = document.getElementById("f2l-case-overlay-hand");
  const badge = document.getElementById("f2l-case-badge");
  const badgeId = document.getElementById("f2l-case-id");
  const badgeHand = document.getElementById("f2l-case-hand");
  const on = appMode === "f2l";
  if (solveTimerEl) solveTimerEl.hidden = on;
  if (overlay) overlay.hidden = !on;
  if (badge) badge.hidden = !on;
  if (!on) return;

  const d = getF2lDrillInfo();
  const id = d.started ? d.id : "—";
  const hand = d.started ? (d.hand === "R" ? "R/U · FR" : "L/U · FL") : "tap Next";
  if (overlayId) overlayId.textContent = id;
  if (overlayHand) overlayHand.textContent = hand;
  if (badgeId) badgeId.textContent = id;
  if (badgeHand) badgeHand.textContent = hand;
}

function refreshF2L() {
  paintF2lCaseChrome();
  const result = analyzeF2lDrill(facelets);
  const d = getF2lDrillInfo();
  const prog = document.getElementById("f2l-progress");
  const prev = d.started ? d.prevId : "";
  const cur = d.id;
  const nxt = d.nextId;
  prog.innerHTML = [
    prev && `<div class="f2l-slot" title="previous"><span class="f2l-slot-id">${prev}</span></div>`,
    `<div class="f2l-slot is-live" title="${d.name}"><span class="f2l-slot-id">${cur}</span></div>`,
    `<div class="f2l-slot" title="next"><span class="f2l-slot-id">${nxt}</span></div>`,
  ]
    .filter(Boolean)
    .join("");

  const solvedEl = document.getElementById("f2l-solved-banner");
  const card = document.getElementById("f2l-hint-card");
  if (result.complete) {
    solvedEl.hidden = false;
    solvedEl.innerHTML = `<strong>${d.id} in.</strong> Stay here, or tap Next F2L (${d.nextId}) / Prev / Again.`;
    card.hidden = false;
    lastF2lAlg = "";
    document.getElementById("btn-f2l-apply").hidden = true;
    document.getElementById("f2l-hint-kicker").textContent = `F2L ${d.id} · ${d.index + 1}/${d.total} · ${d.group}`;
    document.getElementById("f2l-hint-title").textContent = `${d.id} in`;
    document.getElementById("f2l-hint-copy").textContent = `Stay on ${d.id}. Next is ${d.nextId}.`;
    document.getElementById("f2l-hint-alg").textContent = "";
    document.getElementById("f2l-hint-note").textContent = "";
    return;
  }

  solvedEl.hidden = true;
  card.hidden = false;
  const h = result.hint;
  document.getElementById("f2l-hint-kicker").textContent = d.started
    ? `F2L ${d.id} · ${d.index + 1}/${d.total} · ${d.group}`
    : "F2L · 41 cases";
  document.getElementById("f2l-hint-title").textContent = h.title;
  document.getElementById("f2l-hint-copy").textContent = h.copy;
  document.getElementById("f2l-hint-alg").textContent = h.alg || "—";
  document.getElementById("f2l-hint-note").textContent = h.note || "";
  lastF2lAlg = h.alg && h.alg.trim() && h.alg !== "Undo" ? h.alg : "";
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
  const look = getOllLook();
  const result = analyzeOll(facelets, { look });
  const prog = document.getElementById("oll-progress");
  const steps =
    look === "cross"
      ? [{ id: "1", label: "Cross", done: result.crossDone || result.complete }]
      : [
          { id: "1", label: "Cross", done: result.crossDone || result.complete },
          { id: "2", label: "Corners", done: result.complete },
        ];
  prog.innerHTML = steps
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
    const titleEl = document.getElementById("oll-solved-title");
    const copyEl = document.getElementById("oll-solved-copy");
    if (titleEl) {
      titleEl.textContent = look === "cross" ? "Look 1 done — yellow cross." : "Look 2 done — yellow face.";
    }
    if (copyEl) {
      copyEl.textContent =
        look === "cross"
          ? "Again / Next for another shape, or switch to Look 2 for corners."
          : "Again = same case · Next OLL = next corner case · or open PLL.";
    }
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
  const drill = getOllDrillInfo();
  const stageLabel =
    look === "cross"
      ? `Look 1 · Cross · ${drill.name}`
      : stage === "finish"
        ? `Look 2 · Corners · ${drill.name}`
        : `Look 2 · ${drill.name}`;
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

function syncOllLookChrome() {
  const look = getOllLook();
  document.querySelectorAll("[data-oll-look]").forEach((btn) => {
    const on = btn.dataset.ollLook === look;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}


function buildFbTips() {
  const el = document.getElementById("fb-tips");
  if (!el) return;
  el.innerHTML = FB_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}
function buildSbTips() {
  const el = document.getElementById("sb-tips");
  if (!el) return;
  el.innerHTML = SB_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}
function buildCmllTips() {
  const el = document.getElementById("cmll-tips");
  if (!el) return;
  el.innerHTML = CMLL_TIPS.map(
    (t) => `<article class="f2l-tip"><h3>${t.title}</h3><p>${t.body}</p></article>`
  ).join("");
}
function buildLseTips() {
  const el = document.getElementById("lse-tips");
  if (!el) return;
  el.innerHTML = LSE_TIPS.map(
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
  paintF2lCaseChrome();
  const title = document.getElementById("panel-title");
  const blurb = document.getElementById("panel-blurb");
  const btnScramble = document.getElementById("btn-scramble");
  const btnCross = document.getElementById("btn-cross-case");
  const btnF2l = document.getElementById("btn-f2l-case");
  const btnF2lPrev = document.getElementById("btn-f2l-prev");
  const btnF2lAgain = document.getElementById("btn-f2l-again");
  const btnF2lRandom = document.getElementById("btn-f2l-random");
  const btnOll = document.getElementById("btn-oll-case");
  const btnOllAgain = document.getElementById("btn-oll-again");
  const btnPll = document.getElementById("btn-pll-case");
  const btnPllAgain = document.getElementById("btn-pll-again");
  const btnHint = document.getElementById("btn-hint");

  btnScramble.hidden = true;
  btnCross.hidden = true;
  btnF2l.hidden = true;
  btnF2lPrev.hidden = true;
  btnF2lAgain.hidden = true;
  btnF2lRandom.hidden = true;
  btnOll.hidden = true;
  btnOllAgain.hidden = true;
  btnPll.hidden = true;
  btnPllAgain.hidden = true;

  const btnFb = document.getElementById("btn-fb-case");
  const btnSb = document.getElementById("btn-sb-case");
  const btnCmll = document.getElementById("btn-cmll-case");
  const btnCmllAgain = document.getElementById("btn-cmll-again");
  const btnLse = document.getElementById("btn-lse-case");
  const btnLseAgain = document.getElementById("btn-lse-again");
  if (btnFb) btnFb.hidden = true;
  if (btnSb) btnSb.hidden = true;
  if (btnCmll) btnCmll.hidden = true;
  if (btnCmllAgain) btnCmllAgain.hidden = true;
  if (btnLse) btnLse.hidden = true;
  if (btnLseAgain) btnLseAgain.hidden = true;

  if (mode === "cross") {
    title.textContent = "White cross drill";
    blurb.innerHTML =
      "White on the bottom. Build the <strong>+</strong> — four edges, each side colour matching its centre. Tap <strong>New cross</strong>, then solve one edge at a time with <strong>Cross hint</strong>.";
    btnCross.hidden = false;
    btnHint.textContent = "Cross hint";
  } else if (mode === "f2l") {
    const d = getF2lDrillInfo();
    title.textContent = "F2L — 41 standard cases";
    blurb.innerHTML = d.started
      ? `Now <strong>${d.id}</strong> · ${d.index + 1}/${d.total} · ${d.group}. <strong>Prev</strong> / <strong>Again</strong> / <strong>Next F2L</strong> follow CubeHead’s list order.`
      : `Drill the <strong>41 standard F2L cases</strong> (CubeHead order). Twins share a number: 1R then 1L. No left twin → just 11. <strong>Prev</strong> / <strong>Again</strong> / <strong>Next F2L</strong> walk the list; <strong>Random</strong> jumps once. Reference: <a class="ext-link" href="https://www.youtube.com/watch?v=3tYj-9f4dA0" target="_blank" rel="noopener">CubeHead F2L</a>.`;
    btnF2l.hidden = false;
    btnF2lPrev.hidden = false;
    btnF2lAgain.hidden = false;
    btnF2lRandom.hidden = false;
    btnHint.textContent = "F2L hint";
  } else if (mode === "oll") {
    const d = getOllDrillInfo();
    const look = d.look;
    title.textContent = look === "cross" ? "2-look OLL — look 1 · 3 algs" : "2-look OLL — look 2 · 7 algs";
    blurb.innerHTML =
      look === "cross"
        ? `Now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}. Only the yellow cross (line / L / dot). Switch to <strong>Look 2</strong> for the 7 corner algs.`
        : `Now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}. Yellow cross is already there — one of 7 corner algs. <strong>Again</strong> / <strong>Next OLL</strong>. Switch to Look 1 if you want line / L / dot. From <a class="ext-link" href="https://www.cube.academy/2-look-oll-algs" target="_blank" rel="noopener">CubeHead 2-look OLL</a>.`;
    btnOll.hidden = false;
    btnOllAgain.hidden = false;
    btnHint.textContent = "OLL hint";
    syncOllLookChrome();
  } else if (mode === "pll") {
    const d = getPllDrillInfo();
    title.textContent = "2-look PLL — 6 algs";
    blurb.innerHTML = `Now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}. Corners = T or Y · Edges = Ua / Ub / H / Z. <strong>PLL hint</strong> lights the next move — including <strong>M / M' / M2</strong> for H and Z. <strong>Again</strong> / <strong>Next PLL</strong>. From <a class="ext-link" href="https://www.cube.academy/2-look-pll-algs" target="_blank" rel="noopener">CubeHead 2-look PLL</a>.`;
    btnPll.hidden = false;
    btnPllAgain.hidden = false;
    btnHint.textContent = "PLL hint";
  } else if (mode === "fb") {
    title.textContent = "First block drill";
    blurb.innerHTML =
      "Left <strong>1×2×3</strong> on orange. Tap <strong>New FB</strong>, then <strong>FB hint</strong> for the next piece. White stays on D.";
    if (btnFb) btnFb.hidden = false;
    btnHint.textContent = "FB hint";
  } else if (mode === "sb") {
    title.textContent = "Second block drill";
    blurb.innerHTML =
      "Right <strong>1×2×3</strong> on red. Tap <strong>New SB</strong>. Protect the left block; leave the M-slice free.";
    if (btnSb) btnSb.hidden = false;
    btnHint.textContent = "SB hint";
  } else if (mode === "cmll") {
    const d = getCmllDrillInfo();
    title.textContent = "2-look CMLL";
    blurb.innerHTML = `Now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}. Orient = Sune · Permute = Niklas or diagonal. <strong>Again</strong> / <strong>Next CMLL</strong>.`;
    if (btnCmll) btnCmll.hidden = false;
    if (btnCmllAgain) btnCmllAgain.hidden = false;
    btnHint.textContent = "CMLL hint";
  } else if (mode === "lse") {
    const d = getLseDrillInfo();
    title.textContent = "LSE — last six edges";
    blurb.innerHTML = `Now <strong>${d.name}</strong> · ${d.index + 1}/${d.total}. EO → UL/UR → M-slice. Use <strong>M / M' / M2</strong> on the pad.`;
    if (btnLse) btnLse.hidden = false;
    if (btnLseAgain) btnLseAgain.hidden = false;
    btnHint.textContent = "LSE hint";
  } else if (solveMethod === "roux") {
    title.textContent = "Roux drills. White bottom, yellow top.";
    blurb.innerHTML =
      "Scramble a timed solve, or open a tab: FB → SB → 2-look CMLL → LSE. First turn starts the timer. M moves appear on the pad.";
    btnScramble.hidden = false;
    btnHint.textContent = "Next hint";
  } else {
    title.textContent = "CFOP drills. White bottom, yellow top.";
    blurb.innerHTML =
      "Scramble a timed solve, or open a tab to drill one stage. Cross → F2L → 2-look OLL → 2-look PLL. First turn starts the timer.";
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

function firstRemainingMove(alg) {
  return (
    String(alg || "")
      .trim()
      .split(/\s+/)
      .find((t) => t && !t.includes("…")) || ""
  );
}

/** PLL/OLL/LSE hint: light the next pad button (M / M' / M2 for H and Z). */
function flashHintedMove(alg) {
  const move = firstRemainingMove(alg);
  if (!move) return;
  if (/^[MSE]/i.test(move)) {
    const sliceRow = document.getElementById("move-row-slice");
    if (sliceRow) sliceRow.hidden = false;
    if (movePad.hidden) setMovePadVisible(true, { persist: false });
  }
  flashMovePad(move);
  flashFlickToast(move);
}

function doAlg(alg) {
  if (!alg || alg.includes("intuitive") || alg.includes("repeat")) return;
  erno?.twistAlg(expandWideAlg(alg));
}

function resetCube() {
  facelets = solvedFacelets();
  undoingMove = false;
  clearMoveHistory();
  timedScramble = "";
  paintScrambleCard("");
  solveTrace = [];
  timedUndos = 0;
  lastSolveReport = "";
  stickyOllHint = null;
  stickyPllHint = null;
  stickyCmllHint = null;
  f2lPairMarks = [];
  f2lPairsLogged = 0;
  f2lLocked = false;
  f2lStableSlots = [];
  clearSolveTimer();
  mountErno();
  refreshGuide();
  syncF2lStableSlots();
}

let scrambleGen = 0;

function playScrambleAlg(alg, { timeSolve = false, instant = false } = {}) {
  const gen = ++scrambleGen;
  facelets = solvedFacelets();
  if (alg) applyAlg(facelets, alg);
  undoingMove = false;
  clearMoveHistory();
  stickyOllHint = null;
  stickyPllHint = null;
  stickyCmllHint = null;
  timedScramble = timeSolve ? alg || "" : "";
  paintScrambleCard(timeSolve ? alg : "");
  solveTrace = [];
  timedUndos = 0;
  lastSolveReport = "";
  f2lPairMarks = [];
  f2lPairsLogged = 0;
  f2lLocked = false;
  f2lStableSlots = [];
  if (timeSolve) {
    stopTimerTick();
    resetTimer(solveTimer);
    hideSolveAnalysis();
    paintTimer();
  } else {
    clearSolveTimer();
  }
  mountErno();
  if (alg) {
    syncingFromUi = true;
    erno.setSuppressOrbitDetect(true);
    updateMoveTrace();
    // Scramble is cube-space; temporarily clear viewer yaw (fresh mount is 0)
    erno.twistAlg(alg, { instant: instant || timeSolve });
    erno.whenIdle(() => {
      if (gen !== scrambleGen) return;
      erno.clearHistory();
      syncingFromUi = false;
      erno.setSuppressOrbitDetect(false);
      updateMoveTrace();
      erno.healVisual();
      syncF2lStableSlots();
      if (timeSolve) readyFullSolveTimer();
    });
  } else if (timeSolve) {
    readyFullSolveTimer();
  }
  refreshGuide();
  syncF2lStableSlots();
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

function setMovePadVisible(visible, { persist = true } = {}) {
  stageMain.classList.toggle("move-pad-hidden", !visible);
  movePad.hidden = !visible;
  btnTogglePad.setAttribute("aria-pressed", visible ? "true" : "false");
  btnTogglePad.textContent = visible ? "Hide moves" : "Show moves";
  if (persist) {
    try {
      const key = isCompactLayout() ? PHONE_PAD_KEY : MOVE_PAD_KEY;
      localStorage.setItem(key, visible ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  // Give the cube more room after the pad collapses
  requestAnimationFrame(() => erno?.resize());
}

document.querySelectorAll(".move-btn").forEach((btn) => {
  btn.addEventListener("click", () => doMove(btn.dataset.move));
});

btnUndo.addEventListener("click", () => undoLastMove());

solveAnalysisEl?.addEventListener("click", (e) => {
  const shareBtn = e.target.closest("#btn-share-solve");
  const copyBtn = e.target.closest("#btn-copy-solve");
  if (!shareBtn && !copyBtn) return;
  e.preventDefault();
  const text = reportText();
  if (!text) return;

  if (shareBtn && typeof navigator.share === "function") {
    navigator.share({ title: "3×3 Coach solve", text }).catch(() => {
      selectReportField();
    });
    return;
  }

  const ok = copyReportNow();
  markCopyButton(copyBtn || shareBtn, ok);
  if (!ok) selectReportField();
});

btnTogglePad.addEventListener("click", () => {
  const visible = btnTogglePad.getAttribute("aria-pressed") !== "true";
  setMovePadVisible(visible);
});

btnHints?.addEventListener("click", () => {
  const open = !document.body.classList.contains("hints-open");
  hintsPinned = open;
  window.clearTimeout(restoreHintsTimer);
  setHintsOpen(open);
});

btnCloseHints?.addEventListener("click", () => {
  hintsPinned = false;
  window.clearTimeout(restoreHintsTimer);
  setHintsOpen(false);
});

// Safari treats rapid taps as double-tap-to-zoom. preventDefault on touchend
// keeps Undo / toolbar buttons as plain taps.
document.querySelectorAll(".toolbar .btn, .move-btn, #btn-close-hints").forEach((el) => {
  el.addEventListener(
    "touchend",
    (e) => {
      if (el.disabled) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      el.click();
    },
    { passive: false }
  );
});

document.getElementById("btn-reset").addEventListener("click", () => {
  resetCube();
});

document.getElementById("btn-scramble").addEventListener("click", () => {
  issueFullScramble();
});
document.getElementById("btn-scramble-card")?.addEventListener("click", () => {
  issueFullScramble();
});

document.getElementById("btn-cross-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCross(draft);
  playScrambleAlg(alg);
});

document.getElementById("btn-f2l-prev").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft, "prev");
  playScrambleAlg(alg);
  setPanelCopy("f2l");
});

document.getElementById("btn-f2l-again").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft, "again");
  playScrambleAlg(alg);
  setPanelCopy("f2l");
});

document.getElementById("btn-f2l-case").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft, "next");
  playScrambleAlg(alg);
  setPanelCopy("f2l");
});

document.getElementById("btn-f2l-random").addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleF2L(draft, "random");
  playScrambleAlg(alg);
  setPanelCopy("f2l");
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

document.querySelectorAll("[data-oll-look]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.ollLook;
    if (!next || next === getOllLook()) return;
    setOllLook(next);
    try {
      localStorage.setItem(OLL_LOOK_KEY, next);
    } catch {
      /* ignore */
    }
    stickyOllHint = null;
    const draft = solvedFacelets();
    const alg = scrambleOll(draft, "again");
    playScrambleAlg(alg);
    setPanelCopy("oll");
    refreshOll();
  });
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

document.getElementById("btn-fb-case")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleFb(draft);
  playScrambleAlg(alg);
  setPanelCopy("fb");
});

document.getElementById("btn-sb-case")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleSb(draft);
  playScrambleAlg(alg);
  setPanelCopy("sb");
});

document.getElementById("btn-cmll-again")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCmll(draft, "again");
  playScrambleAlg(alg);
  setPanelCopy("cmll");
});

document.getElementById("btn-cmll-case")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleCmll(draft, "next");
  playScrambleAlg(alg);
  setPanelCopy("cmll");
});

document.getElementById("btn-lse-again")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleLse(draft, "again");
  playScrambleAlg(alg);
  setPanelCopy("lse");
});

document.getElementById("btn-lse-case")?.addEventListener("click", () => {
  const draft = solvedFacelets();
  const alg = scrambleLse(draft, "next");
  playScrambleAlg(alg);
  setPanelCopy("lse");
});

document.getElementById("btn-fb-apply")?.addEventListener("click", () => {
  if (lastFbAlg) doAlg(lastFbAlg);
});
document.getElementById("btn-sb-apply")?.addEventListener("click", () => {
  if (lastSbAlg) doAlg(lastSbAlg);
});
document.getElementById("btn-cmll-apply")?.addEventListener("click", () => {
  if (lastCmllAlg) doAlg(lastCmllAlg);
});
document.getElementById("btn-lse-apply")?.addEventListener("click", () => {
  if (lastLseAlg) doAlg(lastLseAlg);
});

document.getElementById("btn-hint").addEventListener("click", () => {
  if (isCompactLayout()) {
    hintsPinned = true;
    window.clearTimeout(restoreHintsTimer);
    setHintsOpen(true);
  }
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
    flashHintedMove(lastPllAlg);
    return;
  }
  if (appMode === "fb") {
    refreshFb();
    document.getElementById("fb-hint-card").hidden = false;
    document.getElementById("fb-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "sb") {
    refreshSb();
    document.getElementById("sb-hint-card").hidden = false;
    document.getElementById("sb-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "cmll") {
    refreshCmll();
    document.getElementById("cmll-hint-card").hidden = false;
    document.getElementById("cmll-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }
  if (appMode === "lse") {
    refreshLse();
    document.getElementById("lse-hint-card").hidden = false;
    document.getElementById("lse-hint-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  fb: document.getElementById("panel-fb"),
  sb: document.getElementById("panel-sb"),
  cmll: document.getElementById("panel-cmll"),
  lse: document.getElementById("panel-lse"),
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
    syncSlicePad();
    Object.entries(panels).forEach(([key, el]) => {
      if (el) el.hidden = key !== mode;
    });
    setPanelCopy(mode);
    if (mode === "cross") refreshCross();
    if (mode === "f2l") refreshF2L();
    if (mode === "oll") refreshOll();
    if (mode === "pll") refreshPll();
    if (mode === "fb") refreshFb();
    if (mode === "sb") refreshSb();
    if (mode === "cmll") refreshCmll();
    if (mode === "lse") refreshLse();
    if (mode === "guide") refreshGuide();
    if (mode === "algs") buildAlgList();
  });
});

document.querySelectorAll(".method-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const next = btn.dataset.method;
    if (!next || next === solveMethod) return;
    solveMethod = next;
    syncMethodChrome();
    clearSolveTimer();
    buildAlgList();
    // Drop into Guide for the new method
    document.getElementById("tab-guide").click();
    setPanelCopy("guide");
    refreshGuide();
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
  if (!activeAnalyze(facelets).solved) readyFullSolveTimer();
  else clearSolveTimer();
});

document.getElementById("tab-match").addEventListener("click", () => {
  syncNetFromCube();
  buildNet();
});

function buildAlgList() {
  const el = document.getElementById("alg-list");
  el.innerHTML = activeAlgLibrary().map((a) => {
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
  m: "M",
  ",": "M2",
};

window.addEventListener("keydown", (e) => {
  if (e.target?.matches?.("input, textarea, select")) return;
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
  if (key === "m" && e.shiftKey) {
    e.preventDefault();
    doMove("M'");
    return;
  }
  const move = KEY_MOVES[key];
  if (move) {
    e.preventDefault();
    doMove(move);
  }
});

let wasCompactLayout = isCompactLayout();
window.addEventListener("resize", () => {
  const compact = isCompactLayout();
  if (compact !== wasCompactLayout) {
    wasCompactLayout = compact;
    setHintsOpen(compact);
  }
  erno?.resize();
});

try {
  if (isCompactLayout()) {
    setMovePadVisible(localStorage.getItem(PHONE_PAD_KEY) === "1");
  } else {
    setMovePadVisible(localStorage.getItem(MOVE_PAD_KEY) !== "0");
  }
} catch {
  setMovePadVisible(!isCompactLayout());
}

setHintsOpen(isCompactLayout());

try {
  const savedLook = localStorage.getItem(OLL_LOOK_KEY);
  if (savedLook === "cross" || savedLook === "corners") setOllLook(savedLook);
} catch {
  /* default look 2 */
}

buildPalette();
buildCrossTips();
buildOllTips();
buildPllTips();
buildFbTips();
buildSbTips();
buildCmllTips();
buildLseTips();
buildAlgList();
buildF2LTips();
syncMethodChrome();
try {
  localStorage.removeItem("f2l-drill-random");
} catch {
  /* ignore */
}
syncNetFromCube();
buildNet();
setPanelCopy("guide");
mountErno();
render();
clearMoveHistory();
paintTimer();
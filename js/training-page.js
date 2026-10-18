/**
 * Training home, case picker, and Drill / Learn sessions.
 * The cube path reuses the timer's smart-cube connection. Queue rules live in
 * training-queue.js.
 */

import { expandWideAlg } from "./alg.js?v=training4";
import {
  initAlgProgress,
  notationTokens,
  peekNotationToken,
  traceAlgMove,
} from "./alg-progress.js?v=training4";
import {
  isRotationMove,
  physicalMoveToAlgMove,
} from "./cube-gyro.js?v=gyro5";
import { renderCaseDiagram } from "./case-diagram.js?v=training4";
import { createCubeMirror } from "./cube-mirror.js?v=gyro5";
import { faceletsSolved } from "./move-log.js?v=training4";
import { initSmartCube } from "./smart-cube.js?v=gyro5";
import { formatClock } from "./solve-timer.js?v=training4";
import {
  STREAK_DOTS,
  addTrainingTime,
  caseKey,
  caseTarget,
  caseTimeStats,
  catalogIds,
  chooseAlg,
  createTrainingSet,
  goalForCase,
  groupCount,
  listCases,
  loadTrainingMethod,
  loadTrainingSets,
  loadTrainingTimes,
  nextStreak,
  normalizeCaseIds,
  normalizeTrainingSet,
  pickTrainingCase,
  replaceTrainingSet,
  saveTrainingMethod,
  saveTrainingSets,
  saveTrainingTimes,
  toggleCaseId,
  trailingStreak,
  trainingCubeDecision,
  trainingPool,
  withoutTrainingSet,
} from "./training-queue.js?v=training4";

const ORDER_LABEL = { random: "Random", weakest: "Weakest first", fixed: "Fixed" };

function browserStore() {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTypingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target?.isContentEditable);
}

const store = browserStore();
const homeEl = document.getElementById("training-home");
const sessionEl = document.getElementById("training-session");
const cardsEl = document.getElementById("training-cards");
const stubEl = document.getElementById("training-stub");
const cfopEl = document.getElementById("training-cfop");
const pickerDialog = document.getElementById("training-picker");
const gridEl = document.getElementById("training-grid");
const clockBtn = document.getElementById("training-clock");
const clockValue = document.getElementById("training-clock-value");
const statusEl = document.getElementById("training-status");
const cubeEl = document.getElementById("training-cube");
const sceneEl = document.getElementById("training-scene");

const reducedMotion =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const mirror = cubeEl ? createCubeMirror(cubeEl, { reducedMotion }) : null;
mirror?.bindOrbit(sceneEl);

let view = "home";
let method = loadTrainingMethod(store);
let sets = loadTrainingSets(store);
let records = loadTrainingTimes(store);
let session = null;
let picker = null;
let cubeConnected = false;
let lastFacelets = "";
let raf = 0;
let traceFlashTimer = 0;

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function paintClock(ms) {
  if (clockValue) clockValue.textContent = formatClock(ms);
}

function cancelRaf() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function tick() {
  if (!session || session.phase !== "running") return;
  paintClock(Date.now() - session.startedAt);
  raf = requestAnimationFrame(tick);
}

function currentSet() {
  return sets.find((entry) => entry.id === session?.setId) || null;
}

function idleStatus() {
  if (!session?.trainingCase) return "Select a case set.";
  if (session.tracePhase === "setup") {
    if (cubeConnected) {
      return "Follow the setup moves. Each correct turn clears the next notation. Skip setup if the case is already on the cube.";
    }
    return "Setup notation is below. Skip setup to jump to the algorithm, or space to time when you are ready.";
  }
  if (session.tracePhase === "alg") {
    if (cubeConnected && session.cubeArmed) {
      return "Case set up. Follow the algorithm notation — wrong turns rewrite the remaining moves.";
    }
    if (cubeConnected) {
      return "Match the case on the cube (or finish setup), then follow the algorithm notation.";
    }
    return "Algorithm notation is below. Space or tap to start timing.";
  }
  if (cubeConnected && session.cubeArmed) return "Case set up. Turn the cube to start. Space still works.";
  if (cubeConnected) return "Set this case up from solved. The timer arms when the cube matches. Space still starts.";
  return "Space or tap to start. Press again to stop, then space for the next case.";
}

function clearTraceFlash() {
  if (traceFlashTimer) {
    clearTimeout(traceFlashTimer);
    traceFlashTimer = 0;
  }
}

function tracePlan(alg) {
  return initAlgProgress(expandWideAlg(String(alg || "").trim()));
}

function enterSetupTrace() {
  if (!session) return;
  const plan = tracePlan(session.setupNotation);
  session.tracePhase = plan.remaining ? "setup" : "alg";
  session.traceFull = plan.fullAlg;
  session.traceRemaining = plan.remaining;
  session.traceRotations = [];
  session.traceWrong = "";
  session.traceFlashFix = false;
  session.traceFlashWrong = false;
  if (session.tracePhase === "alg") enterAlgTrace();
}

function enterAlgTrace() {
  if (!session) return;
  const plan = tracePlan(session.alg);
  session.tracePhase = plan.remaining ? "alg" : "done";
  session.traceFull = plan.fullAlg;
  session.traceRemaining = plan.remaining;
  session.traceRotations = [];
  session.traceWrong = "";
  session.traceFlashFix = false;
  session.traceFlashWrong = false;
}

function skipSetupTrace() {
  if (!session || session.phase === "running") return;
  if (session.tracePhase !== "setup") return;
  skipSetupOnce = true;
  clearTraceFlash();
  enterAlgTrace();
  paintSession();
  setStatus(idleStatus());
  reconsiderCube();
}

function paintTrace() {
  const root = document.getElementById("training-trace");
  const kicker = document.getElementById("training-trace-kicker");
  const strip = document.getElementById("training-trace-strip");
  const wrongEl = document.getElementById("training-trace-wrong");
  const skipBtn = document.getElementById("training-skip-setup");
  if (!root || !strip) return;
  const active = Boolean(session && (session.tracePhase === "setup" || session.tracePhase === "alg"));
  root.hidden = !active;
  if (!active) {
    if (skipBtn) skipBtn.hidden = true;
    if (wrongEl) {
      wrongEl.hidden = true;
      wrongEl.textContent = "";
    }
    strip.innerHTML = "";
    return;
  }
  const setup = session.tracePhase === "setup";
  if (kicker) kicker.textContent = setup ? "Setup" : "Algorithm";
  if (skipBtn) skipBtn.hidden = !setup || session.phase === "running";
  const tokens = notationTokens(session.traceRemaining);
  if (!tokens.length) {
    strip.innerHTML = `<p class="training-trace-empty">${setup ? "Setup done" : "Algorithm done"}</p>`;
  } else {
    strip.innerHTML = tokens
      .map((tok, index) => {
        const classes = ["training-trace-tok"];
        if (index === 0) {
          classes.push("is-next");
          if (session.traceFlashFix) classes.push("is-fix");
          if (session.traceFlashWrong) classes.push("is-wrong-flash");
        }
        return `<span class="${classes.join(" ")}">${esc(tok)}</span>`;
      })
      .join("");
  }
  if (wrongEl) {
    if (session.traceWrong && session.traceFlashWrong) {
      wrongEl.hidden = false;
      wrongEl.textContent = `Wrong move ${session.traceWrong} — do ${tokens[0] || "the fix"} to continue.`;
    } else {
      wrongEl.hidden = true;
      wrongEl.textContent = "";
    }
  }
}


function cancelInverseRotation(rotations, move) {
  const list = Array.isArray(rotations) ? rotations.slice() : [];
  const inv = {
    x: "x'",
    "x'": "x",
    x2: "x2",
    y: "y'",
    "y'": "y",
    y2: "y2",
    z: "z'",
    "z'": "z",
    z2: "z2",
  };
  const last = list[list.length - 1];
  if (last && inv[move] === last) {
    list.pop();
    return list;
  }
  if (last && last === move && move.endsWith("2")) {
    list.pop();
    return list;
  }
  list.push(move);
  return list;
}

function advanceTrace(move, { kind = "face" } = {}) {
  if (!session || (session.tracePhase !== "setup" && session.tracePhase !== "alg")) return;
  if (!session.traceRemaining) {
    if (session.tracePhase === "setup") {
      enterAlgTrace();
      paintSession();
      setStatus(idleStatus());
    }
    return;
  }
  if (!Array.isArray(session.traceRotations)) session.traceRotations = [];
  const next = peekNotationToken(session.traceRemaining);
  let traceMove = move;
  if (kind === "rotation") {
    // Physical tilt always updates the basis; only a rotation chip can match it.
    session.traceRotations = cancelInverseRotation(session.traceRotations, move);
  } else if (isRotationMove(next)) {
    // Face turn while x/y/z is next: never absorb the rotation chip.
    traceMove = move;
  } else {
    // After a matched x', face turns are read in that tilted frame.
    traceMove = physicalMoveToAlgMove(move, session.traceRotations);
  }
  let result = traceAlgMove(session.traceRemaining, traceMove);
  // Never let the wrong kind of input clear the next chip, even if letters collide.
  if (result.matched) {
    if (kind === "face" && isRotationMove(next)) {
      result = traceAlgMove(session.traceRemaining, move);
      if (result.matched) {
        result = { remaining: session.traceRemaining, matched: false, wrong: true, wrongMove: move, done: false };
      }
    } else if (kind === "rotation" && !isRotationMove(next)) {
      result = traceAlgMove(session.traceRemaining, move);
      if (result.matched) {
        result = { remaining: session.traceRemaining, matched: false, wrong: true, wrongMove: move, done: false };
      }
    }
  }
  session.traceRemaining = result.remaining;
  session.traceWrong = result.wrongMove || "";
  session.traceFlashFix = result.wrong;
  session.traceFlashWrong = result.wrong;
  if (result.matched && result.done) {
    clearTraceFlash();
    if (session.tracePhase === "setup") {
      enterAlgTrace();
      paintSession();
      setStatus(idleStatus());
      return;
    }
    session.tracePhase = "done";
    session.traceFlashFix = false;
    session.traceFlashWrong = false;
    paintSession();
    return;
  }
  paintTrace();
  if (result.wrong) {
    clearTraceFlash();
    traceFlashTimer = window.setTimeout(() => {
      traceFlashTimer = 0;
      if (!session) return;
      session.traceFlashFix = false;
      session.traceFlashWrong = false;
      paintTrace();
    }, 650);
  }
}

function paintMethod() {
  document.querySelectorAll("[data-training-method]").forEach((btn) => {
    const on = btn.dataset.trainingMethod === method;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const cfop = method === "cfop";
  if (cfopEl) cfopEl.hidden = !cfop;
  if (stubEl) stubEl.hidden = cfop;
}

function cardHtml(trainingSet) {
  const oll = groupCount(trainingSet, "oll");
  const pll = groupCount(trainingSet, "pll");
  const streak = trailingStreak(records, trainingSet.id);
  const counts = [
    oll ? `${oll} OLL` : "",
    pll ? `${pll} PLL` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const edit = trainingSet.builtin
    ? ""
    : `<button type="button" class="btn btn-ghost btn-small" data-edit-set="${esc(trainingSet.id)}">Cases</button>
       <button type="button" class="btn btn-ghost btn-small" data-delete-set="${esc(trainingSet.id)}">Delete</button>`;
  const blurb = trainingSet.id === "oll" ? "2-look OLL" : trainingSet.id === "pll" ? "Full PLL" : esc(ORDER_LABEL[trainingSet.order] || "Random");
  return `<article class="training-card">
    <header class="training-card-head">
      <h3>${esc(trainingSet.name)}</h3>
      <p>${blurb}</p>
    </header>
    <p class="training-card-counts">${esc(counts)}</p>
    <p class="training-card-streak">${streak ? `${streak} under goal in a row` : "No streak yet"}</p>
    <div class="training-card-actions">
      <button type="button" class="btn btn-primary btn-small" data-open-set="${esc(trainingSet.id)}" data-open-mode="drill">Drill</button>
      <button type="button" class="btn btn-ghost btn-small" data-open-set="${esc(trainingSet.id)}" data-open-mode="learn">Learn</button>
      ${edit}
    </div>
  </article>`;
}

function paintHome() {
  paintMethod();
  if (!cardsEl) return;
  const custom = sets.filter((entry) => entry.id !== "oll" && entry.id !== "pll");
  const builtins = sets.filter((entry) => entry.id === "oll" || entry.id === "pll");
  cardsEl.innerHTML = `${builtins.map(cardHtml).join("")}${custom.map(cardHtml).join("")}
    <button type="button" class="training-create" id="training-create">
      <span aria-hidden="true">+</span>
      Create training
    </button>`;
}

function lastTime(trainingCase) {
  if (!trainingCase) return null;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    const row = records[i];
    if (row.set === trainingCase.set && row.caseId === trainingCase.id) return row.ms;
  }
  return null;
}

function paintDots(filled) {
  const root = document.getElementById("training-dots");
  if (!root) return;
  const count = Math.max(0, Math.min(STREAK_DOTS, filled));
  root.innerHTML = Array.from({ length: STREAK_DOTS }, (_, index) => {
    const on = index < count;
    return `<span class="training-dot${on ? " is-on" : ""}"></span>`;
  }).join("");
}

function paintSession() {
  if (!session) return;
  const trainingCase = session.trainingCase;
  const learn = session.mode === "learn";
  document.querySelectorAll("[data-session-mode]").forEach((btn) => {
    const on = btn.dataset.sessionMode === session.mode;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const badge = document.getElementById("training-badge");
  if (badge) badge.textContent = learn ? "Learn" : "Drill";
  const title = document.getElementById("training-case-title");
  if (title && trainingCase) {
    title.textContent = `${trainingCase.set.toUpperCase()} · ${trainingCase.short || trainingCase.name}`;
  }
  const diagram = document.getElementById("training-diagram");
  if (diagram) diagram.innerHTML = trainingCase ? renderCaseDiagram(trainingCase.diagram) : "";
  const setup = document.getElementById("training-setup");
  if (setup) setup.textContent = session.setupNotation || "";
  const stats = caseTimeStats(records);
  const row = trainingCase ? stats.get(caseKey(trainingCase)) : null;
  const best = document.getElementById("training-best");
  const last = document.getElementById("training-last");
  if (best) best.textContent = row ? formatClock(row.best) : "—";
  const previous = lastTime(trainingCase);
  if (last) last.textContent = session.phase === "success" ? formatClock(session.elapsed) : previous == null ? "—" : formatClock(previous);
  const progress = document.getElementById("training-progress");
  if (progress) {
    progress.textContent =
      session.order === "fixed"
        ? `Case ${session.cursor + 1} of ${session.pool.length}`
        : `${session.pool.length} cases · ${session.solves} this session`;
  }
  const streakLabel = document.getElementById("training-streak-label");
  if (streakLabel) {
    streakLabel.textContent = session.streak ? `${session.streak} under goal in a row` : "Get under the goal to start a streak";
  }
  const order = document.getElementById("training-order");
  if (order && order.value !== session.order) order.value = session.order;
  const goal = trainingCase ? goalForCase(records, trainingCase.set, trainingCase.id) : null;
  const goalEl = document.getElementById("training-goal");
  if (goalEl) {
    goalEl.textContent = goal
      ? `Goal ${formatClock(goal.ms)} · ${goal.source === "median" ? "your median" : "starter"}`
      : "";
  }
  paintDots(Math.min(STREAK_DOTS, session.streak));
  const learnEl = document.getElementById("training-learn");
  if (learnEl) learnEl.hidden = !learn;
  const algEl = document.getElementById("training-alg");
  if (algEl) algEl.textContent = learn ? session.alg || "" : "";
  const algs = trainingCase?.algs || [];
  const pick = document.getElementById("training-alg-pick");
  const select = document.getElementById("training-alg-select");
  if (pick) pick.hidden = !learn || algs.length < 2;
  if (select && learn && algs.length > 1) {
    const markup = algs
      .map((alg) => `<option value="${esc(alg.id)}"${alg.id === session.algId ? " selected" : ""}>${esc(alg.label || alg.id)}</option>`)
      .join("");
    if (select.dataset.markup !== markup) {
      select.innerHTML = markup;
      select.dataset.markup = markup;
    }
  }
  clockBtn?.classList.toggle("is-hit", session.phase === "success" && session.underGoal);
  clockBtn?.classList.toggle("is-miss", session.phase === "success" && !session.underGoal);
  const again = document.getElementById("training-again");
  const next = document.getElementById("training-next");
  if (again) again.disabled = session.phase === "running";
  if (next) next.disabled = session.phase === "running";
  const queue = document.getElementById("training-queue");
  if (queue && trainingCase) {
    const current = caseKey(trainingCase);
    queue.innerHTML = session.pool
      .map((entry) => {
        const on = caseKey(entry) === current;
        return `<button type="button" class="training-queue-case${on ? " is-current" : ""}" data-jump-case="${esc(caseKey(entry))}" aria-current="${on ? "true" : "false"}">
          <span>${esc(entry.set.toUpperCase())}</span>
          ${esc(entry.short || entry.name)}
        </button>`;
      })
      .join("");
  }
  paintTrace();
}

function paint() {
  if (homeEl) homeEl.hidden = view !== "home";
  if (sessionEl) sessionEl.hidden = view !== "session";
  if (view === "home") paintHome();
  else paintSession();
  if (view === "session") requestAnimationFrame(() => mirror?.fit());
}

function showCube() {
  if (cubeConnected) return;
  if (session?.target) mirror?.setFacelets(session.target);
}

function showCase(picked) {
  if (!session || !picked?.trainingCase) return;
  session.trainingCase = picked.trainingCase;
  session.cursor = picked.cursor;
  session.algId = chooseAlg(picked.trainingCase)?.id || "primary";
  const target = caseTarget(picked.trainingCase, session.algId);
  session.alg = target.alg;
  session.algId = target.algId || session.algId;
  session.setupNotation = target.setupNotation;
  session.target = target.facelets;
  session.phase = "idle";
  session.cubeArmed = false;
  session.sawMove = false;
  session.wasUnsolved = false;
  session.elapsed = 0;
  session.underGoal = false;
  clearTraceFlash();
  enterSetupTrace();
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = 0;
  }
  cancelRaf();
  paintClock(0);
  showCube();
  paint();
  setStatus(idleStatus());
  if (session.phase === "idle") reconsiderCube();
}

function deal(previous) {
  if (!session) return;
  const picked = pickTrainingCase({
    pool: session.pool,
    order: session.order,
    cursor: session.cursor,
    previousKey: previous ? caseKey(session.trainingCase) : "",
    stats: caseTimeStats(records),
  });
  showCase(picked);
}

function writeHash() {
  if (!session) return;
  const next = `#set=${encodeURIComponent(session.setId)}&mode=${session.mode}`;
  if (location.hash === next) return;
  location.hash = next;
}

function clearHash() {
  if (!location.hash) return;
  history.pushState(null, "", location.pathname + location.search);
}

function openSession(setId, mode) {
  const trainingSet = sets.find((entry) => entry.id === setId);
  const pool = trainingPool(trainingSet);
  if (!trainingSet || !pool.length) return;
  cancelRaf();
  session = {
    setId,
    mode: mode === "learn" ? "learn" : "drill",
    order: trainingSet.order,
    pool,
    cursor: 0,
    phase: "idle",
    streak: trailingStreak(records, setId),
    solves: 0,
    elapsed: 0,
    underGoal: false,
    cubeArmed: false,
    sawMove: false,
    wasUnsolved: false,
    target: "",
    alg: "",
    algId: "primary",
    setupNotation: "",
    trainingCase: null,
    facelets: lastFacelets,
    stopTimer: 0,
    tracePhase: "setup",
    traceFull: "",
    traceRemaining: "",
    traceWrong: "",
    traceFlashFix: false,
    traceFlashWrong: false,
  };
  view = "session";
  if (cubeConnected && lastFacelets.length === 54) mirror?.setFacelets(lastFacelets);
  const picked = pickTrainingCase({
    pool,
    order: trainingSet.order,
    cursor: 0,
    previousKey: "",
    stats: caseTimeStats(records),
  });
  showCase(picked);
  writeHash();
}

function closeSession() {
  cancelRaf();
  clearTraceFlash();
  if (session?.stopTimer) clearTimeout(session.stopTimer);
  session = null;
  view = "home";
  paintClock(0);
  paint();
  clearHash();
}

function startTiming() {
  if (!session || session.phase !== "idle" || !session.trainingCase) return;
  session.phase = "running";
  session.startedAt = Date.now();
  session.sawMove = false;
  session.wasUnsolved = false;
  tick();
  paintSession();
  setStatus(cubeConnected ? "Solving… the cube stops it when solved. Space still stops." : "Solving… space or tap to stop.");
}

function stopTiming() {
  if (!session || session.phase !== "running" || !session.trainingCase) return;
  const ms = Math.max(0, Date.now() - session.startedAt);
  cancelRaf();
  if (session.stopTimer) {
    clearTimeout(session.stopTimer);
    session.stopTimer = 0;
  }
  const goal = goalForCase(records, session.trainingCase.set, session.trainingCase.id);
  const underGoal = ms > 0 && ms <= goal.ms;
  const streak = nextStreak(session.streak, ms, goal.ms);
  session.phase = "success";
  session.elapsed = ms;
  session.underGoal = underGoal;
  session.streak = streak.streak;
  session.cubeArmed = false;
  session.solves += 1;
  records = saveTrainingTimes(
    addTrainingTime(records, {
      id: `t-${Date.now()}`,
      ms,
      at: Date.now(),
      set: session.trainingCase.set,
      caseId: session.trainingCase.id,
      setId: session.setId,
      mode: session.mode,
      underGoal,
    }),
    store
  );
  paintClock(ms);
  paintSession();
  const mark = underGoal ? "Under the goal." : "Over the goal.";
  setStatus(`${formatClock(ms)}. ${mark} Turn the cube or press space for the next case.`);
}

function onSpace() {
  if (view !== "session" || !session) return;
  if (session.phase === "running") stopTiming();
  else if (session.phase === "success") deal(true);
  else startTiming();
}

function cubeFields(extra = {}) {
  return {
    phase: session?.phase === "success" ? "idle" : session?.phase || "idle",
    armed: Boolean(session?.cubeArmed),
    facelets: session?.facelets || "",
    target: session?.target || "",
    solved: faceletsSolved(session?.facelets || ""),
    sawMove: Boolean(session?.sawMove),
    wasUnsolved: Boolean(session?.wasUnsolved),
    awaitingNext: session?.phase === "success",
    ...extra,
  };
}

function scheduleStop() {
  if (!session || session.stopTimer) return;
  session.stopTimer = window.setTimeout(() => {
    if (session) session.stopTimer = 0;
    if (session?.phase === "running") stopTiming();
  }, 80);
}

function applyCube(decision) {
  if (!session || view !== "session") return;
  if (decision.action === "arm") {
    session.cubeArmed = true;
    if (session.phase === "idle") setStatus(idleStatus());
    return;
  }
  if (decision.action === "disarm") {
    session.cubeArmed = false;
    if (session.phase === "idle") setStatus(idleStatus());
    return;
  }
  if (decision.action === "start") {
    startTiming();
    session.sawMove = true;
    return;
  }
  if (decision.action === "stop") {
    scheduleStop();
    return;
  }
  if (decision.action === "deal") {
    deal(true);
    return;
  }
  if (decision.action === "log") session.sawMove = true;
}

function reconsiderCube() {
  if (!cubeConnected || !session || session.phase !== "idle" || !session.facelets) return;
  applyCube(trainingCubeDecision(cubeFields()));
}

function onCubeFacelets(facelets) {
  const text = String(facelets || "");
  lastFacelets = text;
  if (!session) return;
  session.facelets = text;
  if (session.phase === "running" && text && !faceletsSolved(text)) session.wasUnsolved = true;
  if (text.length === 54) mirror?.setFacelets(text);
  if (
    session.tracePhase === "setup" &&
    session.phase === "idle" &&
    text.length === 54 &&
    session.target &&
    text === session.target
  ) {
    clearTraceFlash();
    enterAlgTrace();
    paintSession();
    setStatus(idleStatus());
  }
  applyCube(trainingCubeDecision(cubeFields()));
}

function onCubeMove(move) {
  if (!cubeConnected || !session || !move) return;
  mirror?.turn(move);
  if (session.phase === "idle" || session.phase === "running") {
    advanceTrace(move, { kind: "face" });
  }
  applyCube(trainingCubeDecision(cubeFields({ move, solved: false })));
}

function onCubeRotation(move) {
  if (!cubeConnected || !session || !move) return;
  if (session.phase === "idle" || session.phase === "running") {
    advanceTrace(move, { kind: "rotation" });
  }
}

function onCubeGyro(relative) {
  if (!cubeConnected) return;
  mirror?.setHousingOrientation?.(relative);
}

/** Reset gyro: snap Training's 3D cube to yellow-top / green-front face-on rest. */
function onCubeGyroHome() {
  if (!cubeConnected) return;
  if (mirror?.resetRestingView) mirror.resetRestingView();
  else mirror?.clearHousingOrientation?.();
}

function setCubeConnected(connected) {
  cubeConnected = Boolean(connected);
  if (!cubeConnected) {
    mirror?.clearHousingOrientation?.();
  }
  if (!session) return;
  if (!cubeConnected) {
    session.cubeArmed = false;
    session.facelets = "";
    lastFacelets = "";
    showCube();
  }
  if (session.phase === "idle") {
    setStatus(idleStatus());
    if (cubeConnected) reconsiderCube();
  }
}

function syncHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const setId = params.get("set") || "";
  const mode = params.get("mode") === "learn" ? "learn" : "drill";
  if (!setId) {
    if (view === "session") closeSession();
    return;
  }
  if (view === "session" && session?.setId === setId) {
    if (session.mode !== mode) {
      session.mode = mode;
      paintSession();
    }
    return;
  }
  if (sets.some((entry) => entry.id === setId)) openSession(setId, mode);
}

function selectedCount() {
  if (!picker) return 0;
  return picker.oll.length + picker.pll.length;
}

function paintPicker() {
  if (!picker || !gridEl) return;
  const title = document.getElementById("training-picker-title");
  if (title) title.textContent = picker.id ? "Edit cases" : "New training";
  const name = document.getElementById("training-picker-name");
  if (name && name.value !== picker.name && document.activeElement !== name) name.value = picker.name;
  const order = document.getElementById("training-picker-order");
  if (order && order.value !== picker.order) order.value = picker.order;
  document.querySelectorAll("[data-picker-tab]").forEach((btn) => {
    const on = btn.dataset.pickerTab === picker.tab;
    btn.classList.toggle("is-active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  const count = document.getElementById("training-picker-count");
  const total = catalogIds("oll").length + catalogIds("pll").length;
  if (count) count.textContent = `${selectedCount()} / ${total} selected`;
  const selected = new Set(picker[picker.tab] || []);
  gridEl.innerHTML = listCases(picker.tab)
    .map((entry) => {
      const on = selected.has(entry.id);
      return `<button type="button" class="training-case${on ? " is-on" : ""}" data-toggle-case="${esc(entry.id)}" aria-pressed="${on ? "true" : "false"}">
        ${renderCaseDiagram(entry.diagram)}
        <span class="training-case-name">${esc(entry.short || entry.name)}</span>
      </button>`;
    })
    .join("");
  const error = document.getElementById("training-picker-error");
  if (error) error.hidden = !picker.error;
}

function openPicker(trainingSet) {
  picker = trainingSet
    ? {
        id: trainingSet.id,
        name: trainingSet.name,
        order: trainingSet.order,
        tab: groupCount(trainingSet, "oll") && !groupCount(trainingSet, "pll") ? "oll" : "pll",
        oll: normalizeCaseIds("oll", trainingSet.groups.find((group) => group.set === "oll")?.caseIds),
        pll: normalizeCaseIds("pll", trainingSet.groups.find((group) => group.set === "pll")?.caseIds),
        error: false,
      }
    : { id: "", name: "", order: "random", tab: "oll", oll: [], pll: [], error: false };
  paintPicker();
  if (typeof pickerDialog?.showModal === "function") pickerDialog.showModal();
  else pickerDialog?.setAttribute("open", "");
  document.getElementById("training-picker-name")?.focus();
}

function closePicker() {
  picker = null;
  if (typeof pickerDialog?.close === "function" && pickerDialog.open) pickerDialog.close();
  else pickerDialog?.removeAttribute("open");
}

function savePicker() {
  if (!picker) return;
  const groups = [
    { set: "oll", caseIds: picker.oll },
    { set: "pll", caseIds: picker.pll },
  ];
  if (picker.id) {
    const next = normalizeTrainingSet({
      id: picker.id,
      name: picker.name,
      order: picker.order,
      groups,
    });
    if (!next) {
      picker.error = true;
      paintPicker();
      return;
    }
    sets = saveTrainingSets(replaceTrainingSet(sets, next), store);
  } else {
    const created = createTrainingSet({ name: picker.name, order: picker.order, groups }, sets);
    if (!created) {
      picker.error = true;
      paintPicker();
      return;
    }
    sets = saveTrainingSets([...sets, created], store);
  }
  closePicker();
  paintHome();
}

function applyAlgChoice(algId) {
  if (!session?.trainingCase || session.phase === "running") return;
  const target = caseTarget(session.trainingCase, algId);
  if (!target.alg) return;
  session.algId = target.algId;
  session.alg = target.alg;
  session.setupNotation = target.setupNotation;
  session.target = target.facelets;
  session.cubeArmed = false;
  clearTraceFlash();
  enterSetupTrace();
  showCube();
  paintSession();
  setStatus(idleStatus());
  reconsiderCube();
}

document.addEventListener("click", (event) => {
  const methodBtn = event.target.closest?.("[data-training-method]");
  if (methodBtn && view === "home") {
    method = saveTrainingMethod(methodBtn.dataset.trainingMethod, store);
    paintHome();
    return;
  }
  const openBtn = event.target.closest?.("[data-open-set]");
  if (openBtn) {
    openSession(openBtn.dataset.openSet, openBtn.dataset.openMode);
    return;
  }
  if (event.target.closest?.("#training-create")) {
    openPicker(null);
    return;
  }
  const editBtn = event.target.closest?.("[data-edit-set]");
  if (editBtn) {
    const trainingSet = sets.find((entry) => entry.id === editBtn.dataset.editSet);
    if (trainingSet) openPicker(trainingSet);
    return;
  }
  const deleteBtn = event.target.closest?.("[data-delete-set]");
  if (deleteBtn) {
    const trainingSet = sets.find((entry) => entry.id === deleteBtn.dataset.deleteSet);
    if (!trainingSet) return;
    if (!window.confirm(`Delete ${trainingSet.name}? Times for the cases stay.`)) return;
    sets = saveTrainingSets(withoutTrainingSet(sets, trainingSet.id), store);
    paintHome();
    return;
  }
  const modeBtn = event.target.closest?.("[data-session-mode]");
  if (modeBtn && session && session.phase !== "running") {
    session.mode = modeBtn.dataset.sessionMode === "learn" ? "learn" : "drill";
    writeHash();
    paintSession();
    return;
  }
  if (event.target.closest?.("#training-back")) {
    closeSession();
    return;
  }
  if (event.target.closest?.("#training-next") && session?.phase !== "running") {
    deal(true);
    return;
  }
  if (event.target.closest?.("#training-again") && session?.phase !== "running") {
    showCase({ trainingCase: session.trainingCase, cursor: session.cursor });
    return;
  }
  if (event.target.closest?.("#training-skip-setup")) {
    skipSetupTrace();
    return;
  }
  const jump = event.target.closest?.("[data-jump-case]");
  if (jump && session?.phase !== "running") {
    const index = session.pool.findIndex((entry) => caseKey(entry) === jump.dataset.jumpCase);
    if (index >= 0) showCase({ trainingCase: session.pool[index], cursor: index });
    return;
  }
  const tab = event.target.closest?.("[data-picker-tab]");
  if (tab && picker) {
    picker.tab = tab.dataset.pickerTab === "pll" ? "pll" : "oll";
    paintPicker();
    return;
  }
  const toggle = event.target.closest?.("[data-toggle-case]");
  if (toggle && picker) {
    picker[picker.tab] = toggleCaseId(picker.tab, picker[picker.tab], toggle.dataset.toggleCase);
    picker.error = false;
    paintPicker();
  }
});

document.getElementById("training-order")?.addEventListener("change", (event) => {
  if (!session) return;
  const order = event.target.value;
  const trainingSet = currentSet();
  if (!trainingSet) return;
  sets = saveTrainingSets(replaceTrainingSet(sets, { ...trainingSet, order }), store);
  session.order = sets.find((entry) => entry.id === session.setId)?.order || order;
});

document.getElementById("training-alg-select")?.addEventListener("change", (event) => {
  applyAlgChoice(event.target.value);
});

document.getElementById("training-picker-name")?.addEventListener("input", (event) => {
  if (picker) picker.name = event.target.value;
});

document.getElementById("training-picker-order")?.addEventListener("change", (event) => {
  if (picker) picker.order = event.target.value;
});

document.getElementById("training-select-all")?.addEventListener("click", () => {
  if (!picker) return;
  picker[picker.tab] = catalogIds(picker.tab);
  picker.error = false;
  paintPicker();
});

document.getElementById("training-select-none")?.addEventListener("click", () => {
  if (!picker) return;
  picker[picker.tab] = [];
  paintPicker();
});

document.getElementById("training-picker-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  savePicker();
});
document.getElementById("training-picker-save")?.addEventListener("click", () => savePicker());
document.getElementById("training-picker-close")?.addEventListener("click", () => closePicker());
pickerDialog?.addEventListener("cancel", () => {
  picker = null;
});

clockBtn?.addEventListener("click", () => {
  onSpace();
  clockBtn.blur();
});

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  if (isTypingTarget(event.target) || pickerDialog?.open || view !== "session") return;
  event.preventDefault();
});

document.addEventListener("keyup", (event) => {
  if (event.repeat || event.code !== "Space") return;
  if (isTypingTarget(event.target) || pickerDialog?.open || view !== "session") return;
  event.preventDefault();
  onSpace();
});

window.addEventListener("hashchange", () => syncHash());

initSmartCube({
  timer: {
    onCubeFacelets,
    onCubeMove,
    onCubeRotation,
    onCubeGyro,
    onCubeGyroHome,
    setCubeConnected,
  },
});

paint();
syncHash();

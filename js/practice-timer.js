import {
  addCrossDrillTime,
  clearCrossDrillTimes,
  CROSS_DRILL_CHART_WINDOW_KEY,
  CROSS_DRILL_INSPECT_KEY,
  deleteCrossDrillTime,
  loadCrossDrillTimes,
  renderCrossTimesList,
} from "./cross-drill.js?v=cross1";
import { randomCrossCase, warmCrossSolver } from "./cross-solver.js?v=cross1";
import { applyMove, faceletsToString, randomScrambleMoves, stringToFacelets } from "./cube.js?v=timer4";
import {
  addPllTrainerTime,
  caseMark,
  caseSetupMoves,
  clearPllTrainerTimes,
  deletePllTrainerTime,
  listPllTrainerCases,
  loadPllSelection,
  loadPllTrainerTimes,
  pickTrainerCase,
  presetIds,
  renderPllCasePicker,
  renderPllCaseSummary,
  renderPllTimesList,
  renderTrainerCase,
  sameIdSet,
  savePllSelection,
  toggleSelectedId,
} from "./pll-case-trainer.js?v=pllreveal2";
import { faceletsForScramble, renderReconstruction } from "./cube-reconstruction.js?v=lllive1";
import { postSolveSummary, previewSolveRecord, renderPostSolveCard } from "./post-solve.js?v=lllive1";
import {
  describeBottleneck,
  effortStages,
  formatGoalSeconds,
  GOAL_SLOPE_SPAN,
  goalForecast,
  lastLayerSplit,
  LEVEL_WINDOW,
  loadAo100Goal,
  parseGoalInput,
  renderCoachFocus,
  renderCoachingDetail,
  renderEffort,
  renderLevelChip,
  saveAo100Goal,
  splitsForDisplay,
} from "./coaching-stats.js?v=lllive1";
import { cubeTimerDecision, cubeTimerGoalReached, formatMoveMeta, normalizeMoves } from "./move-log.js?v=lllive1";
import { formatSolvedAt, normalizeSplits, solveTimestamp, sortSolves } from "./solve-order.js?v=lllive1";
import { formatClock, splitStagesFromFacelets } from "./solve-timer.js?v=lllive1";

export const PRACTICE_TIMES_KEY = "cube-coach-practice-times";
export const PRACTICE_INSPECT_KEY = "cube-coach-practice-inspect";
export const PRACTICE_MODE_KEY = "cube-coach-practice-mode";
export const PRACTICE_CHART_WINDOW_KEY = "cube-coach-practice-chart-window";
export const PLL_INSPECT_KEY = "cube-coach-pll-trainer-inspect";
export const PLL_CHART_WINDOW_KEY = "cube-coach-pll-trainer-chart-window";
export const TIMER_MODE_SINGLE = "single";
export const TIMER_MODE_SPLITS = "splits";
export const TIMER_MODE_PLL = "pll";
export const TIMER_MODE_CROSS = "cross";
const TIMER_MODES = new Set([TIMER_MODE_SINGLE, TIMER_MODE_SPLITS, TIMER_MODE_PLL, TIMER_MODE_CROSS]);
export const SPLIT_BOUNCE_MS = 150;
/** Chart window sizes; 0 = all solves in the session. */
export const CHART_WINDOW_OPTIONS = [25, 50, 100, 0];
export const DEFAULT_CHART_WINDOW = 50;
/** csTimer-style session averages (WCA ao5 plus the usual longer windows). */
export const AVERAGE_WINDOWS = [5, 12, 25, 50, 100];
/**
 * Rolling windows for Cross, F2L, and Final.
 * Same trim as the full-solve averages: ao5/ao12 drop one each end, longer
 * windows drop 5% (ao24 drops two). "all" is the untrimmed mean of every stored split.
 */
export const SPLIT_AVERAGE_WINDOWS = [5, 12, 24, 50, 100];
/** Mean of 3 — no trim. The usual short-session companion to ao5. */
export const MEAN_WINDOWS = [3];
export const CHART_PAD = { t: 16, r: 12, b: 28, l: 44 };
export const DEFAULT_CHART_SIZE = { width: 420, height: 180 };
export const ENLARGED_CHART_SIZE = { width: 960, height: 440 };

export const SPLIT_STEPS = [
  { id: "cross", short: "Cross", title: "White cross" },
  { id: "f2l", short: "F2L", title: "F2L" },
  { id: "final", short: "Final", title: "Final" },
];

/** Shown instead of Final when the cube log supports an OLL/PLL split. */
export const LAST_LAYER_STEPS = [
  { id: "oll", short: "OLL", title: "OLL" },
  { id: "pll", short: "PLL", title: "PLL" },
];

/** 2-look OLL and 2-look PLL. Shown once each look has its own duration. */
export const LAYER_LOOK_STEPS = [
  { id: "yellowCross", short: "Y-cross", title: "Yellow cross" },
  { id: "ollLook", short: "OLL", title: "OLL" },
  { id: "headlights", short: "Headlights", title: "Headlights" },
  { id: "edges", short: "Edges", title: "Last edges" },
];

/** Live last-layer chips once F2L is marked on a smart-cube splits solve. */
const CUBE_LAYER_STEPS = [
  SPLIT_STEPS[0],
  SPLIT_STEPS[1],
  LAYER_LOOK_STEPS[0],
  LAYER_LOOK_STEPS[1],
  LAYER_LOOK_STEPS[2],
  LAYER_LOOK_STEPS[3],
];

const LAYER_IDS = ["yellowCross", "oll", "headlights"];

export function emptyLayerMarks() {
  return { yellowCross: null, oll: null, headlights: null };
}

/** A stored timestamp. Null stays null — `Number(null)` is 0 and would lock the look at the start. */
function finiteAt(value) {
  if (value == null || value === "") return null;
  const at = Number(value);
  return Number.isFinite(at) ? at : null;
}

/** First-occurrence last-layer timestamps. A later mark cannot precede an earlier one. */
export function copyLayerMarks(layer) {
  const out = emptyLayerMarks();
  if (!layer || typeof layer !== "object") return out;
  let floor = 0;
  for (const id of LAYER_IDS) {
    const at = finiteAt(layer[id]);
    if (at == null || at < floor) continue;
    out[id] = at;
    floor = at;
  }
  return out;
}

/**
 * Add the 2nd-look durations when a parent stage was split.
 * `oll` and `pll` stay the full stages. `ollLook` is yellow-face time after
 * the yellow cross. `edges` is PLL after headlights.
 */
export function decorateLayerSplits(splits) {
  if (!splits || typeof splits !== "object") return splits;
  const out = { ...splits };
  const oll = Number(out.oll);
  const pll = Number(out.pll);
  const yellowCross = Number(out.yellowCross);
  const headlights = Number(out.headlights);
  if (Number.isFinite(yellowCross) && Number.isFinite(oll) && yellowCross >= 0 && yellowCross <= oll) {
    out.ollLook = Math.max(0, Math.round(oll - yellowCross));
  }
  if (Number.isFinite(headlights) && Number.isFinite(pll) && headlights >= 0 && headlights <= pll) {
    out.edges = Math.max(0, Math.round(pll - headlights));
  }
  return out;
}

export function displaySplitSteps(splits) {
  const shown = decorateLayerSplits(splits);
  if (!(Number.isFinite(Number(shown?.oll)) && Number.isFinite(Number(shown?.pll)))) return SPLIT_STEPS;
  const steps = [SPLIT_STEPS[0], SPLIT_STEPS[1]];
  const yellowCross = Number(shown.yellowCross);
  const ollLook = Number(shown.ollLook);
  if (yellowCross > 0 && ollLook > 0) steps.push(LAYER_LOOK_STEPS[0], LAYER_LOOK_STEPS[1]);
  else steps.push(LAST_LAYER_STEPS[0]);
  const headlights = Number(shown.headlights);
  const edges = Number(shown.edges);
  if (headlights > 0 && edges > 0) steps.push(LAYER_LOOK_STEPS[2], LAYER_LOOK_STEPS[3]);
  else steps.push(LAST_LAYER_STEPS[1]);
  return steps;
}

function browserStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function memoryStore(seed = {}) {
  const data = { ...seed };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

function readJson(store, key, fallback) {
  try {
    const raw = store?.getItem?.(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadPracticeTimes(store = browserStore()) {
  const parsed = readJson(store, PRACTICE_TIMES_KEY, []);
  if (!Array.isArray(parsed)) return [];
  return sortSolves(parsed.map((row, i) => normalizeRecord(row, i)).filter(Boolean));
}

function normalizeRecord(row, index) {
  if (typeof row === "number" && Number.isFinite(row) && row >= 0) {
    return { id: `legacy-${index}`, ms: row, at: 0, scramble: "" };
  }
  if (!row || typeof row !== "object") return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const record = {
    id: String(row.id || `t-${index}-${ms}`),
    ms,
    at: Number(row.at) || 0,
    scramble: String(row.scramble || ""),
  };
  const splits = normalizeSplits(row.splits);
  if (splits) record.splits = splits;
  const moves = normalizeMoves(row.moves);
  if (moves) record.moves = moves;
  return record;
}

export function loadTimerMode(store = browserStore()) {
  const raw = store?.getItem?.(PRACTICE_MODE_KEY);
  return TIMER_MODES.has(raw) ? raw : TIMER_MODE_SINGLE;
}

export function saveTimerMode(mode, store = browserStore()) {
  const value = TIMER_MODES.has(mode) ? mode : TIMER_MODE_SINGLE;
  try {
    store?.setItem?.(PRACTICE_MODE_KEY, value);
  } catch {
    /* ignore */
  }
  return value;
}

/** Elapsed marks at Cross and F2L → per-stage durations including Final. */
export function splitDurationsFromMarks(marks, totalMs) {
  const total = Math.max(0, Number(totalMs) || 0);
  const cross = Math.max(0, Math.min(total, Number(marks?.[0]) || 0));
  const f2lDone = Math.max(cross, Math.min(total, Number(marks?.[1]) || cross));
  return {
    cross,
    f2l: Math.max(0, f2lDone - cross),
    final: Math.max(0, total - f2lDone),
  };
}

export function currentSplitIndex(marks = []) {
  return Math.min(SPLIT_STEPS.length - 1, Array.isArray(marks) ? marks.length : 0);
}

export function applySplitTap({ mode, marks = [], elapsed = 0, lastTapElapsed = 0, bounceMs = SPLIT_BOUNCE_MS } = {}) {
  if (elapsed - lastTapElapsed < bounceMs) return { action: "ignore", marks };
  if (mode === TIMER_MODE_SPLITS && marks.length < SPLIT_STEPS.length - 1) {
    return { action: "split", marks: [...marks, elapsed] };
  }
  return { action: "stop", marks };
}

const PAIR_IDS = ["FR", "BR", "BL", "FL"];

function copyPairs(pairs) {
  if (!Array.isArray(pairs)) return [];
  const out = [];
  const seen = new Set();
  for (const item of pairs) {
    const id = String(item?.id || "");
    const at = Number(item?.at);
    if (!PAIR_IDS.includes(id) || seen.has(id) || !Number.isFinite(at) || at < 0) continue;
    seen.add(id);
    out.push({ id, at });
  }
  return out;
}

/**
 * First time a last-layer look is true on an unsolved cube. Later looks that
 * are also true on this same state share the timestamp. A look already marked
 * stays put.
 */
function stampLayerMarks(layer, stages, at) {
  const next = { ...layer };
  let action = null;
  let floor = at;
  const flags = [
    ["yellowCross", stages.yellowCross],
    ["oll", stages.oll],
    ["headlights", stages.headlights],
  ];
  for (const [id, on] of flags) {
    if (next[id] != null) {
      floor = Math.max(floor, next[id]);
      continue;
    }
    if (!on) continue;
    next[id] = Math.max(at, floor);
    floor = next[id];
    action = id;
  }
  return { layer: next, action };
}

/**
 * Append Cross, F2L, per-slot, and last-layer marks from one cube state.
 * The first time a stage, pair, or look is complete wins. A later facelet —
 * including the solved cube — does not move that mark, and breaking the cross
 * does not either. Pairs count only while the white cross is intact, so a
 * mid-insert phantom slot is ignored. Yellow cross, OLL, and headlights are
 * stamped only while that look is true and the cube is still unsolved.
 * Pass the state after every move. Facelet packets often arrive only on a
 * pause, and the next one can be the solved cube.
 */
export function applyCubeSplitMarks({ mode, marks = [], pairs = [], layer = null, elapsed = 0, facelets = "" } = {}) {
  const current = Array.isArray(marks) ? marks.slice(0, SPLIT_STEPS.length - 1) : [];
  const currentPairs = copyPairs(pairs);
  const currentLayer = copyLayerMarks(layer);
  if (mode !== TIMER_MODE_SPLITS) return { action: "none", marks: current, pairs: currentPairs, layer: currentLayer };
  const stages = splitStagesFromFacelets(facelets);
  if (!stages.cross && !stages.f2l) return { action: "none", marks: current, pairs: currentPairs, layer: currentLayer };
  const at = Math.max(0, Number(elapsed) || 0);
  const next = current.slice();
  const nextPairs = currentPairs.slice();
  let nextLayer = currentLayer;
  let action = "none";
  if (next.length === 0 && stages.cross) {
    next.push(at);
    action = "cross";
  }
  if (next.length === 1 && stages.f2l) {
    next.push(Math.max(Number(next[0]) || 0, at));
    action = action === "cross" ? "both" : "f2l";
  }
  if (stages.cross) {
    const seen = new Set(nextPairs.map((pair) => pair.id));
    for (const id of stages.pairs) {
      if (!PAIR_IDS.includes(id) || seen.has(id)) continue;
      nextPairs.push({ id, at });
      seen.add(id);
      if (action === "none") action = "pairs";
    }
  }
  if (next.length >= 2 && stages.f2l) {
    const stamped = stampLayerMarks(nextLayer, stages, Math.max(at, Number(next[1]) || 0));
    nextLayer = stamped.layer;
    if (stamped.action && action === "none") action = stamped.action;
  }
  if (action === "none") return { action, marks: current, pairs: currentPairs, layer: currentLayer };
  return { action, marks: next, pairs: nextPairs, layer: nextLayer };
}

/** 54-letter coach facelets after one move. Unchanged when the move cannot be applied. */
export function applyMoveLetters(facelets, move) {
  const text = String(facelets || "");
  if (text.length !== 54 || !move) return text;
  try {
    const colors = stringToFacelets(text);
    if (colors.length !== 54 || colors.some((color) => !color)) return text;
    applyMove(colors, move);
    const next = faceletsToString(colors);
    return next.length === 54 ? next : text;
  } catch {
    return text;
  }
}

/** Live cube facelets, otherwise the scramble applied to a solved cube. */
export function seedSplitFacelets(facelets, scramble) {
  const text = String(facelets || "");
  if (text.length === 54) return text;
  return faceletsForScramble(scramble);
}

/**
 * One observation. `move` advances `facelets`; a facelet packet passes no move
 * and replaces the shadow with that packet.
 */
export function stepCubeSplit({
  facelets = "",
  move = "",
  marks = [],
  pairs = [],
  layer = null,
  elapsed = 0,
  mode = TIMER_MODE_SPLITS,
} = {}) {
  const next = move ? applyMoveLetters(facelets, move) : String(facelets || "");
  const result = applyCubeSplitMarks({ mode, marks, pairs, layer, elapsed, facelets: next });
  return { ...result, facelets: next };
}

/**
 * Replay moves and facelet packets in order.
 * A move is applied to the shadow cube so F2L is marked on the turn it finishes.
 * A later solved facelet confirms that state and does not restamp the mark.
 */
export function foldCubeSplitEvents(events, { seed = "", mode = TIMER_MODE_SPLITS } = {}) {
  let facelets = String(seed || "");
  let marks = [];
  let pairs = [];
  let layer = emptyLayerMarks();
  for (const event of events || []) {
    const stepped = event?.facelets
      ? stepCubeSplit({ facelets: event.facelets, marks, pairs, layer, elapsed: event.t, mode })
      : event?.move
        ? stepCubeSplit({ facelets, move: event.move, marks, pairs, layer, elapsed: event.t, mode })
        : null;
    if (!stepped) continue;
    facelets = stepped.facelets;
    marks = stepped.marks;
    pairs = stepped.pairs;
    layer = stepped.layer;
  }
  return { marks, pairs, layer, facelets };
}

/**
 * Cross / F2L / Final from the elapsed marks, plus OLL and PLL when the yellow
 * face was seen while the cube was still unsolved. Yellow cross and headlights
 * are the gaps inside those stages when each look was marked on its own.
 */
export function layerSplitsFromMarks(marks, layer, totalMs) {
  const base = splitDurationsFromMarks(marks, totalMs);
  if (!Array.isArray(marks) || marks.length < 2) return base;
  const total = Math.max(0, Number(totalMs) || 0);
  const f2lAt = base.cross + base.f2l;
  const copied = copyLayerMarks(layer);
  const ollAt = copied.oll;
  if (ollAt == null || ollAt < f2lAt || ollAt >= total) return base;
  const oll = Math.round(ollAt - f2lAt);
  const pll = Math.round(total - f2lAt) - oll;
  if (oll < 0 || pll <= 0) return base;
  const out = { ...base, oll, pll };
  if (copied.yellowCross != null && copied.yellowCross >= f2lAt && copied.yellowCross <= ollAt) {
    out.yellowCross = Math.round(copied.yellowCross - f2lAt);
  }
  if (copied.headlights != null && copied.headlights >= ollAt && copied.headlights < total) {
    out.headlights = Math.round(copied.headlights - ollAt);
  }
  return out;
}

export function liveSplitDurations(marks = [], elapsed = 0, { running = false, splits = null, layer = null } = {}) {
  if (splits) return { ...splits };
  const out = { cross: null, f2l: null, final: null };
  const crossMark = marks[0];
  const f2lMark = marks[1];
  if (crossMark != null) out.cross = Math.max(0, crossMark);
  else if (running) out.cross = Math.max(0, elapsed);

  if (f2lMark != null) out.f2l = Math.max(0, f2lMark - (crossMark || 0));
  else if (running && crossMark != null) out.f2l = Math.max(0, elapsed - crossMark);

  const tracked = layer && f2lMark != null;
  if (!tracked) {
    if (f2lMark != null && (running || elapsed >= f2lMark)) out.final = Math.max(0, elapsed - f2lMark);
    return out;
  }

  const yellowAt = finiteAt(layer.yellowCross);
  const ollAt = finiteAt(layer.oll);
  const headsAt = finiteAt(layer.headlights);
  if (yellowAt != null) out.yellowCross = Math.max(0, yellowAt - f2lMark);
  else if (running) out.yellowCross = Math.max(0, elapsed - f2lMark);

  if (ollAt != null) out.ollLook = Math.max(0, ollAt - (yellowAt != null ? yellowAt : ollAt));
  else if (running && yellowAt != null) out.ollLook = Math.max(0, elapsed - yellowAt);

  if (headsAt != null) out.headlights = Math.max(0, headsAt - (ollAt != null ? ollAt : headsAt));
  else if (running && ollAt != null) out.headlights = Math.max(0, elapsed - ollAt);

  if (headsAt != null && (running || elapsed >= headsAt)) out.edges = Math.max(0, elapsed - headsAt);
  return out;
}

function cubeLayerLiveIndex(marks, layer) {
  if (marks[0] == null) return 0;
  if (marks[1] == null) return 1;
  if (layer?.yellowCross == null) return 2;
  if (layer?.oll == null) return 3;
  if (layer?.headlights == null) return 4;
  return 5;
}

function splitChipClass(id) {
  if (id === "ollLook") return "oll";
  if (id === "edges") return "pll";
  return id;
}

export function isSessionBest(ms, best) {
  return Number.isFinite(ms) && ms > 0 && best != null && ms === best;
}

export function splitBests(splitStats) {
  return {
    cross: stageBest(splitStats, "cross"),
    f2l: stageBest(splitStats, "f2l"),
    final: stageBest(splitStats, "final"),
    oll: stageBest(splitStats, "oll"),
    pll: stageBest(splitStats, "pll"),
  };
}

export function renderPairMarks(pairs) {
  const list = copyPairs(pairs);
  if (!list.length) return "";
  const bits = list.map((pair) => `${escapeHtml(pair.id)} ${formatClock(pair.at)}`).join(" · ");
  return `<p class="timer-pair-marks"><span>Pairs</span> ${bits}</p>`;
}

export function renderLiveSplits({
  marks = [],
  elapsed = 0,
  running = false,
  splits = null,
  bests = null,
  pairs = null,
  layer = null,
} = {}) {
  const shownSplits = splits ? decorateLayerSplits(splits) : null;
  const durations = liveSplitDurations(marks, elapsed, { running, splits: shownSplits, layer });
  const tracking = Boolean(layer) && marks.length >= 2 && !shownSplits;
  const steps = shownSplits ? displaySplitSteps(shownSplits) : tracking ? CUBE_LAYER_STEPS : SPLIT_STEPS;
  const liveIndex = running ? (tracking ? cubeLayerLiveIndex(marks, layer) : currentSplitIndex(marks)) : -1;
  const stages = steps.map((step, i) => {
    const ms = durations[step.id];
    const isLive = i === liveIndex;
    const shown = ms != null ? formatClock(ms) : "—";
    const isBest = !running && isSessionBest(ms, bests?.[step.id]);
    const cls = [`split-${splitChipClass(step.id)}`, isLive ? "is-live" : "", !isLive && ms != null ? "is-done" : "", isBest ? "is-best" : ""]
      .filter(Boolean)
      .join(" ");
    return `<li class="${cls}"><span>${step.short}</span><strong>${shown}</strong></li>`;
  }).join("");
  const pairSource = pairs || splits?.pairs;
  const pairChips = copyPairs(pairSource)
    .map((pair) => `<li class="split-pair is-done"><span>${escapeHtml(pair.id)}</span><strong>${formatClock(pair.at)}</strong></li>`)
    .join("");
  return stages + pairChips;
}

export function savePracticeTimes(records, store = browserStore()) {
  const saved = sortSolves(records);
  try {
    store?.setItem?.(PRACTICE_TIMES_KEY, JSON.stringify(saved));
  } catch {
    /* quota / private mode */
  }
  return saved;
}

function newSolveId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `t-${Date.now().toString(36)}-${rand}`;
}

export function addPracticeTime(entry, store = browserStore()) {
  const records = loadPracticeTimes(store);
  const ms = Number(entry?.ms);
  if (!Number.isFinite(ms) || ms <= 0) return records;
  const atNumber = Number(entry?.at);
  const record = {
    id: String(entry?.id || newSolveId()),
    ms,
    at: Number.isFinite(atNumber) && atNumber > 0 ? Math.round(atNumber) : Date.now(),
    scramble: String(entry?.scramble || ""),
  };
  const splits = normalizeSplits(entry?.splits);
  if (splits) record.splits = splits;
  const moves = normalizeMoves(entry?.moves);
  if (moves) record.moves = moves;
  if (entry && typeof entry === "object") entry.id = record.id;
  records.push(record);
  return savePracticeTimes(records, store);
}

export function deletePracticeTime(id, store = browserStore()) {
  const records = loadPracticeTimes(store).filter((row) => row.id !== id);
  return savePracticeTimes(records, store);
}

export function clearPracticeTimes(store = browserStore()) {
  return savePracticeTimes([], store);
}

export function loadInspectionSeconds(store = browserStore(), key = PRACTICE_INSPECT_KEY) {
  const raw = store?.getItem?.(key);
  const n = Number(raw);
  return [0, 3, 5, 10, 15].includes(n) ? n : 0;
}

export function saveInspectionSeconds(seconds, store = browserStore(), key = PRACTICE_INSPECT_KEY) {
  const n = Number(seconds);
  const value = [0, 3, 5, 10, 15].includes(n) ? n : 0;
  try {
    store?.setItem?.(key, String(value));
  } catch {
    /* ignore */
  }
  return value;
}

export function loadChartWindow(store = browserStore(), key = PRACTICE_CHART_WINDOW_KEY) {
  const raw = store?.getItem?.(key);
  if (raw == null || raw === "") return DEFAULT_CHART_WINDOW;
  const n = Number(raw);
  return CHART_WINDOW_OPTIONS.includes(n) ? n : DEFAULT_CHART_WINDOW;
}

export function saveChartWindow(windowSize, store = browserStore(), key = PRACTICE_CHART_WINDOW_KEY) {
  const n = Number(windowSize);
  const value = CHART_WINDOW_OPTIONS.includes(n) ? n : DEFAULT_CHART_WINDOW;
  try {
    store?.setItem?.(key, String(value));
  } catch {
    /* ignore */
  }
  return value;
}

/** Keep the last `windowSize` records for the chart (0 / falsy = all). */
export function sliceChartRecords(records, windowSize = DEFAULT_CHART_WINDOW) {
  const list = Array.isArray(records) ? records : [];
  const n = Number(windowSize);
  if (!n || n <= 0 || list.length <= n) {
    return { records: list, startIndex: 0 };
  }
  return { records: list.slice(-n), startIndex: list.length - n };
}

export function generatePracticeScramble(moves = 20) {
  return randomScrambleMoves(moves);
}

const SCRAMBLE_TOKEN = /^[URFDLB](?:2'?|')?$/;

/**
 * A face-turn scramble, or "" when the text is not one.
 * Accepts the generator's notation plus a pasted line (case, primes, "Scramble:" label).
 */
export function normalizeScramble(text) {
  let raw = String(text ?? "")
    .replace(/[′’‘`]/g, "'")
    .replace(/[,;]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  raw = raw.replace(/^scramble\s*:\s*/i, "").trim();
  if (!raw) return "";
  const moves = [];
  for (const token of raw.split(" ")) {
    const move = token.toUpperCase();
    if (!SCRAMBLE_TOKEN.test(move)) return "";
    moves.push(move.endsWith("2'") ? `${move.slice(0, -2)}2` : move);
  }
  if (moves.length > 80) return "";
  return moves.join(" ");
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/** Mean of the last `n` values (mo3, session mean of a window). */
export function meanOf(values, n) {
  if (!Array.isArray(values) || values.length < n || n < 1) return null;
  return mean(values.slice(-n));
}

/**
 * Solves dropped from each end of an aoN.
 * Same 5% rule as csTimer: 1 for ao5/ao12, 2 for ao25, 3 for ao50, 5 for ao100.
 */
export function averageTrimCount(n) {
  const size = Number(n) || 0;
  if (size < 5) return 0;
  return Math.ceil(size / 20);
}

/** WCA/csTimer average: drop trim from each end, mean of the rest. Needs at least 5. */
export function averageOf(values, n) {
  if (!Array.isArray(values) || values.length < n || n < 5) return null;
  const window = values.slice(-n);
  const trim = averageTrimCount(n);
  if (trim * 2 >= n) return null;
  const sorted = [...window].sort((a, b) => a - b);
  return mean(sorted.slice(trim, n - trim));
}

export function rollingAverages(values, n) {
  return values.map((_, i) => (i + 1 < n ? null : averageOf(values.slice(0, i + 1), n)));
}

export function rollingMeans(values, n) {
  return values.map((_, i) => (i + 1 < n ? null : meanOf(values.slice(0, i + 1), n)));
}

export function bestOfRolling(series) {
  const nums = (series || []).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return Math.min(...nums);
}

function emptyWindowStats() {
  const out = {};
  for (const n of MEAN_WINDOWS) {
    out[`mo${n}`] = null;
    out[`bestMo${n}`] = null;
  }
  for (const n of AVERAGE_WINDOWS) {
    out[`ao${n}`] = null;
    out[`bestAo${n}`] = null;
  }
  return out;
}

function computeWindowStats(times) {
  const out = emptyWindowStats();
  for (const n of MEAN_WINDOWS) {
    const series = rollingMeans(times, n);
    out[`mo${n}`] = series[series.length - 1] ?? null;
    out[`bestMo${n}`] = bestOfRolling(series);
  }
  for (const n of AVERAGE_WINDOWS) {
    const series = rollingAverages(times, n);
    out[`ao${n}`] = series[series.length - 1] ?? null;
    out[`bestAo${n}`] = bestOfRolling(series);
  }
  return out;
}

/** Cumulative mean of a series, carrying the current mean across gaps. */
export function runningMean(series) {
  let sum = 0;
  let count = 0;
  return (series || []).map((ms) => {
    if (Number.isFinite(ms)) {
      sum += ms;
      count += 1;
    }
    return count ? sum / count : null;
  });
}

/** Stage durations for the chart. F2L is pair time only — it does not include Cross. */
export function splitStageTimes(splits) {
  if (!splits) return null;
  const cross = Number(splits.cross);
  const f2l = Number(splits.f2l);
  if (!Number.isFinite(cross) || cross < 0 || !Number.isFinite(f2l) || f2l < 0) return null;
  return { cross, f2l };
}

export function chartRows(records) {
  return (records || []).filter((row) => Number.isFinite(row?.ms) && row.ms > 0);
}

export function summarizeStage(values) {
  const times = (values || []).filter((ms) => Number.isFinite(ms) && ms >= 0);
  if (!times.length) return null;
  const sorted = [...times].sort((a, b) => a - b);
  return {
    count: times.length,
    mean: mean(times),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
  };
}

export function computeSplitStats(records) {
  const rows = (records || []).filter((r) => r?.splits);
  if (!rows.length) return null;
  const steps = [
    ...SPLIT_STEPS,
    ...LAST_LAYER_STEPS.filter((step) => rows.some((row) => Number.isFinite(Number(row.splits?.[step.id])))),
  ];
  const stages = steps.map((step) => {
    const summary = summarizeStage(rows.map((r) => r.splits[step.id]));
    if (!summary) return null;
    return { ...step, ...summary };
  }).filter(Boolean);
  if (!stages.length) return null;
  let slowest = stages[0];
  for (const stage of stages) {
    if (stage.mean > slowest.mean) slowest = stage;
  }
  return { count: rows.length, stages, slowestId: slowest.id };
}

/** Stored split durations for one stage, in session order. Solves without that split are skipped. */
export function stageSplitTimes(records, stageId) {
  const times = [];
  for (const row of records || []) {
    const ms = Number(row?.splits?.[stageId]);
    if (Number.isFinite(ms) && ms >= 0) times.push(ms);
  }
  return times;
}

/** Current ao windows plus the mean of every stored time. Short windows stay null until they fill. */
export function computeStageAverages(times) {
  const values = (times || []).filter((ms) => Number.isFinite(ms) && ms >= 0);
  const out = { all: values.length ? mean(values) : null };
  for (const n of SPLIT_AVERAGE_WINDOWS) {
    out[`ao${n}`] = averageOf(values, n);
  }
  return out;
}

export function computeSplitAverages(records) {
  const out = {};
  for (const step of [...SPLIT_STEPS, ...LAST_LAYER_STEPS]) {
    out[step.id] = computeStageAverages(stageSplitTimes(records, step.id));
  }
  return out;
}

/** ao100 and all-time mean for each stage, for the bottleneck line. */
export function stageReferences(records) {
  const out = {};
  for (const step of [...SPLIT_STEPS, ...LAST_LAYER_STEPS]) {
    const times = stageSplitTimes(records, step.id);
    const averages = computeStageAverages(times);
    out[step.id] = { ao100: averages.ao100, mean: averages.all, count: times.length };
  }
  return out;
}

/** Gap from the current ao100 to a target, plus a rough ETA from the last 20 ao100s. */
export function ao100Outlook(records, targetMs, span = GOAL_SLOPE_SPAN) {
  const times = sortSolves(records)
    .map((row) => row.ms)
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  const ao100 = averageOf(times, LEVEL_WINDOW);
  const series = rollingAverages(times, LEVEL_WINDOW);
  const idx = series.length - 1;
  const prior = idx >= span && Number.isFinite(series[idx - span]) ? series[idx - span] : null;
  return goalForecast({
    ao100,
    priorAo100: prior,
    span: prior == null ? 0 : span,
    targetMs,
    count: times.length,
  });
}

/** Asia/Hong_Kong is UTC+8 all year, so day windows must not follow the browser zone. */
export const HONG_KONG_TIME_ZONE = "Asia/Hong_Kong";
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Six calendar windows, left to right under ao5–all.
 * Today, yesterday, last 7 days, and last 30 days are Hong Kong dates
 * (the multi-day windows include today). This week is Monday 00:00 through
 * the next Monday 00:00 in Asia/Hong_Kong.
 */
export const PERIOD_COLUMNS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "thisWeek", label: "This week", detail: "Mon–Sun", title: "This week (Mon–Sun, Asia/Hong_Kong)" },
  { id: "last30", label: "Last 30 days" },
  { id: "all", label: "All-time" },
];

function hongKongParts(ms) {
  const shifted = new Date(Number(ms) + HKT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  };
}

/** UTC timestamp of 00:00 Asia/Hong_Kong on the Hong Kong calendar day containing `ms`. */
export function hongKongMidnight(ms) {
  const { year, month, day } = hongKongParts(ms);
  return Date.UTC(year, month, day) - HKT_OFFSET_MS;
}

export function periodBounds(now = Date.now()) {
  const todayStart = hongKongMidnight(now);
  const tomorrow = todayStart + DAY_MS;
  const weekday = hongKongParts(now).weekday;
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  const weekStart = todayStart - daysSinceMonday * DAY_MS;
  return {
    today: [todayStart, tomorrow],
    yesterday: [todayStart - DAY_MS, todayStart],
    last7: [todayStart - 6 * DAY_MS, tomorrow],
    thisWeek: [weekStart, weekStart + 7 * DAY_MS],
    last30: [todayStart - 29 * DAY_MS, tomorrow],
  };
}

function solveInPeriod(record, bounds) {
  const at = solveTimestamp(record);
  return at >= bounds[0] && at < bounds[1];
}

/** Today's tax needs a few cube solves before one pause becomes the story. */
export const SESSION_CUBE_MIN = 3;

const TAX_RANK = { cross: 0, f2l: 1, oll: 2, pll: 3, final: 4, solve: 5 };

function addTax(buckets, stage, kind, ms) {
  const amount = Math.round(Number(ms) || 0);
  if (amount <= 0) return;
  const key = `${kind}:${stage.id}`;
  const prev = buckets.get(key);
  if (prev) prev.ms += amount;
  else {
    buckets.set(key, {
      id: stage.id,
      short: stage.short,
      kind,
      ms: amount,
      rank: TAX_RANK[stage.id] ?? 9,
    });
  }
}

/**
 * The largest pause or turning bucket among today's smart-cube solves.
 * Stages come from marks already on the solve. A log with no stage marks
 * counts as pause or turning, without a phase name.
 * Null until SESSION_CUBE_MIN cube solves exist today (Asia/Hong_Kong).
 */
export function sessionMainTax(records, now = Date.now()) {
  const today = periodBounds(now).today;
  const cube = [];
  for (const row of sortSolves(records)) {
    if (!solveInPeriod(row, today)) continue;
    if (!normalizeMoves(row?.moves)) continue;
    cube.push(row);
  }
  if (cube.length < SESSION_CUBE_MIN) return null;
  const buckets = new Map();
  for (const row of cube) {
    for (const stage of effortStages(row)) {
      addTax(buckets, stage, "pause", stage.pause);
      addTax(buckets, stage, "turning", stage.turning);
    }
  }
  if (!buckets.size) return null;
  const best = [...buckets.values()].sort((a, b) => {
    if (b.ms !== a.ms) return b.ms - a.ms;
    if (a.kind !== b.kind) return a.kind === "pause" ? -1 : 1;
    return a.rank - b.rank;
  })[0];
  if (!(best.ms > 0)) return null;
  const noun = best.kind === "pause" ? "pauses" : "turning";
  const where = best.id === "solve" ? noun : `${noun} in ${best.short}`;
  const solves = `${cube.length} cube solve${cube.length === 1 ? "" : "s"}`;
  return {
    id: best.id,
    kind: best.kind,
    ms: best.ms,
    count: cube.length,
    text: `Today's main tax: ${where} (${formatClock(best.ms)} across ${solves})`,
  };
}

/**
 * Mean stage time in each Hong Kong period.
 * Uses the same per-stage split filter as the ao table: a finite split counts,
 * solves without that split do not. All-time is every stored split, including
 * rows with no timestamp. Empty windows are null.
 */
export function computePeriodMeans(records, now = Date.now()) {
  const bounds = periodBounds(now);
  const out = {};
  for (const step of SPLIT_STEPS) {
    const stageRows = [];
    for (const row of records || []) {
      const ms = Number(row?.splits?.[step.id]);
      if (Number.isFinite(ms) && ms >= 0) stageRows.push(row);
    }
    const means = {};
    for (const col of PERIOD_COLUMNS) {
      const windowRows = col.id === "all" ? stageRows : stageRows.filter((row) => solveInPeriod(row, bounds[col.id]));
      const times = windowRows.map((row) => Number(row.splits[step.id]));
      means[col.id] = times.length ? mean(times) : null;
    }
    out[step.id] = means;
  }
  return out;
}

export function computeStats(records, now = Date.now()) {
  const ordered = sortSolves(records).filter((row) => row && typeof row === "object");
  const times = ordered.map((r) => r.ms).filter((ms) => Number.isFinite(ms) && ms > 0);
  const splitAverages = computeSplitAverages(ordered);
  const periodMeans = computePeriodMeans(ordered, now);
  const empty = {
    count: 0,
    mean: null,
    best: null,
    worst: null,
    trimmed: null,
    last100: [],
    ...emptyWindowStats(),
    splits: null,
    splitAverages,
    periodMeans,
  };
  if (!times.length) return { ...empty, splits: computeSplitStats(ordered) };

  const sorted = [...times].sort((a, b) => a - b);
  return {
    count: times.length,
    mean: mean(times),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    trimmed: times.length >= 3 ? mean(sorted.slice(1, -1)) : null,
    last100: times.slice(-LEVEL_WINDOW),
    ...computeWindowStats(times),
    splits: computeSplitStats(ordered),
    splitAverages,
    periodMeans,
  };
}

export function stageStat(splitStats, id, field = "best") {
  const value = splitStats?.stages?.find((stage) => stage.id === id)?.[field];
  return Number.isFinite(value) ? value : null;
}

export function stageBest(splitStats, id) {
  return stageStat(splitStats, id, "best");
}

export function stageMean(splitStats, id) {
  return stageStat(splitStats, id, "mean");
}

export function nearestChartIndex(x, { width, count, pad = CHART_PAD } = {}) {
  const n = Number(count) || 0;
  if (n <= 1) return 0;
  const innerW = Math.max(1, width - pad.l - pad.r);
  const t = (Number(x) - pad.l) / innerW;
  return Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))));
}

export function svgPointFromEvent(event, svg) {
  const rect = svg.getBoundingClientRect();
  const viewBox = svg.viewBox?.baseVal;
  const vbW = viewBox?.width || Number(svg.dataset.width) || rect.width || 1;
  const vbH = viewBox?.height || Number(svg.dataset.height) || rect.height || 1;
  const w = rect.width || 1;
  const h = rect.height || 1;
  return {
    x: ((event.clientX - rect.left) / w) * vbW,
    y: ((event.clientY - rect.top) / h) * vbH,
  };
}

export function renderChartTooltip(point) {
  if (!point) return "";
  const row = (label, value, extra = "") =>
    value
      ? `<div class="timer-chart-tip-row${extra ? ` ${extra}` : ""}"><span>${label}</span><strong>${value}</strong></div>`
      : "";
  return `<div class="timer-chart-tip-solve">Solve ${point.n}</div>
    ${row("Single", point.single)}
    ${row("Cross", point.cross, "tip-cross")}
    ${row("F2L", point.f2l, "tip-f2l")}
    ${row("Cross avg", point.crossAvg, "tip-cross")}
    ${row("F2L avg", point.f2lAvg, "tip-f2l")}
    ${AVERAGE_WINDOWS.map((n) => row(`ao${n}`, point[`ao${n}`])).join("")}`;
}

export function bindChartInteract(root) {
  if (!root) return () => {};
  const frame = root.querySelector(".timer-chart-frame") || root;
  const svg = root.querySelector(".timer-chart-svg");
  const tooltip = root.querySelector(".timer-chart-tooltip");
  const dataEl = root.querySelector(".timer-chart-data");
  const hover = root.querySelector(".timer-chart-hover");
  const guide = root.querySelector(".timer-chart-guide");
  const markSingle = root.querySelector(".timer-chart-hover-single");
  const markCross = root.querySelector(".timer-chart-hover-cross");
  const markF2l = root.querySelector(".timer-chart-hover-f2l");
  if (!svg || !tooltip || !dataEl) return () => {};

  let points = [];
  try {
    points = JSON.parse(dataEl.textContent || "[]");
  } catch {
    points = [];
  }
  if (points.length < 2) return () => {};

  const width = Number(svg.dataset.width) || DEFAULT_CHART_SIZE.width;
  const pad = {
    t: Number(svg.dataset.padT) || CHART_PAD.t,
    r: Number(svg.dataset.padR) || CHART_PAD.r,
    b: Number(svg.dataset.padB) || CHART_PAD.b,
    l: Number(svg.dataset.padL) || CHART_PAD.l,
  };
  const plotTop = pad.t;
  const plotBottom = (Number(svg.dataset.height) || DEFAULT_CHART_SIZE.height) - pad.b;
  let active = -1;

  function hide() {
    active = -1;
    tooltip.hidden = true;
    tooltip.innerHTML = "";
    if (hover) hover.setAttribute("opacity", "0");
  }

  function placeTooltip(point) {
    const svgRect = svg.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scaleX = svgRect.width / (width || 1);
    const scaleY = svgRect.height / (Number(svg.dataset.height) || 1);
    const tipW = tooltip.offsetWidth || 148;
    const tipH = tooltip.offsetHeight || 88;
    let left = svgRect.left - frameRect.left + point.x * scaleX + 14;
    let top = svgRect.top - frameRect.top + point.y * scaleY - tipH - 8;
    if (left + tipW > frameRect.width - 8) left = left - tipW - 28;
    if (left < 8) left = 8;
    if (top < 8) top = svgRect.top - frameRect.top + point.y * scaleY + 16;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function show(index) {
    const point = points[index];
    if (!point) return;
    active = index;
    tooltip.hidden = false;
    tooltip.innerHTML = renderChartTooltip(point);
    placeTooltip(point);
    if (hover) hover.setAttribute("opacity", "1");
    if (guide) {
      guide.setAttribute("x1", point.x.toFixed(1));
      guide.setAttribute("x2", point.x.toFixed(1));
      guide.setAttribute("y1", String(plotTop));
      guide.setAttribute("y2", String(plotBottom));
    }
    if (markSingle) {
      markSingle.setAttribute("cx", point.x.toFixed(1));
      markSingle.setAttribute("cy", point.y.toFixed(1));
    }
    if (markCross) {
      markCross.setAttribute("opacity", point.yCross == null ? "0" : "1");
      if (point.yCross != null) {
        markCross.setAttribute("cx", point.x.toFixed(1));
        markCross.setAttribute("cy", Number(point.yCross).toFixed(1));
      }
    }
    if (markF2l) {
      markF2l.setAttribute("opacity", point.yF2l == null ? "0" : "1");
      if (point.yF2l != null) {
        markF2l.setAttribute("cx", point.x.toFixed(1));
        markF2l.setAttribute("cy", Number(point.yF2l).toFixed(1));
      }
    }
  }

  function fromEvent(event) {
    const pt = svgPointFromEvent(event, svg);
    show(nearestChartIndex(pt.x, { width, count: points.length, pad }));
  }

  svg.addEventListener("pointermove", fromEvent);
  svg.addEventListener("pointerdown", fromEvent);
  svg.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "touch" && active >= 0) return;
    hide();
  });

  return hide;
}

export function renderProgressChart(records, { width, height, windowSize = DEFAULT_CHART_WINDOW, enlarged = false, emptyLabel = "" } = {}) {
  const all = sortSolves(records);
  const { records: windowed, startIndex } = sliceChartRecords(all, windowSize);
  const rows = chartRows(windowed);
  const times = rows.map((row) => row.ms);
  if (times.length < 2) {
    const copy =
      emptyLabel || "Solve twice and a progress chart appears here — singles, ao5–ao100, and Cross / F2L times.";
    return `<div class="timer-chart-empty">${copy}</div>`;
  }

  const size = enlarged ? ENLARGED_CHART_SIZE : DEFAULT_CHART_SIZE;
  width = Number(width) || size.width;
  height = Number(height) || size.height;

  const crossTimes = rows.map((row) => splitStageTimes(row.splits)?.cross ?? null);
  const f2lTimes = rows.map((row) => splitStageTimes(row.splits)?.f2l ?? null);
  const hasSplitSeries = crossTimes.some((ms) => ms != null) || f2lTimes.some((ms) => ms != null);

  const pad = CHART_PAD;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const aoSeries = Object.fromEntries(AVERAGE_WINDOWS.map((n) => [n, rollingAverages(times, n)]));
  const showSplitAverages = Boolean(enlarged && hasSplitSeries);
  const crossAvg = showSplitAverages ? runningMean(crossTimes) : [];
  const f2lAvg = showSplitAverages ? runningMean(f2lTimes) : [];
  const plotted = times.concat(
    AVERAGE_WINDOWS.flatMap((n) => aoSeries[n].filter((ms) => ms != null)),
    crossTimes.filter((n) => n != null),
    f2lTimes.filter((n) => n != null),
    crossAvg.filter((n) => n != null),
    f2lAvg.filter((n) => n != null)
  );
  const min = Math.min(...plotted);
  const max = Math.max(...plotted);
  const span = Math.max(50, max - min);
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const range = hi - lo || 1;
  const firstSolve = startIndex + 1;
  const lastSolve = startIndex + times.length;
  const showDots = enlarged || times.length <= 60;
  const dotR = enlarged ? (times.length > 80 ? 2.2 : 3.2) : 2.6;

  const xAt = (i) => pad.l + (times.length === 1 ? innerW / 2 : (i / (times.length - 1)) * innerW);
  const yAt = (ms) => pad.t + (1 - (ms - lo) / range) * innerH;

  const line = (series) => {
    const parts = [];
    series.forEach((ms, i) => {
      if (ms == null) return;
      const cmd = parts.length ? "L" : "M";
      parts.push(`${cmd} ${xAt(i).toFixed(1)} ${yAt(ms).toFixed(1)}`);
    });
    return parts.join(" ");
  };

  const ticks = enlarged ? 5 : 3;
  const grid = [];
  for (let t = 0; t <= ticks; t++) {
    const ms = lo + (range * t) / ticks;
    const y = yAt(ms);
    grid.push(
      `<line class="timer-chart-grid" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${width - pad.r}" y2="${y.toFixed(1)}" />` +
        `<text class="timer-chart-label" x="${pad.l - 8}" y="${y.toFixed(1)}" dy="0.35em">${formatClock(ms)}</text>`
    );
  }

  const seriesDots = (series, className, label) =>
    !showDots
      ? ""
      : series
          .map((ms, i) => {
            if (ms == null) return "";
            return `<circle class="${className}" cx="${xAt(i).toFixed(1)}" cy="${yAt(ms).toFixed(1)}" r="${dotR}"><title>Solve ${startIndex + i + 1} ${label}: ${formatClock(ms)}</title></circle>`;
          })
          .join("");

  const dots = seriesDots(times, "timer-chart-dot", "single");
  const crossDots = seriesDots(crossTimes, "timer-chart-dot-cross", "Cross");
  const f2lDots = seriesDots(f2lTimes, "timer-chart-dot-f2l", "F2L");

  const aoPaths = Object.fromEntries(AVERAGE_WINDOWS.map((n) => [n, line(aoSeries[n])]));
  const crossPath = line(crossTimes);
  const f2lPath = line(f2lTimes);
  const crossAvgPath = showSplitAverages ? line(crossAvg) : "";
  const f2lAvgPath = showSplitAverages ? line(f2lAvg) : "";
  const windowNote =
    windowSize > 0 && all.length > times.length
      ? ` · last ${times.length} of ${all.length}`
      : "";
  const aria = hasSplitSeries
    ? showSplitAverages
      ? `Solve times over session, with Cross and F2L times and averages${windowNote}`
      : `Solve times over session, with Cross and F2L times${windowNote}`
    : `Solve times over session${windowNote}`;

  const splitLegend = hasSplitSeries
    ? `<li><span class="swatch swatch-cross"></span>Cross</li>
    <li><span class="swatch swatch-f2l"></span>F2L</li>${
      showSplitAverages
        ? `
    <li><span class="swatch swatch-cross-avg"></span>Cross avg</li>
    <li><span class="swatch swatch-f2l-avg"></span>F2L avg</li>`
        : ""
    }`
    : "";

  const points = times.map((ms, i) => ({
    n: startIndex + i + 1,
    single: formatClock(ms),
    cross: crossTimes[i] != null ? formatClock(crossTimes[i]) : null,
    f2l: f2lTimes[i] != null ? formatClock(f2lTimes[i]) : null,
    ...Object.fromEntries(
      AVERAGE_WINDOWS.map((n) => [
        `ao${n}`,
        aoSeries[n][i] != null ? formatClock(aoSeries[n][i]) : null,
      ])
    ),
    crossAvg: showSplitAverages && crossAvg[i] != null ? formatClock(crossAvg[i]) : null,
    f2lAvg: showSplitAverages && f2lAvg[i] != null ? formatClock(f2lAvg[i]) : null,
    x: Number(xAt(i).toFixed(1)),
    y: Number(yAt(ms).toFixed(1)),
    yCross: crossTimes[i] != null ? Number(yAt(crossTimes[i]).toFixed(1)) : null,
    yF2l: f2lTimes[i] != null ? Number(yAt(f2lTimes[i]).toFixed(1)) : null,
  }));

  const enlargeBtn = enlarged
    ? ""
    : `<button type="button" class="btn btn-ghost btn-small timer-chart-enlarge" data-enlarge-chart aria-haspopup="dialog" aria-controls="timer-chart-dialog">Enlarge</button>`;

  return `<div class="timer-chart-frame${enlarged ? " is-enlarged" : ""}">
    ${enlargeBtn}
    <svg class="timer-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}" data-width="${width}" data-height="${height}" data-pad-t="${pad.t}" data-pad-r="${pad.r}" data-pad-b="${pad.b}" data-pad-l="${pad.l}">
    ${grid.join("")}
    <path class="timer-chart-singles" d="${line(times)}" fill="none" />
    ${AVERAGE_WINDOWS.map((n) =>
      aoPaths[n] ? `<path class="timer-chart-ao${n}" d="${aoPaths[n]}" fill="none" />` : ""
    ).join("")}
    ${crossPath ? `<path class="timer-chart-cross" d="${crossPath}" fill="none" />` : ""}
    ${f2lPath ? `<path class="timer-chart-f2l" d="${f2lPath}" fill="none" />` : ""}
    ${crossAvgPath ? `<path class="timer-chart-cross-avg" d="${crossAvgPath}" fill="none" />` : ""}
    ${f2lAvgPath ? `<path class="timer-chart-f2l-avg" d="${f2lAvgPath}" fill="none" />` : ""}
    ${dots}
    ${crossDots}
    ${f2lDots}
    <g class="timer-chart-hover" opacity="0" pointer-events="none">
      <line class="timer-chart-guide" x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${height - pad.b}" />
      <circle class="timer-chart-hover-single" r="${enlarged ? 5.5 : 4.2}" cx="0" cy="0" />
      <circle class="timer-chart-hover-cross" r="${enlarged ? 4.5 : 3.6}" cx="0" cy="0" opacity="0" />
      <circle class="timer-chart-hover-f2l" r="${enlarged ? 4.5 : 3.6}" cx="0" cy="0" opacity="0" />
    </g>
    <text class="timer-chart-axis" x="${pad.l}" y="${height - 8}">${firstSolve}</text>
    <text class="timer-chart-axis timer-chart-axis-end" x="${width - pad.r}" y="${height - 8}">${lastSolve}</text>
  </svg>
    <div class="timer-chart-tooltip" hidden></div>
    <div class="timer-chart-data" hidden>${escapeHtml(JSON.stringify(points))}</div>
  <ul class="timer-chart-legend">
    <li><span class="swatch swatch-single"></span>Single</li>
    ${AVERAGE_WINDOWS.map((n) => `<li><span class="swatch swatch-ao${n}"></span>ao${n}</li>`).join("")}
    ${splitLegend}
  </ul>
  </div>`;
}

function dash(ms) {
  return ms == null ? "—" : formatClock(ms);
}

/** How far an average moved. Positive is slower. Sub-centisecond gaps read as even. */
export function formatSignedDelta(ms, subject = "Average") {
  if (ms == null || ms === "") return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  const abs = formatClock(Math.abs(n));
  if (abs === "0.00") {
    return { text: "+0.00", tone: "even", label: `${subject} did not move` };
  }
  if (n > 0) {
    return { text: `+${abs}`, tone: "slower", label: `${subject} moved ${abs} slower` };
  }
  return { text: `-${abs}`, tone: "faster", label: `${subject} moved ${abs} faster` };
}

/** Change in an average after the latest solve. Null when either side is missing. */
export function averageShift(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return current - previous;
}

function renderAvgDelta(ms, subject) {
  const delta = formatSignedDelta(ms, subject);
  if (!delta) return "";
  return `<span class="timer-avg-delta is-${delta.tone}" title="${escapeHtml(delta.label)}">${delta.text}</span>`;
}

export function formatTimerParts(ms) {
  const clamped = Math.max(0, Number(ms) || 0);
  const cs = Math.floor(clamped / 10);
  const centi = String(cs % 100).padStart(2, "0");
  const totalSec = Math.floor(cs / 100);
  const s = String(totalSec % 60).padStart(2, "0");
  const m = String(Math.floor(totalSec / 60));
  return { m, s, centi };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderTimesList(records) {
  const ordered = sortSolves(records);
  if (!ordered.length) {
    return `<p class="timer-times-empty">Your solve times will appear here</p>`;
  }
  const stats = computeStats(ordered);
  const best = stats.best;
  const stageBests = splitBests(stats.splits);
  const items = [...ordered]
    .reverse()
    .map((row, i) => {
      const scramble = row.scramble
        ? `<code class="timer-time-scramble">${escapeHtml(row.scramble)}</code>`
        : "";
      const shown = decorateLayerSplits(splitsForDisplay(row));
      const steps = displaySplitSteps(shown);
      const splits = shown
        ? `<div class="timer-time-splits">${steps.map((step) => {
            const bestCls = isSessionBest(shown[step.id], stageBests[step.id]) ? " is-best" : "";
            return `<span class="split-${splitChipClass(step.id)}${bestCls}"><em>${step.short}</em> ${formatClock(shown[step.id])}</span>`;
          }).join("")}</div>${renderPairMarks(shown.pairs)}`
        : "";
      const moveMeta = formatMoveMeta(row.moves, row.ms);
      const moveHtml = moveMeta ? `<p class="timer-time-moves">${escapeHtml(moveMeta)}</p>` : "";
      const effort = renderEffort(row);
      const reconstruction = renderReconstruction(row.moves, shown, row.ms);
      const when = formatSolvedAt(row.at);
      const whenHtml = when
        ? `<time class="timer-time-when" datetime="${escapeHtml(new Date(row.at).toISOString())}">${escapeHtml(when)}</time>`
        : "";
      const bestCls = isSessionBest(row.ms, best) ? " is-best" : "";
      const deleteBtn = `<button type="button" class="timer-time-delete" data-delete="${escapeHtml(row.id)}" aria-label="Delete ${formatClock(row.ms)}">×</button>`;
      const body = `<div class="timer-time-row">
          <span class="timer-time-index">#${ordered.length - i}</span>
          <span class="timer-time-ms${bestCls}">${formatClock(row.ms)}${whenHtml}</span>
          ${row.scramble ? "" : deleteBtn}
        </div>
        ${moveHtml}
        ${splits}
        ${effort}
        ${scramble}`;
      if (!row.scramble) {
        return `<li data-id="${escapeHtml(row.id)}">${body}${reconstruction}</li>`;
      }
      const label = `Load scramble for ${formatClock(row.ms)}`;
      return `<li class="timer-time-item" data-id="${escapeHtml(row.id)}">
        <div class="timer-time-load" role="button" tabindex="0" data-load-scramble="${escapeHtml(row.id)}" title="Time this scramble again" aria-label="${escapeHtml(label)}">${body}</div>
        ${reconstruction}
        ${deleteBtn}
      </li>`;
    })
    .join("");
  const hint = ordered.some((row) => row.scramble)
    ? `<p class="timer-times-hint">Tap a time to run that scramble</p>`
    : "";
  return `${hint}<ol class="timer-times-list">${items}</ol>`;
}

export function renderStats(stats, previous = null, { splitShift = false, stages = true, goalMs = null, outlook = null, session = null } = {}) {
  const crossNow = stageMean(stats.splits, "cross");
  const f2lNow = stageMean(stats.splits, "f2l");
  const finalNow = stageMean(stats.splits, "final");
  const crossDelta = splitShift ? renderAvgDelta(averageShift(crossNow, stageMean(previous?.splits, "cross")), "Cross avg") : "";
  const f2lDelta = splitShift ? renderAvgDelta(averageShift(f2lNow, stageMean(previous?.splits, "f2l")), "F2L avg") : "";
  const finalDelta = splitShift ? renderAvgDelta(averageShift(finalNow, stageMean(previous?.splits, "final")), "Final avg") : "";
  const meanLabel = stages ? "All-time mean" : "Average";
  const meanDelta = renderAvgDelta(averageShift(stats.mean, previous?.mean), meanLabel);
  const rows = [
    ["Solves", String(stats.count || 0), "", ""],
    [meanLabel, dash(stats.mean), "", meanDelta],
    ["Best", dash(stats.best), "timer-stat-best", ""],
    ["Worst", dash(stats.worst), "", ""],
    // Two-column grid: each stage is one row, avg left and best right.
    ...(stages
      ? [
          ["Cross avg", dash(crossNow), "timer-stat-cross", crossDelta],
          ["Cross best", dash(stageBest(stats.splits, "cross")), "timer-stat-cross", ""],
          ["F2L avg", dash(f2lNow), "timer-stat-f2l", f2lDelta],
          ["F2L best", dash(stageBest(stats.splits, "f2l")), "timer-stat-f2l", ""],
          ["Final avg", dash(finalNow), "timer-stat-final", finalDelta],
          ["Final best", dash(stageBest(stats.splits, "final")), "timer-stat-final", ""],
        ]
      : []),
    ["Trimmed", dash(stats.trimmed), "", ""],
  ];
  const cards = rows
    .map(
      ([label, value, extra, delta]) => `<div class="timer-stat${extra ? ` ${extra}` : ""}">
        <span>${label}</span>
        <strong>${value}${delta}</strong>
      </div>`
    )
    .join("");
  const level = stages ? renderCoachingDetail({ stats, goalMs, outlook, session }) : "";
  return `${level}${cards}${renderAverageTable(stats, previous, { splits: stages })}`;
}

const SPLIT_AVERAGE_COLUMNS = [...SPLIT_AVERAGE_WINDOWS.map((n) => `ao${n}`), "all"];

function splitAverageColgroup() {
  return `<colgroup><col class="timer-split-label-col" /><col span="6" /></colgroup>`;
}

function renderSplitAverageTable(splitAverages) {
  const head = SPLIT_AVERAGE_COLUMNS.map((col) => `<th scope="col">${col}</th>`).join("");
  const steps = [
    ...SPLIT_STEPS,
    ...LAST_LAYER_STEPS.filter((step) => Number.isFinite(splitAverages?.[step.id]?.all)),
  ];
  const body = steps.map((step) => {
    const row = splitAverages?.[step.id] || {};
    const cells = SPLIT_AVERAGE_COLUMNS.map(
      (col) => `<td data-split-window="${col}">${dash(row[col])}</td>`
    ).join("");
    return `<tr data-split-avg="${step.id}">
        <th scope="row" class="timer-split-avg-label timer-split-avg-label-${step.id}">${step.short}</th>
        ${cells}
      </tr>`;
  }).join("");
  return `<table class="timer-averages timer-split-averages">
      ${splitAverageColgroup()}
      <thead>
        <tr>
          <th scope="col"></th>
          ${head}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function renderPeriodHeader(col) {
  const title = col.title || col.detail;
  const titleAttr = title ? ` title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"` : "";
  const detail = col.detail ? `<span class="timer-period-sub">${escapeHtml(col.detail)}</span>` : "";
  return `<th scope="col"${titleAttr}>${escapeHtml(col.label)}${detail}</th>`;
}

function renderPeriodAverageTable(periodMeans) {
  const head = PERIOD_COLUMNS.map((col) => renderPeriodHeader(col)).join("");
  const body = SPLIT_STEPS.map((step) => {
    const row = periodMeans?.[step.id] || {};
    const cells = PERIOD_COLUMNS.map(
      (col) => `<td data-period-window="${col.id}">${dash(row[col.id])}</td>`
    ).join("");
    return `<tr data-period-avg="${step.id}">
        <th scope="row" class="timer-split-avg-label timer-split-avg-label-${step.id}">${step.short}</th>
        ${cells}
      </tr>`;
  }).join("");
  return `<div class="timer-period-averages-block">
    <table class="timer-averages timer-split-averages timer-period-averages">
      ${splitAverageColgroup()}
      <caption>Period means <span class="timer-period-caption-note">Asia/Hong_Kong</span></caption>
      <thead>
        <tr>
          <th scope="col"></th>
          ${head}
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

export function renderAverageTable(stats, previous = null, { splits = true } = {}) {
  const metrics = [
    ...MEAN_WINDOWS.map((n) => [`mo${n}`, stats[`mo${n}`], stats[`bestMo${n}`]]),
    ...AVERAGE_WINDOWS.map((n) => [`ao${n}`, stats[`ao${n}`], stats[`bestAo${n}`]]),
  ];
  const body = metrics
    .map(([label, current, best]) => {
      const delta = renderAvgDelta(averageShift(current, previous?.[label]), label);
      return `<tr>
        <th scope="row" class="timer-avg-${label}">${label}</th>
        <td>${dash(current)}${delta}</td>
        <td>${dash(best)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="timer-averages-wrap">
    <table class="timer-averages">
      <caption>Averages</caption>
      <thead>
        <tr>
          <th scope="col"></th>
          <th scope="col">now</th>
          <th scope="col">best</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
    ${splits ? `<div class="timer-split-averages-scroll">${renderSplitAverageTable(stats?.splitAverages)}${renderPeriodAverageTable(stats?.periodMeans)}</div>` : ""}
  </div>`;
}

export function renderSplitStats(splitStats) {
  if (!splitStats?.stages?.length) return "";
  const totalMean = splitStats.stages.reduce((sum, stage) => sum + stage.mean, 0) || 1;
  const rows = splitStats.stages
    .map((stage) => {
      const pct = Math.max(8, Math.round((stage.mean / totalMean) * 100));
      const slow = stage.id === splitStats.slowestId ? " is-slowest" : "";
      return `<div class="timer-split-avg timer-split-avg-${stage.id}${slow}">
        <span class="timer-split-avg-name">${stage.title}</span>
        <div class="timer-split-avg-track" aria-hidden="true">
          <span class="timer-split-avg-fill" style="width:${pct}%"></span>
        </div>
        <strong>${formatClock(stage.mean)}</strong>
        <span class="timer-split-avg-best">best ${formatClock(stage.best)}</span>
      </div>`;
    })
    .join("");
  const slowest = splitStats.stages.find((stage) => stage.id === splitStats.slowestId);
  const tip = slowest
    ? `<p class="timer-split-tip">${slowest.title} is your slowest stage on average — that's the one to drill.</p>`
    : "";
  const countLabel = `${splitStats.count} split solve${splitStats.count === 1 ? "" : "s"}`;
  return `<h2 class="timer-times-title">Stage averages</h2>
    <p class="timer-split-count">${countLabel}</p>
    ${rows}
    ${tip}`;
}

function isTypingTarget(el) {
  return Boolean(
    el?.closest?.("input, select, textarea, [contenteditable=true], dialog, button, a, [data-load-scramble]")
  );
}

function idleStatus(mode) {
  if (mode === TIMER_MODE_SPLITS) {
    return "Space or tap to start · space or tap again at Cross, F2L, then solved";
  }
  if (mode === TIMER_MODE_PLL) return "Space or tap to time this case · another case skips without a time";
  if (mode === TIMER_MODE_CROSS) return "Space or tap to time the cross · Repeat keeps this case";
  return "Space or tap to start · next scramble appears when you stop";
}

function runningStatus(mode, marks = [], { cubeSplits = false, layer = null } = {}) {
  if (mode === TIMER_MODE_PLL) return "Timing this case — space or tap to stop";
  if (mode === TIMER_MODE_CROSS) return "Timing the cross — space or tap to stop";
  if (mode !== TIMER_MODE_SPLITS) return "Timing — space or tap to stop";
  const next = SPLIT_STEPS[currentSplitIndex(marks)];
  if (cubeSplits) {
    if (next.id === "cross") return "Timing — Cross marks when the white cross is done · tap if it misses";
    if (next.id === "f2l") return "Timing — each pair marks as it goes in · F2L marks when the first two layers are done";
    if (layer?.headlights != null) return "Timing — last edges, and the cube stops when solved";
    if (layer?.oll != null) return "Timing — Headlights marks when the corners are done · the cube stops when solved";
    if (layer?.yellowCross != null) return "Timing — OLL marks when the yellow face is done · the cube stops when solved";
    return "Timing — yellow cross marks when it is up · the cube stops when solved";
  }
  if (next.id === "cross") return "Timing — space or tap when white cross is done";
  if (next.id === "f2l") return "Timing — space or tap when F2L is done";
  return "Timing — space or tap when solved";
}

export function initPracticeTimer({
  store = browserStore(),
  isActive = () => false,
  onRecordsChanged,
} = {}) {
  const clockBtn = document.getElementById("practice-clock");
  const clockValue = document.getElementById("practice-clock-value");
  const levelEl = document.getElementById("coach-level");
  const sessionEl = document.getElementById("coach-session");
  const focusEl = document.getElementById("coach-focus");
  const scrambleEl = document.getElementById("practice-scramble");
  const scrambleLoad = document.getElementById("practice-scramble-load");
  const scrambleInput = document.getElementById("practice-scramble-input");
  const statusEl = document.getElementById("practice-status");
  const reconEl = document.getElementById("practice-reconstruction");
  const postSolveEl = document.getElementById("post-solve");
  const timesEl = document.getElementById("timer-times");
  const statsEl = document.getElementById("timer-stats");
  const splitStatsEl = document.getElementById("timer-split-stats");
  const chartEl = document.getElementById("timer-chart");
  const chartDialog = document.getElementById("timer-chart-dialog");
  const enlargedEl = document.getElementById("timer-chart-enlarged");
  const chartCloseBtn = document.getElementById("timer-chart-dialog-close");
  const inspectEl = document.getElementById("timer-inspect");
  const chartWindowEl = document.getElementById("timer-chart-window");
  const clearBtn = document.getElementById("timer-clear");
  const splitsEl = document.getElementById("practice-splits");
  const modeBtns = [...document.querySelectorAll("[data-timer-mode]")];
  const scrambleKicker = document.getElementById("practice-scramble-kicker");
  const pllCaseEl = document.getElementById("pll-trainer-case");
  const pllPickEl = document.getElementById("pll-trainer-pick");
  const pllCasesEl = document.getElementById("pll-trainer-cases");
  const pllPickLabel = document.getElementById("pll-trainer-pick-label");
  const pllSummaryEl = document.getElementById("pll-case-summary");
  const crossPanel = document.getElementById("cross-drill");
  const crossNote = document.getElementById("cross-drill-note");
  const timesTitle = document.getElementById("timer-times-title");

  if (!clockBtn || !clockValue) return { refresh() {}, cancel() {} };

  const state = {
    phase: "idle", // idle | inspecting | running
    mode: loadTimerMode(store),
    startedAt: 0,
    inspectLeft: 0,
    scramble: "",
    raf: 0,
    inspectTimer: 0,
    marks: [],
    pairMarks: [],
    layerMarks: emptyLayerMarks(),
    shadowFacelets: "",
    lastTapElapsed: 0,
    lastSplits: null,
    lastMs: 0,
    chartWindow: loadChartWindow(store),
    pllChartWindow: loadChartWindow(store, PLL_CHART_WINDOW_KEY),
    crossChartWindow: loadChartWindow(store, CROSS_DRILL_CHART_WINDOW_KEY),
    pllSelected: loadPllSelection(store),
    pllCase: null,
    crossCase: null,
    crossReveal: false,
    moves: [],
    lastMoves: null,
    cubeConnected: false,
    cubeArmed: false,
    cubeSawMove: false,
    cubeWasUnsolved: false,
    latestFacelets: "",
    cubeStopTimer: 0,
    cubeHold: false,
    rerun: false,
    awaitingDeal: false,
    lastScramble: "",
    previewPb: false,
    previewPairs: false,
  };

  let replayHandler = null;

  function pllOn() {
    return state.mode === TIMER_MODE_PLL;
  }

  function crossOn() {
    return state.mode === TIMER_MODE_CROSS;
  }

  function sessionKind() {
    if (pllOn()) return "pll";
    if (crossOn()) return "cross";
    return "solve";
  }

  function currentRecords() {
    if (pllOn()) return loadPllTrainerTimes(store);
    if (crossOn()) return loadCrossDrillTimes(store);
    return loadPracticeTimes(store);
  }

  function cubeDrivesTimer() {
    return state.cubeConnected;
  }

  function cubeMarksSplits() {
    return cubeDrivesTimer() && state.mode === TIMER_MODE_SPLITS;
  }

  function statusWhileRunning() {
    const running = runningStatus(state.mode, state.marks, {
      cubeSplits: cubeMarksSplits(),
      layer: state.layerMarks,
    });
    if (!cubeDrivesTimer() || cubeMarksSplits()) return running;
    if (crossOn()) return `${running} · the cube stops it when the white cross is done`;
    return `${running} · the cube stops it when solved`;
  }

  function cubeIdleStatus() {
    if (pllOn()) {
      return state.cubeArmed
        ? "Case set up — turn the cube to start. Space still works."
        : "Cube connected · set up this case from solved to arm. Space or tap still starts.";
    }
    if (crossOn()) {
      return state.cubeArmed
        ? "Cross set up — turn the cube to start. Space still works."
        : "Cube connected · apply the cross scramble to arm. Space or tap still starts.";
    }
    const auto = state.mode === TIMER_MODE_SPLITS ? " Cross and F2L mark themselves, then yellow cross, OLL, and PLL." : "";
    return state.cubeArmed
      ? `Scramble matched — turn the cube to start. Space still works.${auto}`
      : `Cube connected · apply the scramble to arm. Space or tap still starts.${auto}`;
  }

  function statusForIdle() {
    let text = idleStatus(state.mode);
    if (pllOn() && !state.pllCase) text = "Select at least one PLL case";
    else if (cubeDrivesTimer()) text = cubeIdleStatus();
    if (state.rerun && !pllOn() && !crossOn()) return `Rerun · ${text}`;
    return text;
  }

  function cubeInspectStatus() {
    if (pllOn()) return "Case set up — inspection running. The first turn starts the timer.";
    if (crossOn()) return "Cross set up — inspection running. The first turn starts the timer.";
    return "Scramble matched — inspection running. The first turn starts the timer.";
  }

  function paintReconstruction(moves, splits, totalMs = null) {
    if (!reconEl) return;
    const html = renderReconstruction(moves, splits, totalMs, { strip: !summaryActive() });
    reconEl.hidden = !html;
    reconEl.innerHTML = html;
  }

  function paintPostSolve() {
    const show = summaryActive();
    if (clockBtn) clockBtn.hidden = show;
    if (!postSolveEl) return;
    if (!show) {
      postSolveEl.hidden = true;
      postSolveEl.innerHTML = "";
      return;
    }
    const summary = postSolveSummary({
      moves: state.lastMoves,
      splits: state.lastSplits,
      totalMs: state.lastMs,
    });
    const pb = state.previewPb || isSessionBest(state.lastMs, computeStats(loadPracticeTimes(store)).best);
    const html = renderPostSolveCard(summary, {
      pb,
      canReplay: Boolean(replayHandler) && state.cubeConnected && Boolean(state.lastScramble),
      pairsOpen: state.previewPairs,
    });
    postSolveEl.hidden = !html;
    postSolveEl.innerHTML = html;
    if (!html && clockBtn) clockBtn.hidden = false;
  }

  function paintCoach() {
    const solveMode = !pllOn() && !crossOn();
    const idle = state.phase === "idle";
    const records = solveMode ? loadPracticeTimes(store) : [];
    const stats = solveMode ? computeStats(records) : null;
    if (levelEl) {
      const show = solveMode && idle;
      levelEl.hidden = !show;
      levelEl.innerHTML = show ? renderLevelChip(stats) : "";
    }
    const tax = solveMode ? sessionMainTax(records) : null;
    if (sessionEl) {
      const show = Boolean(solveMode && idle && tax);
      sessionEl.hidden = !show;
      sessionEl.textContent = show ? tax.text : "";
    }
    if (focusEl) {
      const latest = state.lastMs > 0 ? records.at(-1) : null;
      const shown = latest ? splitsForDisplay(latest) : null;
      const line =
        solveMode && idle && shown
          ? describeBottleneck({
              splits: shown,
              refs: stageReferences(records),
              goalMs: loadAo100Goal(store),
            })
          : null;
      const html = line ? renderCoachFocus(line) : "";
      focusEl.hidden = !html;
      focusEl.innerHTML = html;
    }
  }

  function clearCubeStop() {
    if (state.cubeStopTimer) window.clearTimeout(state.cubeStopTimer);
    state.cubeStopTimer = 0;
  }

  function logCubeMove(move, cubeT) {
    const t = state.phase === "running" ? Math.max(0, Date.now() - state.startedAt) : 0;
    const row = { move, t };
    if (Number.isFinite(cubeT)) row.cubeT = cubeT;
    state.moves.push(row);
    state.cubeSawMove = true;
    if (state.phase === "running" && cubeMarksSplits()) noteSplitFromMove(move, t);
  }

  function applySplitStep(stepped, elapsed) {
    if (stepped.action === "none") return;
    state.marks = stepped.marks;
    state.pairMarks = stepped.pairs;
    state.layerMarks = stepped.layer;
    setStatus(statusWhileRunning());
    paintSplits(elapsed);
  }

  function noteSplitFromMove(move, elapsed) {
    if (state.shadowFacelets.length !== 54) {
      state.shadowFacelets = seedSplitFacelets(state.latestFacelets, state.scramble);
    }
    if (state.shadowFacelets.length !== 54) return;
    const stepped = stepCubeSplit({
      facelets: state.shadowFacelets,
      move,
      marks: state.marks,
      pairs: state.pairMarks,
      layer: state.layerMarks,
      elapsed,
      mode: state.mode,
    });
    state.shadowFacelets = stepped.facelets;
    applySplitStep(stepped, elapsed);
  }

  function setPhase(phase) {
    state.phase = phase;
    clockBtn.dataset.phase = phase;
    const runningLabel =
      state.mode === TIMER_MODE_SPLITS ? "Record checkpoint or stop timer" : "Stop timer";
    clockBtn.setAttribute(
      "aria-label",
      phase === "running" ? runningLabel : phase === "inspecting" ? "Cancel inspection" : "Start timer"
    );
    syncModeButtons();
    syncPllLocks();
    syncScrambleLock();
    if (crossOn()) paintCross();
    paintCoach();
    paintPostSolve();
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function syncModeButtons() {
    const locked = state.phase !== "idle";
    for (const btn of modeBtns) {
      const active = btn.dataset.timerMode === state.mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.disabled = locked;
    }
  }

  function paintSplits(elapsed = 0) {
    if (!splitsEl) return;
    if (summaryActive()) {
      splitsEl.hidden = true;
      return;
    }
    const show = state.mode === TIMER_MODE_SPLITS;
    splitsEl.hidden = !show;
    if (!show) return;
    const running = state.phase === "running";
    const inspecting = state.phase === "inspecting";
    const bests = running || inspecting ? null : splitBests(computeStats(loadPracticeTimes(store)).splits);
    splitsEl.innerHTML = renderLiveSplits({
      marks: inspecting ? [] : state.marks,
      elapsed: running ? elapsed : elapsed || 0,
      running,
      splits: running || inspecting ? null : state.lastSplits,
      pairs: running ? state.pairMarks : inspecting ? [] : state.lastSplits?.pairs,
      layer: running ? state.layerMarks : null,
      bests,
    });
  }

  function updateBestHighlight() {
    const show = state.phase === "idle" && isSessionBest(state.lastMs, computeStats(currentRecords()).best);
    clockBtn.classList.toggle("is-best", show);
  }

  function paintClock(ms, inspecting = false) {
    if (inspecting || state.phase === "running") clockBtn.classList.remove("is-best");
    if (inspecting) {
      clockValue.textContent = String(Math.max(0, ms));
      paintSplits(0);
      return;
    }
    const { m, s, centi } = formatTimerParts(ms);
    clockValue.innerHTML = `${m}<span class="practice-colon">:</span>${s}<span class="practice-centi">${centi}</span>`;
    paintSplits(ms);
  }

  function syncScrambleLock() {
    const locked = state.phase !== "idle" || pllOn() || crossOn();
    if (scrambleInput) scrambleInput.disabled = locked;
    const loadBtn = scrambleLoad?.querySelector("button");
    if (loadBtn) loadBtn.disabled = locked;
  }

  function paintScrambleHold() {
    if (scrambleEl) {
      scrambleEl.textContent = "Turn the cube to load it";
      scrambleEl.classList.add("is-held");
      scrambleEl.title = "Turn the cube to load the next scramble";
      scrambleEl.setAttribute("aria-label", "Next scramble. Turn the cube to load it. Space or tap still starts.");
    }
    if (scrambleKicker) {
      scrambleKicker.hidden = false;
      scrambleKicker.classList.remove("is-rerun");
      scrambleKicker.textContent = "Next scramble";
    }
  }

  function newScramble({ announce = false } = {}) {
    const wasWaiting = state.awaitingDeal;
    state.awaitingDeal = false;
    state.rerun = false;
    state.scramble = generatePracticeScramble();
    scrambleEl?.classList.remove("is-held");
    if (scrambleEl) scrambleEl.textContent = state.scramble;
    state.cubeArmed = false;
    syncPllChrome();
    if (announce) setStatus(wasWaiting && cubeDrivesTimer() ? applyStatus() : "New scramble");
    reconsiderCube();
  }

  /** Load the next scramble after a turn on the solved cube. Does not start the clock. */
  function dealNextScramble() {
    if (pllOn() || crossOn()) return;
    newScramble();
    if (state.phase !== "idle" || state.cubeArmed) return;
    setStatus(applyStatus());
  }

  /** Load a chosen scramble as the next attempt. The finished time is a new solve. */
  function loadChosenScramble(raw) {
    if (pllOn() || crossOn()) return false;
    if (state.phase !== "idle") {
      setStatus("Finish or cancel this solve before loading a scramble");
      return false;
    }
    const scramble = normalizeScramble(raw);
    if (!scramble) {
      setStatus("That isn’t a scramble. Use moves like R U R' U'.");
      return false;
    }
    state.awaitingDeal = false;
    state.rerun = true;
    state.scramble = scramble;
    state.cubeArmed = false;
    scrambleEl?.classList.remove("is-held");
    state.marks = [];
    state.pairMarks = [];
    state.layerMarks = emptyLayerMarks();
    state.shadowFacelets = "";
    state.lastTapElapsed = 0;
    state.lastSplits = null;
    state.lastMs = 0;
    state.lastMoves = null;
    state.moves = [];
    if (scrambleEl) scrambleEl.textContent = state.scramble;
    if (scrambleInput) scrambleInput.value = "";
    paintReconstruction(null);
    paintClock(0);
    updateBestHighlight();
    syncPllChrome();
    setStatus(loadedScrambleStatus());
    reconsiderCube();
    return true;
  }

  function loadedScrambleStatus() {
    if (cubeDrivesTimer()) return statusForIdle();
    const seconds = Number(inspectEl?.value) || 0;
    if (seconds) return `Scramble loaded. Space or tap for ${seconds}s inspection.`;
    return "Scramble loaded. Space or tap to start.";
  }

  function showTimerStage() {
    const stage = document.querySelector(".timer-stage");
    if (!stage || typeof stage.getBoundingClientRect !== "function") return;
    const rect = stage.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      stage.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }

  function cubeGoalReached(facelets = state.latestFacelets) {
    return cubeTimerGoalReached(state.mode, facelets);
  }

  /** Facelets that arm the clock. PLL uses the case setup; every other mode uses its scramble. */
  function cubeTarget() {
    if (pllOn()) {
      const alg = state.pllCase?.alg || "";
      if (!alg) return "";
      return faceletsForScramble(caseSetupMoves(alg));
    }
    if (!String(state.scramble || "").trim()) return "";
    return faceletsForScramble(state.scramble);
  }

  function cubeDecision(extra = {}) {
    const inspectionSeconds = Number(inspectEl?.value) || 0;
    return cubeTimerDecision({
      phase: state.phase,
      mode: state.mode,
      armed: state.cubeArmed,
      inspectionSeconds,
      facelets: state.latestFacelets,
      target: cubeTarget(),
      solved: cubeGoalReached(),
      sawMove: state.cubeSawMove,
      wasUnsolved: state.cubeWasUnsolved,
      hold: state.cubeHold,
      awaitingScramble: state.awaitingDeal,
      ...extra,
    });
  }

  function applyStatus() {
    const seconds = Number(inspectEl?.value) || 0;
    return seconds > 0
      ? "Next scramble is up. Apply it — inspection starts when the cube matches."
      : "Next scramble is up. Apply it — the timer arms when the cube matches.";
  }

  function solvedTurnStatus() {
    return "Turn the cube for the next scramble. Space or tap still starts.";
  }

  function summaryActive() {
    return state.phase === "idle" && !pllOn() && !crossOn() && Boolean(state.lastMoves) && state.lastMs > 0;
  }

  function scheduleCubeStop() {
    if (state.cubeStopTimer) return;
    state.cubeStopTimer = window.setTimeout(() => {
      state.cubeStopTimer = 0;
      if (state.phase !== "running") return;
      if (cubeDecision().action === "stop") stopTiming();
    }, 80);
  }

  function applyCubeDecision(decision, move, cubeT) {
    if (decision.action === "inspect") {
      state.cubeArmed = true;
      startInspection();
      if (state.phase === "inspecting") setStatus(cubeInspectStatus());
      return;
    }
    if (decision.action === "arm") {
      state.cubeArmed = true;
      if (state.phase === "idle") setStatus(statusForIdle());
      return;
    }
    if (decision.action === "disarm") {
      state.cubeArmed = false;
      if (state.phase === "idle") setStatus(statusForIdle());
      return;
    }
    if (decision.action === "release") {
      state.cubeHold = false;
      return;
    }
    if (decision.action === "deal") {
      dealNextScramble();
      return;
    }
    if (decision.action === "start") {
      startTiming();
      logCubeMove(move, cubeT);
      return;
    }
    if (decision.action === "log") {
      logCubeMove(move, cubeT);
      return;
    }
    if (decision.action === "stop") scheduleCubeStop();
  }

  function reconsiderCube() {
    if (!state.cubeConnected || !state.latestFacelets || state.phase !== "idle") return;
    applyCubeDecision(cubeDecision());
  }

  function onCubeFacelets(facelets) {
    state.latestFacelets = String(facelets || "");
    if (!state.cubeConnected) return;
    if (state.phase === "running" && state.latestFacelets && !cubeGoalReached(state.latestFacelets)) {
      state.cubeWasUnsolved = true;
    }
    // Hardware facelets are the real cube. Resync the shadow, then mark.
    // Marks already taken on an earlier move stay at that earlier time.
    if (state.latestFacelets.length === 54) state.shadowFacelets = state.latestFacelets;
    noteCubeSplits();
    applyCubeDecision(cubeDecision());
  }

  function noteCubeSplits() {
    if (state.phase !== "running" || !cubeMarksSplits()) return;
    const elapsed = Math.max(0, Date.now() - state.startedAt);
    const facelets = state.latestFacelets.length === 54 ? state.latestFacelets : state.shadowFacelets;
    if (facelets.length !== 54) return;
    const stepped = stepCubeSplit({
      facelets,
      marks: state.marks,
      pairs: state.pairMarks,
      layer: state.layerMarks,
      elapsed,
      mode: state.mode,
    });
    state.shadowFacelets = stepped.facelets;
    applySplitStep(stepped, elapsed);
  }

  function onCubeMove(move, cubeT) {
    if (!state.cubeConnected || !move) return;
    applyCubeDecision(cubeDecision({ move, solved: false }), move, cubeT);
  }

  function setCubeConnected(connected) {
    state.cubeConnected = Boolean(connected);
    if (!state.cubeConnected) {
      state.cubeArmed = false;
      clearCubeStop();
      if (state.awaitingDeal && !pllOn() && !crossOn()) newScramble();
    }
    if (state.phase === "idle") {
      setStatus(statusForIdle());
      if (state.cubeConnected) reconsiderCube();
    }
  }

  function paintCross() {
    const crossCase = state.crossCase;
    const open = Boolean(state.crossReveal && crossCase);
    const showBtn = document.getElementById("cross-drill-show");
    const panel = document.getElementById("cross-drill-solution");
    const algEl = document.getElementById("cross-drill-alg");
    const kick = document.getElementById("cross-drill-solution-kicker");
    if (showBtn) {
      showBtn.setAttribute("aria-expanded", open ? "true" : "false");
      showBtn.textContent = open ? "Hide optimal cross" : "Show optimal cross";
    }
    if (panel) panel.hidden = !open;
    if (algEl) algEl.textContent = open && crossCase ? crossCase.solution : "";
    if (kick) {
      kick.textContent =
        open && crossCase
          ? `Optimal · ${crossCase.length} ${crossCase.length === 1 ? "move" : "moves"} · white on bottom, blue in front`
          : "";
    }
    const locked = state.phase !== "idle";
    const repeatBtn = document.getElementById("cross-drill-repeat");
    const nextBtn = document.getElementById("cross-drill-next");
    if (repeatBtn) repeatBtn.disabled = locked || !crossCase;
    if (nextBtn) nextBtn.disabled = locked || !crossCase;
  }

  function showCrossCase(crossCase, { reveal = false, announce = "" } = {}) {
    state.crossCase = crossCase;
    state.crossReveal = reveal;
    state.scramble = crossCase?.scramble || "";
    if (scrambleEl) scrambleEl.textContent = state.scramble || "—";
    state.lastSplits = null;
    state.lastMs = 0;
    state.cubeArmed = false;
    paintClock(0);
    paintCross();
    updateBestHighlight();
    if (announce) setStatus(announce);
    if (crossOn() && state.phase === "idle") reconsiderCube();
  }

  function crossDealStatus({ same = false } = {}) {
    const which = same ? "Same case." : "New cross.";
    if (!state.cubeConnected) return `${which} Space or tap to start.`;
    return `${which} Apply the scramble to arm. Space or tap still starts.`;
  }

  function finishCrossDeal({ same = false } = {}) {
    if (state.phase !== "idle" || state.cubeArmed) return;
    setStatus(crossDealStatus({ same }));
  }

  function dealNextCross() {
    showCrossCase(randomCrossCase(), { reveal: false });
    finishCrossDeal({ same: false });
  }

  function repeatCross() {
    if (!state.crossCase) {
      dealNextCross();
      return;
    }
    showCrossCase(state.crossCase, { reveal: false });
    finishCrossDeal({ same: true });
  }

  function syncPllChrome() {
    const on = pllOn();
    const cross = crossOn();
    const rerun = Boolean(state.rerun) && !on && !cross;
    if (scrambleEl) {
      scrambleEl.hidden = on;
      scrambleEl.classList.toggle("is-static", cross);
      scrambleEl.classList.toggle("is-rerun", rerun && !state.awaitingDeal);
      if (state.awaitingDeal && !on && !cross) {
        scrambleEl.textContent = "Turn the cube to load it";
        scrambleEl.title = "Turn the cube to load the next scramble";
        scrambleEl.setAttribute("aria-label", "Next scramble. Turn the cube to load it. Space or tap still starts.");
      } else {
        scrambleEl.title = cross
          ? "Apply this to a solved cube. White on bottom."
          : rerun
            ? "Rerun of a past scramble. Tap for a new one."
            : "Tap for a new scramble";
        scrambleEl.setAttribute(
          "aria-label",
          cross
            ? "Cross scramble. Apply it to a solved cube with white on the bottom."
            : rerun
              ? "Rerun scramble. Tap for a new scramble."
              : "Current scramble. Tap for a new scramble."
        );
      }
    }
    if (scrambleKicker) {
      scrambleKicker.hidden = on;
      if (state.awaitingDeal && !on && !cross) {
        scrambleKicker.classList.remove("is-rerun");
        scrambleKicker.textContent = "Next scramble";
      } else {
        scrambleKicker.classList.toggle("is-rerun", rerun);
        scrambleKicker.textContent = cross ? "Cross scramble" : rerun ? "Rerun" : "Scramble";
      }
    }
    if (scrambleEl) scrambleEl.classList.toggle("is-held", Boolean(state.awaitingDeal) && !on && !cross);
    if (scrambleLoad) scrambleLoad.hidden = on || cross;
    syncScrambleLock();
    if (pllCaseEl) pllCaseEl.hidden = !on;
    if (pllPickEl) pllPickEl.hidden = !on;
    if (pllSummaryEl) pllSummaryEl.hidden = !on;
    if (crossPanel) crossPanel.hidden = !cross;
    if (crossNote) crossNote.hidden = !cross;
    if (timesTitle) timesTitle.textContent = cross ? "Cross times" : "Times";
    document.body.classList.toggle("timer-pll", on);
    document.body.classList.toggle("timer-cross", cross);
    if (cross) paintCross();
  }

  function syncPllLocks() {
    const locked = state.phase !== "idle";
    pllCasesEl?.querySelectorAll("[data-pll-case]").forEach((btn) => {
      btn.disabled = locked;
    });
    pllPickEl?.querySelectorAll("[data-pll-preset]").forEach((btn) => {
      btn.disabled = locked;
    });
    const next = document.getElementById("pll-trainer-next");
    if (next) next.disabled = locked || !state.pllCase;
  }

  function paintPllPicker() {
    if (pllCasesEl) pllCasesEl.innerHTML = renderPllCasePicker(state.pllSelected, state.pllCase?.id || "");
    if (pllPickLabel) {
      const n = state.pllSelected.length;
      pllPickLabel.textContent = n ? `Cases · ${n} on` : "Cases · none on";
    }
    pllPickEl?.querySelectorAll("[data-pll-preset]").forEach((btn) => {
      const ids = presetIds(btn.dataset.pllPreset);
      const same = Boolean(ids && sameIdSet(ids, state.pllSelected));
      btn.classList.toggle("is-active", same);
      btn.setAttribute("aria-pressed", same ? "true" : "false");
    });
    syncPllLocks();
  }

  function paintPllCase() {
    if (pllCaseEl) pllCaseEl.innerHTML = renderTrainerCase(state.pllCase);
    paintPllPicker();
  }

  function dealPllCase() {
    state.pllCase = pickTrainerCase(listPllTrainerCases(), state.pllSelected, {
      previousId: state.pllCase?.id || "",
    });
    state.cubeArmed = false;
    paintPllCase();
    if (pllOn() && state.phase === "idle") reconsiderCube();
  }

  function setPllSelection(ids) {
    state.pllSelected = savePllSelection(ids, store);
    if (!state.pllSelected.includes(state.pllCase?.id)) {
      state.pllCase = null;
      dealPllCase();
    } else {
      paintPllPicker();
    }
    if (pllOn()) setStatus(statusForIdle());
  }

  function activeChartWindow() {
    if (pllOn()) return state.pllChartWindow;
    if (crossOn()) return state.crossChartWindow;
    return state.chartWindow;
  }

  function sessionInspectKey() {
    if (pllOn()) return PLL_INSPECT_KEY;
    if (crossOn()) return CROSS_DRILL_INSPECT_KEY;
    return PRACTICE_INSPECT_KEY;
  }

  function sessionChartKey() {
    if (pllOn()) return PLL_CHART_WINDOW_KEY;
    if (crossOn()) return CROSS_DRILL_CHART_WINDOW_KEY;
    return PRACTICE_CHART_WINDOW_KEY;
  }

  function syncSessionControls() {
    if (inspectEl) inspectEl.value = String(loadInspectionSeconds(store, sessionInspectKey()));
    const windowSize = loadChartWindow(store, sessionChartKey());
    if (pllOn()) state.pllChartWindow = windowSize;
    else if (crossOn()) state.crossChartWindow = windowSize;
    else state.chartWindow = windowSize;
    if (chartWindowEl) chartWindowEl.value = String(windowSize);
  }

  function chartOptions(extra = {}) {
    const kind = sessionKind();
    const emptyLabel =
      kind === "pll"
        ? "Time two cases and a progress chart appears here."
        : kind === "cross"
          ? "Time two crosses and a progress chart appears here."
          : "";
    return {
      windowSize: activeChartWindow(),
      emptyLabel,
      ...extra,
    };
  }

  function paintEnlargedChart(records) {
    if (!enlargedEl) return;
    enlargedEl.innerHTML = renderProgressChart(records, chartOptions({ enlarged: true }));
    bindChartInteract(enlargedEl);
  }

  function openEnlargedChart() {
    if (!chartDialog) return;
    const records = currentRecords();
    const { records: windowed } = sliceChartRecords(records, activeChartWindow());
    if (chartRows(windowed).length < 2) return;
    paintEnlargedChart(records);
    if (typeof chartDialog.showModal === "function") chartDialog.showModal();
    else chartDialog.setAttribute("open", "");
  }

  function closeEnlargedChart() {
    if (!chartDialog) return;
    if (typeof chartDialog.close === "function" && chartDialog.open) chartDialog.close();
    else chartDialog.removeAttribute("open");
  }

  function renderRecords() {
    const records = currentRecords();
    const stats = computeStats(records);
    const previous = records.length > 1 ? computeStats(records.slice(0, -1)) : null;
    const pll = pllOn();
    const cross = crossOn();
    if (timesEl) {
      timesEl.innerHTML = pll
        ? renderPllTimesList(records)
        : cross
          ? renderCrossTimesList(records)
          : renderTimesList(records);
    }
    if (statsEl) {
      const goalMs = pll || cross ? null : loadAo100Goal(store);
      statsEl.innerHTML = renderStats(stats, previous, {
        splitShift: !pll && !cross && Boolean(records.at(-1)?.splits),
        stages: !pll && !cross,
        goalMs,
        outlook: pll || cross ? null : ao100Outlook(records, goalMs),
        session: pll || cross ? null : sessionMainTax(records),
      });
    }
    paintCoach();
    if (splitStatsEl) splitStatsEl.innerHTML = pll || cross ? "" : renderSplitStats(stats.splits);
    if (pllSummaryEl) pllSummaryEl.innerHTML = pll ? renderPllCaseSummary(records) : "";
    if (chartEl) {
      chartEl.innerHTML = renderProgressChart(records, chartOptions());
      bindChartInteract(chartEl);
    }
    if (chartDialog?.open) paintEnlargedChart(records);
    if (clearBtn) clearBtn.disabled = records.length === 0;
    updateBestHighlight();
  }

  function cancelTimers() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    window.clearInterval(state.inspectTimer);
    state.inspectTimer = 0;
    clearCubeStop();
  }

  function cancelSession() {
    const holdCube = state.cubeConnected && (state.phase === "inspecting" || state.cubeArmed);
    cancelTimers();
    setPhase("idle");
    state.startedAt = 0;
    state.marks = [];
    state.pairMarks = [];
    state.layerMarks = emptyLayerMarks();
    state.shadowFacelets = "";
    state.lastTapElapsed = 0;
    state.lastSplits = null;
    state.lastMs = 0;
    state.moves = [];
    state.cubeHold = holdCube;
    state.cubeArmed = false;
    state.cubeSawMove = false;
    state.previewPb = false;
    state.lastMs = 0;
    state.lastMoves = null;
    paintReconstruction(null);
    paintClock(0);
    paintPostSolve();
    updateBestHighlight();
    setStatus(statusForIdle());
  }

  function tickRunning() {
    if (state.phase !== "running") return;
    paintClock(Date.now() - state.startedAt);
    state.raf = requestAnimationFrame(tickRunning);
  }

  function startTiming() {
    cancelTimers();
    setPhase("running");
    state.startedAt = Date.now();
    state.marks = [];
    state.pairMarks = [];
    state.layerMarks = emptyLayerMarks();
    state.shadowFacelets = seedSplitFacelets(state.latestFacelets, state.scramble);
    state.lastTapElapsed = 0;
    state.lastSplits = null;
    state.moves = [];
    state.cubeSawMove = false;
    state.cubeHold = false;
    state.cubeWasUnsolved = Boolean(state.latestFacelets) && !cubeGoalReached(state.latestFacelets);
    state.cubeArmed = false;
    clockBtn.classList.remove("is-best");
    paintReconstruction(null);
    setStatus(statusWhileRunning());
    tickRunning();
  }

  function startInspection() {
    const seconds = Number(inspectEl?.value) || 0;
    if (!seconds) {
      startTiming();
      return;
    }
    cancelTimers();
    setPhase("inspecting");
    state.inspectLeft = seconds;
    paintClock(seconds, true);
    setStatus(`Inspection — ${seconds}s`);
    state.inspectTimer = window.setInterval(() => {
      state.inspectLeft -= 1;
      if (state.inspectLeft <= 0) {
        window.clearInterval(state.inspectTimer);
        state.inspectTimer = 0;
        startTiming();
        return;
      }
      paintClock(state.inspectLeft, true);
      setStatus(`Inspection — ${state.inspectLeft}s`);
    }, 1000);
  }

  function stopTiming() {
    const ms = Date.now() - state.startedAt;
    cancelTimers();
    setPhase("idle");
    if (ms > 0) {
      if (crossOn()) {
        const crossCase = state.crossCase;
        state.lastSplits = null;
        state.lastMs = ms;
        state.marks = [];
        state.pairMarks = [];
        state.layerMarks = emptyLayerMarks();
        state.shadowFacelets = "";
        state.lastTapElapsed = 0;
        if (crossCase) {
          addCrossDrillTime(
            {
              ms,
              at: Date.now(),
              scramble: crossCase.scramble,
              length: crossCase.length,
            },
            store
          );
        }
        state.crossReveal = true;
        paintClock(ms);
        paintCross();
        renderRecords();
        const lengthLabel = crossCase
          ? ` Optimal is ${crossCase.length} ${crossCase.length === 1 ? "move" : "moves"}.`
          : "";
        setStatus(`Cross ${formatClock(ms)}.${lengthLabel} Repeat or Next.`);
        return;
      }
      if (pllOn()) {
        const done = state.pllCase;
        state.lastSplits = null;
        state.lastMs = ms;
        state.marks = [];
        state.pairMarks = [];
        state.layerMarks = emptyLayerMarks();
        state.shadowFacelets = "";
        state.lastTapElapsed = 0;
        if (done) {
          addPllTrainerTime(
            {
              ms,
              at: Date.now(),
              caseId: done.id,
              short: done.short,
              name: done.name,
              badge: done.badge || "",
            },
            store
          );
        }
        paintClock(ms);
        renderRecords();
        dealPllCase();
        const ready = state.cubeConnected
          ? "Next case is ready — set it up from solved to arm."
          : "Next case is ready.";
        setStatus(done ? `${caseMark(done)} ${formatClock(ms)}. ${ready}` : statusForIdle());
        return;
      }
      let splits =
        state.mode === TIMER_MODE_SPLITS && state.marks.length >= SPLIT_STEPS.length - 1
          ? layerSplitsFromMarks(state.marks, state.layerMarks, ms)
          : null;
      if (splits && state.pairMarks.length) splits.pairs = state.pairMarks.map((pair) => ({ id: pair.id, at: pair.at }));
      const moves = normalizeMoves(state.moves);
      if (splits && moves && !Number.isFinite(Number(splits.oll))) {
        const layer = lastLayerSplit({ scramble: state.scramble, moves, splits, totalMs: ms });
        if (layer) splits = { ...splits, ...layer };
      }
      state.lastSplits = splits;
      state.lastMs = ms;
      state.marks = [];
      state.pairMarks = [];
      state.layerMarks = emptyLayerMarks();
      state.shadowFacelets = "";
      state.lastTapElapsed = 0;
      state.lastMoves = moves;
      state.lastScramble = state.scramble;
      state.moves = [];
      state.cubeSawMove = false;
      state.cubeArmed = false;
      state.previewPb = false;
      const wasRerun = state.rerun;
      const record = { ms, at: Date.now(), scramble: state.scramble };
      if (splits) record.splits = splits;
      if (moves) record.moves = moves;
      addPracticeTime(record, store);
      onRecordsChanged?.({ reason: "add", record });
      paintClock(ms);
      renderRecords();
      paintReconstruction(moves, splits, ms);
      paintPostSolve();
      const splitShown = splits ? decorateLayerSplits(splits) : null;
      const splitBits = splitShown
        ? displaySplitSteps(splitShown).map((step) => `${step.short} ${formatClock(splitShown[step.id])}`).join(" · ")
        : "";
      const moveMeta = formatMoveMeta(moves, ms);
      const moveBits = moveMeta ? ` ${moveMeta}.` : "";
      if (cubeDrivesTimer()) {
        state.awaitingDeal = true;
        state.cubeArmed = false;
        paintScrambleHold();
        const turn = wasRerun ? `Rerun saved. ${solvedTurnStatus()}` : solvedTurnStatus();
        setStatus(splitBits ? `Stopped at ${formatClock(ms)} · ${splitBits}.${moveBits} ${turn}` : `Stopped at ${formatClock(ms)}.${moveBits} ${turn}`);
      } else {
        newScramble();
        const ready = wasRerun ? "Rerun saved. New scramble ready." : "Scramble ready for the next solve.";
        setStatus(
          splitBits
            ? `Stopped at ${formatClock(ms)} · ${splitBits}.${moveBits} ${wasRerun ? "Rerun saved. New scramble ready." : "Scramble ready."}`
            : `Stopped at ${formatClock(ms)}.${moveBits} ${ready}`
        );
      }
    } else {
      state.lastSplits = null;
      state.lastMs = 0;
      paintClock(0);
      updateBestHighlight();
      setStatus("Inspection cancelled");
    }
  }

  function toggle() {
    if (!isActive()) return;
    if (pllOn() && state.phase === "idle" && !state.pllCase) {
      setStatus("Select at least one PLL case");
      return;
    }
    if (state.phase === "running") {
      const elapsed = Date.now() - state.startedAt;
      const result = applySplitTap({
        mode: state.mode,
        marks: state.marks,
        elapsed,
        lastTapElapsed: state.lastTapElapsed,
      });
      if (result.action === "ignore") return;
      state.lastTapElapsed = elapsed;
      if (result.action === "split") {
        state.marks = result.marks;
        setStatus(statusWhileRunning());
        paintSplits(elapsed);
        return;
      }
      stopTiming();
    } else if (state.phase === "inspecting") cancelSession();
    else {
      if (state.awaitingDeal && cubeDrivesTimer() && !pllOn() && !crossOn()) {
        newScramble();
        if (state.phase !== "idle") return;
      }
      startInspection();
    }
  }

  function setMode(mode) {
    if (state.phase !== "idle") return;
    if (!TIMER_MODES.has(mode)) return;
    state.awaitingDeal = false;
    state.previewPb = false;
    const previous = state.mode;
    state.mode = saveTimerMode(mode, store);
    state.lastSplits = null;
    state.lastMs = 0;
    state.marks = [];
    state.pairMarks = [];
    state.layerMarks = emptyLayerMarks();
    state.shadowFacelets = "";
    state.lastMoves = null;
    state.lastScramble = "";
    if (scrambleEl && state.scramble) scrambleEl.textContent = state.scramble;
    paintReconstruction(null);
    paintClock(0);
    syncPllChrome();
    syncSessionControls();
    paintSplits(0);
    if (pllOn()) {
      if (!state.pllCase || !state.pllSelected.includes(state.pllCase.id)) dealPllCase();
      else paintPllCase();
    } else if (crossOn()) {
      if (!state.crossCase) dealNextCross();
      else showCrossCase(state.crossCase, { reveal: false });
    } else if (previous === TIMER_MODE_CROSS || !state.scramble) {
      newScramble();
    }
    renderRecords();
    state.cubeArmed = false;
    paintPostSolve();
    setStatus(statusForIdle());
    syncModeButtons();
    reconsiderCube();
  }

  clockBtn.addEventListener("click", () => {
    toggle();
    clockBtn.blur();
  });
  postSolveEl?.addEventListener("click", (event) => {
    const replay = event.target.closest?.("[data-post-solve-replay]");
    if (replay) {
      event.preventDefault();
      replayHandler?.({ scramble: state.lastScramble, moves: state.lastMoves });
      return;
    }
    if (event.target.closest?.("[data-post-solve-start]")) {
      toggle();
    }
  });
  scrambleEl?.addEventListener("click", () => {
    if (state.phase !== "idle" || crossOn()) return;
    newScramble({ announce: true });
  });
  scrambleLoad?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!loadChosenScramble(scrambleInput?.value || "")) scrambleInput?.focus();
  });
  inspectEl?.addEventListener("change", () => {
    saveInspectionSeconds(inspectEl.value, store, sessionInspectKey());
  });
  chartWindowEl?.addEventListener("change", () => {
    const value = saveChartWindow(chartWindowEl.value, store, sessionChartKey());
    if (pllOn()) state.pllChartWindow = value;
    else if (crossOn()) state.crossChartWindow = value;
    else state.chartWindow = value;
    renderRecords();
  });
  chartEl?.addEventListener("click", (e) => {
    if (!e.target.closest("[data-enlarge-chart]")) return;
    openEnlargedChart();
  });
  chartCloseBtn?.addEventListener("click", () => closeEnlargedChart());
  chartDialog?.addEventListener("click", (e) => {
    if (e.target === chartDialog) closeEnlargedChart();
  });
  chartDialog?.addEventListener("close", () => {
    if (enlargedEl) enlargedEl.innerHTML = "";
  });
  clearBtn?.addEventListener("click", () => {
    const pll = pllOn();
    const cross = crossOn();
    if (pll) {
      if (!loadPllTrainerTimes(store).length) return;
      if (!window.confirm("Clear PLL trainer times?")) return;
      clearPllTrainerTimes(store);
    } else if (cross) {
      if (!loadCrossDrillTimes(store).length) return;
      if (!window.confirm("Clear cross drill times?")) return;
      clearCrossDrillTimes(store);
    } else {
      const existing = loadPracticeTimes(store);
      if (!existing.length) return;
      if (!window.confirm("Clear all timer records?")) return;
      clearPracticeTimes(store);
      onRecordsChanged?.({ reason: "clear", deletedIds: existing.map((row) => row.id) });
    }
    state.lastSplits = null;
    state.lastMs = 0;
    paintClock(0);
    renderRecords();
    paintSplits(0);
    setStatus(pll ? "PLL times cleared" : cross ? "Cross times cleared" : "All times cleared");
  });
  function loadScrambleFromRow(target) {
    const load = target?.closest?.("[data-load-scramble]");
    if (!load || !timesEl.contains(load)) return false;
    const row = loadPracticeTimes(store).find((item) => item.id === load.dataset.loadScramble);
    const loaded = loadChosenScramble(row?.scramble || "");
    if (loaded || state.phase !== "idle") showTimerStage();
    if (document.activeElement === load) load.blur();
    return true;
  }

  timesEl?.addEventListener("keydown", (e) => {
    if (e.code !== "Enter" && e.code !== "Space") return;
    if (!e.target.closest?.("[data-load-scramble]")) return;
    e.preventDefault();
    e.stopPropagation();
  });
  timesEl?.addEventListener("keyup", (e) => {
    if (e.repeat || (e.code !== "Enter" && e.code !== "Space")) return;
    if (!e.target.closest?.("[data-load-scramble]")) return;
    e.preventDefault();
    e.stopPropagation();
    loadScrambleFromRow(e.target);
  });
  timesEl?.addEventListener("click", (e) => {
    if (loadScrambleFromRow(e.target)) return;
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    const id = btn.dataset.delete;
    if (pllOn()) deletePllTrainerTime(id, store);
    else if (crossOn()) deleteCrossDrillTime(id, store);
    else {
      deletePracticeTime(id, store);
      onRecordsChanged?.({ reason: "delete", id });
    }
    renderRecords();
    setStatus("Time deleted");
  });
  crossPanel?.addEventListener("click", (e) => {
    const repeatBtn = e.target.closest("#cross-drill-repeat");
    const nextBtn = e.target.closest("#cross-drill-next");
    const showBtn = e.target.closest("#cross-drill-show");
    if (repeatBtn) {
      if (state.phase !== "idle") return;
      repeatCross();
      repeatBtn.blur();
      return;
    }
    if (nextBtn) {
      if (state.phase !== "idle") return;
      dealNextCross();
      nextBtn.blur();
      return;
    }
    if (showBtn) {
      if (!state.crossCase) return;
      state.crossReveal = !state.crossReveal;
      paintCross();
      showBtn.blur();
    }
  });
  function togglePllReveal(button, panel, showLabel, hideLabel) {
    if (!button || !panel) return;
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    button.textContent = open ? hideLabel : showLabel;
  }

  pllCaseEl?.addEventListener("click", (e) => {
    if (e.target.closest("#pll-trainer-next")) {
      if (state.phase !== "idle") return;
      dealPllCase();
      if (state.cubeArmed) return;
      if (!state.pllCase) {
        setStatus(statusForIdle());
        return;
      }
      const name = caseMark(state.pllCase);
      setStatus(
        state.cubeConnected
          ? `Next case · ${name}. Set it up from solved to arm. Space or tap still starts.`
          : `Next case · ${name}`
      );
      return;
    }
    const pictureBtn = e.target.closest("#pll-trainer-diagram");
    const pictureBody = e.target.closest("#pll-trainer-diagram-body");
    if (pictureBtn || pictureBody) {
      togglePllReveal(
        document.getElementById("pll-trainer-diagram"),
        document.getElementById("pll-trainer-diagram-body"),
        "Show picture",
        "Hide picture"
      );
      return;
    }
    const movesBtn = e.target.closest("#pll-trainer-show-alg");
    if (movesBtn) {
      togglePllReveal(movesBtn, document.getElementById("pll-trainer-alg"), "Show moves", "Hide moves");
    }
  });
  pllCasesEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pll-case]");
    if (!btn || state.phase !== "idle") return;
    setPllSelection(toggleSelectedId(state.pllSelected, btn.dataset.pllCase));
  });
  pllPickEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-pll-preset]");
    if (!btn || state.phase !== "idle") return;
    const ids = presetIds(btn.dataset.pllPreset);
    if (ids) setPllSelection(ids);
  });
  for (const btn of modeBtns) {
    btn.addEventListener("click", () => setMode(btn.dataset.timerMode));
  }
  statsEl?.addEventListener("submit", (event) => {
    const form = event.target?.closest?.("#coach-goal-form");
    if (!form || !statsEl.contains(form)) return;
    event.preventDefault();
    const parsed = parseGoalInput(form.goal?.value);
    if (parsed === undefined) {
      setStatus("Target ao100 is a time in seconds, from 5 to 600.");
      return;
    }
    saveAo100Goal(parsed, store);
    renderRecords();
    setStatus(parsed == null ? "Target ao100 cleared." : `Target ao100 ${formatGoalSeconds(parsed)}s.`);
  });

  function isPllRevealTarget(target) {
    return Boolean(
      target?.closest?.("#pll-trainer-diagram, #pll-trainer-show-alg, #pll-trainer-diagram-body")
    );
  }

  document.addEventListener("keydown", (e) => {
    if (!isActive() || e.code !== "Space") return;
    if (chartDialog?.open || isTypingTarget(e.target) || isPllRevealTarget(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener("keyup", (e) => {
    if (!isActive() || e.repeat || e.code !== "Space") return;
    if (chartDialog?.open || isTypingTarget(e.target) || isPllRevealTarget(e.target)) return;
    e.preventDefault();
    toggle();
  });

  syncSessionControls();
  setPhase("idle");
  syncPllChrome();
  if (pllOn()) dealPllCase();
  else if (crossOn()) dealNextCross();
  else newScramble();
  paintClock(0);
  renderRecords();
  setStatus(statusForIdle());
  const warm = () => {
    try {
      warmCrossSolver();
    } catch {
      /* the next case still builds the table if this was skipped */
    }
  };
  if (typeof requestIdleCallback === "function") requestIdleCallback(warm, { timeout: 1500 });
  else setTimeout(warm, 200);
  maybePreviewSolve();

  return {
    refresh: renderRecords,
    cancel: cancelSession,
    getPhase: () => state.phase,
    getMode: () => state.mode,
    getScramble: () => state.scramble,
    onCubeFacelets,
    onCubeMove,
    setCubeConnected,
    setReplayHandler(fn) {
      replayHandler = typeof fn === "function" ? fn : null;
      paintPostSolve();
    },
  };

  function maybePreviewSolve() {
    let params;
    try {
      params = new URLSearchParams(globalThis.location?.search || "");
    } catch {
      return;
    }
    if (params.get("solvePreview") !== "1") return;
    const sample = previewSolveRecord();
    state.mode = TIMER_MODE_SPLITS;
    state.phase = "idle";
    state.scramble = sample.scramble;
    state.lastMs = sample.ms;
    state.lastSplits = sample.splits;
    state.lastMoves = sample.moves;
    state.lastScramble = sample.scramble;
    state.previewPb = true;
    state.previewPairs = params.get("pairs") === "1";
    state.cubeConnected = true;
    state.awaitingDeal = true;
    state.cubeArmed = false;
    syncModeButtons();
    syncPllChrome();
    paintScrambleHold();
    paintClock(sample.ms);
    paintReconstruction(sample.moves, sample.splits, sample.ms);
    paintPostSolve();
    updateBestHighlight();
    setStatus(`Stopped at ${formatClock(sample.ms)}. ${solvedTurnStatus()}`);
  }
}

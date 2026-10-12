/**
 * Training case sets, queue order, and the cube arm/deal decision.
 * OLL is CubeHead 2-look (oll-trainer). PLL is the timer's case list
 * (pll-case-trainer). Times and custom sets stay in localStorage.
 * The practice timer's PLL mode does not deal a new case on the next turn;
 * training opts into that with `awaitingNext`.
 */

import { invertAlg, invertAlgNotation } from "./alg.js";
import { ollTopDiagram } from "./case-diagram.js";
import { applyAlg, solvedFacelets, sticker } from "./cube.js";
import { faceletsForScramble } from "./cube-reconstruction.js";
import { cubeTimerDecision } from "./move-log.js";
import { OLL_CROSS_ALG, OLL_FINISH_ALGS } from "./oll-trainer.js";
import { listPllTrainerCases } from "./pll-case-trainer.js";

export const TRAINING_SETS_KEY = "cube-coach-training-sets";
export const TRAINING_TIMES_KEY = "cube-coach-training-times";
export const TRAINING_METHOD_KEY = "cube-coach-training-method";
export const TRAINING_MAX = 500;
export const STREAK_DOTS = 4;
export const GOAL_MIN_SAMPLES = 3;
export const STARTER_GOAL_MS = { oll: 8000, pll: 5000 };

const ORDERS = new Set(["fixed", "random", "weakest"]);
const METHODS = new Set(["cfop", "roux", "zz"]);

const OLL_SOURCE = [
  { id: "line", short: "Line", name: "Line", alg: OLL_CROSS_ALG.alg, look: "cross" },
  { id: "l", short: "L", name: "L shape", alg: OLL_CROSS_ALG.algL, look: "cross" },
  { id: "dot", short: "Dot", name: "Dot", alg: OLL_CROSS_ALG.algDot, look: "cross" },
  ...OLL_FINISH_ALGS.map((alg) => ({
    id: alg.id,
    short: alg.name,
    name: alg.name,
    alg: alg.alg,
    look: "corners",
  })),
];

let ollCache = null;
let pllCache = null;

function ollDiagram(alg) {
  const facelets = solvedFacelets();
  applyAlg(facelets, invertAlg(alg));
  return ollTopDiagram({
    edges: [1, 5, 7, 3].map((index) => sticker(facelets, "U", index) === "yellow"),
    corners: [0, 2, 8, 6].map((index) => sticker(facelets, "U", index) === "yellow"),
  });
}

function asTrainingCase(set, source) {
  return {
    set,
    id: source.id,
    short: source.short,
    name: source.name,
    cue: source.cue || "",
    look: source.look || "",
    alg: source.alg,
    algs: [{ id: "primary", label: source.short || "Alg", alg: source.alg }],
    diagram: source.diagram || null,
  };
}

export function listOllCases() {
  if (ollCache) return ollCache;
  ollCache = OLL_SOURCE.map((source) =>
    asTrainingCase("oll", { ...source, diagram: ollDiagram(source.alg) })
  );
  return ollCache;
}

export function listPllCases() {
  if (pllCache) return pllCache;
  pllCache = listPllTrainerCases().map((pllCase) =>
    asTrainingCase("pll", {
      id: pllCase.id,
      short: pllCase.short,
      name: pllCase.name,
      cue: pllCase.cue,
      alg: pllCase.alg,
      diagram: pllCase.diagram,
    })
  );
  return pllCache;
}

export function listCases(set) {
  if (set === "oll") return listOllCases();
  if (set === "pll") return listPllCases();
  return [];
}

export function catalogIds(set) {
  return listCases(set).map((entry) => entry.id);
}

export function caseKey(entry) {
  if (!entry?.set || !entry?.id) return "";
  return `${entry.set}:${entry.id}`;
}

export function normalizeCaseIds(set, raw) {
  const order = catalogIds(set);
  const valid = new Set(order);
  if (!Array.isArray(raw)) return [];
  const picked = new Set();
  for (const id of raw) {
    const key = String(id);
    if (valid.has(key)) picked.add(key);
  }
  return order.filter((id) => picked.has(id));
}

export function toggleCaseId(set, selected, id) {
  const current = normalizeCaseIds(set, selected);
  if (!catalogIds(set).includes(id)) return current;
  const next = current.includes(id) ? current.filter((key) => key !== id) : [...current, id];
  return normalizeCaseIds(set, next);
}

/** The alg to show and to invert into a setup. One stored alg hides the picker. */
export function chooseAlg(trainingCase, algId) {
  const algs = Array.isArray(trainingCase?.algs) ? trainingCase.algs : [];
  if (!algs.length) return null;
  return algs.find((alg) => alg.id === algId) || algs[0];
}

/**
 * Facelets that arm the clock, plus the written inverse for a real cube.
 * Wide turns are expanded so the virtual cube matches the alg.
 */
export function caseTarget(trainingCase, algId) {
  const chosen = chooseAlg(trainingCase, algId);
  const alg = String(chosen?.alg || trainingCase?.alg || "").trim();
  if (!alg) return { alg: "", algId: "", setupNotation: "", facelets: "" };
  return {
    alg,
    algId: chosen?.id || "primary",
    setupNotation: invertAlgNotation(alg),
    facelets: faceletsForScramble(invertAlg(alg)),
  };
}

export function normalizeOrder(order) {
  return ORDERS.has(order) ? order : "random";
}

export function normalizeMethod(method) {
  return METHODS.has(method) ? method : "cfop";
}

function groupsFrom(raw) {
  const source = Array.isArray(raw) ? raw : [];
  const groups = [];
  for (const set of ["oll", "pll"]) {
    const found = source.find((group) => group && group.set === set);
    const caseIds = normalizeCaseIds(set, found?.caseIds);
    if (caseIds.length) groups.push({ set, caseIds });
  }
  return groups;
}

export function builtinTrainingSets() {
  return [
    {
      id: "oll",
      name: "OLL",
      builtin: true,
      order: "random",
      groups: [{ set: "oll", caseIds: catalogIds("oll") }],
    },
    {
      id: "pll",
      name: "PLL",
      builtin: true,
      order: "random",
      groups: [{ set: "pll", caseIds: catalogIds("pll") }],
    },
  ];
}

export function normalizeTrainingSet(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  if (!id || id.length > 48 || id === "oll" || id === "pll" || raw.builtin) return null;
  const name = String(raw.name || "").trim().slice(0, 40);
  if (!name) return null;
  const groups = groupsFrom(raw.groups);
  if (!groups.length) return null;
  return { id, name, builtin: false, order: normalizeOrder(raw.order), groups };
}

export function groupCount(trainingSet, set) {
  const group = trainingSet?.groups?.find((entry) => entry.set === set);
  return group?.caseIds?.length || 0;
}

export function trainingPool(trainingSet) {
  if (!trainingSet) return [];
  const maps = {
    oll: new Map(listOllCases().map((entry) => [entry.id, entry])),
    pll: new Map(listPllCases().map((entry) => [entry.id, entry])),
  };
  const pool = [];
  for (const group of trainingSet.groups || []) {
    const map = maps[group.set];
    if (!map) continue;
    for (const id of group.caseIds || []) {
      const entry = map.get(id);
      if (entry) pool.push(entry);
    }
  }
  return pool;
}

function readJson(store, key) {
  try {
    const raw = store?.getItem?.(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadTrainingSets(store) {
  const saved = readJson(store, TRAINING_SETS_KEY);
  const orders = new Map();
  const custom = [];
  for (const row of saved) {
    if (!row || typeof row !== "object") continue;
    if (row.id === "oll" || row.id === "pll") {
      if (ORDERS.has(row.order)) orders.set(row.id, row.order);
      continue;
    }
    const trainingSet = normalizeTrainingSet(row);
    if (trainingSet && !custom.some((entry) => entry.id === trainingSet.id)) custom.push(trainingSet);
  }
  const builtins = builtinTrainingSets().map((trainingSet) => ({
    ...trainingSet,
    order: orders.get(trainingSet.id) || trainingSet.order,
  }));
  return [...builtins, ...custom];
}

export function saveTrainingSets(sets, store) {
  const payload = [];
  for (const trainingSet of sets || []) {
    if (!trainingSet) continue;
    if (trainingSet.id === "oll" || trainingSet.id === "pll") {
      payload.push({ id: trainingSet.id, builtin: true, order: normalizeOrder(trainingSet.order) });
      continue;
    }
    const normalized = normalizeTrainingSet(trainingSet);
    if (normalized) payload.push(normalized);
  }
  try {
    store?.setItem?.(TRAINING_SETS_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
  return loadTrainingSets(store);
}

export function createTrainingSet({ name, order, groups } = {}, existing = []) {
  const custom = (existing || []).filter((entry) => entry && entry.id !== "oll" && entry.id !== "pll" && !entry.builtin);
  const label = String(name || "").trim().slice(0, 40) || `#${custom.length + 1}`;
  return normalizeTrainingSet({
    id: `set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: label,
    order,
    groups,
  });
}

export function replaceTrainingSet(sets, next) {
  const list = Array.isArray(sets) ? sets.slice() : [];
  if (!next) return list;
  if (next.id === "oll" || next.id === "pll") {
    return list.map((entry) =>
      entry.id === next.id ? { ...entry, order: normalizeOrder(next.order) } : entry
    );
  }
  const normalized = normalizeTrainingSet(next);
  if (!normalized) return list;
  const index = list.findIndex((entry) => entry.id === normalized.id);
  if (index === -1) return [...list, normalized];
  const copy = list.slice();
  copy[index] = normalized;
  return copy;
}

export function withoutTrainingSet(sets, id) {
  if (id === "oll" || id === "pll") return Array.isArray(sets) ? sets.slice() : [];
  return (sets || []).filter((entry) => entry.id !== id);
}

export function loadTrainingMethod(store) {
  try {
    return normalizeMethod(store?.getItem?.(TRAINING_METHOD_KEY));
  } catch {
    return "cfop";
  }
}

export function saveTrainingMethod(method, store) {
  const next = normalizeMethod(method);
  try {
    store?.setItem?.(TRAINING_METHOD_KEY, next);
  } catch {
    /* private mode */
  }
  return next;
}

export function normalizeTrainingTime(row, index = 0) {
  if (!row || typeof row !== "object") return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms <= 0 || ms > 48 * 60 * 60 * 1000) return null;
  const set = row.set === "oll" || row.set === "pll" ? row.set : "";
  const caseId = String(row.caseId || "");
  if (!set || !catalogIds(set).includes(caseId)) return null;
  return {
    id: String(row.id || `t-${index}-${Math.round(ms)}`),
    ms: Math.round(ms),
    at: Number(row.at) || 0,
    set,
    caseId,
    setId: String(row.setId || ""),
    mode: row.mode === "learn" ? "learn" : "drill",
    underGoal: Boolean(row.underGoal),
  };
}

export function loadTrainingTimes(store) {
  return readJson(store, TRAINING_TIMES_KEY).map(normalizeTrainingTime).filter(Boolean);
}

export function saveTrainingTimes(records, store) {
  const trimmed = (Array.isArray(records) ? records : [])
    .map(normalizeTrainingTime)
    .filter(Boolean)
    .slice(-TRAINING_MAX);
  try {
    store?.setItem?.(TRAINING_TIMES_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

export function addTrainingTime(records, entry) {
  const row = normalizeTrainingTime(entry, (records || []).length);
  if (!row) return Array.isArray(records) ? records.slice() : [];
  return [...(records || []), row].slice(-TRAINING_MAX);
}

export function caseTimeStats(records) {
  const map = new Map();
  for (const row of records || []) {
    const ms = Number(row?.ms);
    if ((row?.set !== "oll" && row?.set !== "pll") || !Number.isFinite(ms) || ms <= 0) continue;
    const key = `${row.set}:${row.caseId}`;
    let current = map.get(key);
    if (!current) {
      current = { key, set: row.set, caseId: row.caseId, count: 0, best: Infinity, sum: 0, mean: 0 };
      map.set(key, current);
    }
    current.count += 1;
    current.sum += ms;
    if (ms < current.best) current.best = ms;
    current.mean = current.sum / current.count;
  }
  return map;
}

/**
 * A starter goal until there are a few times, then the median of the recent ones.
 * Beating the median is the streak. Fewer than three times keeps the starter.
 */
export function goalForCase(records, set, caseId) {
  const times = [];
  for (const row of records || []) {
    if (row?.set === set && row?.caseId === caseId && Number(row.ms) > 0) times.push(Number(row.ms));
  }
  const recent = times.slice(-12);
  if (recent.length < GOAL_MIN_SAMPLES) {
    return { ms: STARTER_GOAL_MS[set] || STARTER_GOAL_MS.oll, source: "starter" };
  }
  const sorted = recent.slice().sort((a, b) => a - b);
  return { ms: sorted[Math.floor((sorted.length - 1) / 2)], source: "median" };
}

export function streakDots(streak, dots = STREAK_DOTS) {
  const count = Math.max(0, Math.floor(Number(streak) || 0));
  const size = Math.max(1, Math.floor(Number(dots) || STREAK_DOTS));
  return { streak: count, dots: size, filled: Math.min(size, count) };
}

export function nextStreak(streak, ms, goalMs, dots = STREAK_DOTS) {
  if (!(Number(ms) > 0) || !(Number(goalMs) > 0)) return streakDots(streak, dots);
  if (Number(ms) <= Number(goalMs)) return streakDots((Number(streak) || 0) + 1, dots);
  return streakDots(0, dots);
}

export function trailingStreak(records, setId) {
  const rows = (records || []).filter((row) => row && row.setId === setId);
  let count = 0;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (!rows[i].underGoal) break;
    count += 1;
  }
  return count;
}

/**
 * Next case in the pool.
 * `fixed` walks catalog order. `random` avoids an immediate repeat.
 * `weakest` prefers a case with no times, then the slowest mean.
 */
export function pickTrainingCase({
  pool,
  order = "random",
  cursor = 0,
  previousKey = "",
  stats = new Map(),
  random = Math.random,
} = {}) {
  const list = Array.isArray(pool) ? pool.filter(Boolean) : [];
  if (!list.length) return null;
  const mode = normalizeOrder(order);
  if (mode === "fixed") {
    const index = previousKey
      ? (Math.max(0, Number(cursor) || 0) + 1) % list.length
      : Math.min(list.length - 1, Math.max(0, Number(cursor) || 0));
    return { trainingCase: list[index], cursor: index };
  }
  if (mode === "weakest") {
    let chosen = null;
    let chosenScore = -1;
    let chosenIndex = 0;
    list.forEach((entry, index) => {
      if (list.length > 1 && caseKey(entry) === previousKey) return;
      const row = stats.get?.(caseKey(entry));
      const score = row && row.count > 0 ? row.mean : Number.POSITIVE_INFINITY;
      if (score > chosenScore) {
        chosenScore = score;
        chosen = entry;
        chosenIndex = index;
      }
    });
    if (!chosen) return { trainingCase: list[0], cursor: 0 };
    return { trainingCase: chosen, cursor: chosenIndex };
  }
  const choices = list.length > 1 && previousKey ? list.filter((entry) => caseKey(entry) !== previousKey) : list;
  const bag = choices.length ? choices : list;
  const roll = Number(random());
  const offset = Number.isFinite(roll) ? Math.min(bag.length - 1, Math.max(0, Math.floor(roll * bag.length))) : 0;
  const trainingCase = bag[offset];
  return { trainingCase, cursor: Math.max(0, list.indexOf(trainingCase)) };
}

/**
 * Cube path for one training case.
 * Arms on the case setup and stops when solved, same as PLL cases.
 * After a success, the next turn deals another case, same as a timed solve.
 */
export function trainingCubeDecision({
  phase = "idle",
  armed = false,
  facelets = "",
  target = "",
  solved = false,
  move = "",
  sawMove = false,
  wasUnsolved = false,
  awaitingNext = false,
} = {}) {
  if (awaitingNext && phase === "idle" && move) return { action: "deal" };
  if (awaitingNext && phase === "idle") return { action: "ignore" };
  return cubeTimerDecision({
    phase,
    mode: "pll",
    armed,
    inspectionSeconds: 0,
    facelets,
    target,
    solved,
    move,
    sawMove,
    wasUnsolved,
    hold: false,
    awaitingScramble: false,
  });
}

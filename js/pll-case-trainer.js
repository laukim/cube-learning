/**
 * PLL case trainer for the timer page.
 * Cases come from Cases I know (pll-known.js). T, Y, Ub, H, and Z use the
 * same moves as 2-look. The one Ua chip uses the 2-look Ua (PLL_U), not the
 * different Cases I know Ua. Diagrams are the in-app recognition drawings.
 */

import { invertAlgNotation } from "./alg.js";
import { renderCaseDiagram } from "./case-diagram.js";
import { PLL_KNOWN_CASES, knownPllDiagram } from "./pll-known.js";
import { PLL_U } from "./pll-trainer.js";
import { formatClock } from "./solve-timer.js";

export const PLL_TRAINER_CASES_KEY = "cube-coach-pll-trainer-cases";
export const PLL_TRAINER_TIMES_KEY = "cube-coach-pll-trainer-times";
export const PLL_TRAINER_MAX = 500;

/** 2-look order. Ua is PLL_U, not the Cases I know Ua. */
export const TWO_LOOK_CASE_IDS = ["t", "y", "ua", "ub", "h", "z"];
const TWO_LOOK_SHARED = new Set(TWO_LOOK_CASE_IDS);

/**
 * Side colours after the 2-look Ua inverse, in diagram order
 * (F left→right, R back→front, B left→right, L front→back).
 * Corners are solved. Edges cycle UR → UL → UB.
 */
export const TWO_LOOK_UA_SIDES = {
  B: ["green", "orange", "green"],
  L: ["orange", "red", "orange"],
  R: ["red", "green", "red"],
  F: ["blue", "blue", "blue"],
};

const TWO_LOOK_UA_CUE = "Solved bar on the front";

function twoLookUaDiagram() {
  return {
    type: "pll-recog",
    caption: `Ua · ${TWO_LOOK_UA_CUE} · back ↑`,
    sides: TWO_LOOK_UA_SIDES,
    edges: { cycle: ["UR", "UL", "UB"] },
    corners: {},
  };
}

function browserStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function knownTrainerCase(pllCase) {
  const shared = TWO_LOOK_SHARED.has(pllCase.id);
  const useTwoLookUa = pllCase.id === "ua";
  return {
    id: pllCase.id,
    short: pllCase.short,
    name: pllCase.name,
    cue: useTwoLookUa ? TWO_LOOK_UA_CUE : pllCase.cue,
    note: "",
    alg: useTwoLookUa ? PLL_U.alg : pllCase.alg,
    algDisplay: useTwoLookUa ? PLL_U.alg : pllCase.algDisplay || pllCase.alg,
    set: shared ? "both" : "known",
    diagram: useTwoLookUa ? twoLookUaDiagram() : knownPllDiagram(pllCase),
  };
}

let cachedCases = null;

export function listPllTrainerCases() {
  if (cachedCases) return cachedCases;
  const known = PLL_KNOWN_CASES.map(knownTrainerCase);
  const byId = new Map(known.map((c) => [c.id, c]));
  const ordered = [];
  const seen = new Set();
  const add = (pllCase) => {
    if (!pllCase || seen.has(pllCase.id)) return;
    seen.add(pllCase.id);
    ordered.push(pllCase);
  };
  for (const id of TWO_LOOK_CASE_IDS) add(byId.get(id));
  for (const pllCase of known) add(pllCase);
  cachedCases = ordered;
  return cachedCases;
}

export function trainerCaseById(id) {
  return listPllTrainerCases().find((c) => c.id === id) || null;
}

export function caseMark(entry) {
  if (!entry) return "";
  return entry.short || "";
}

function canonicalCaseId(id) {
  return id === "ua2" ? "ua" : id;
}

export function caseSetupMoves(alg) {
  return invertAlgNotation(alg);
}

export function presetIds(preset) {
  if (preset === "two") return [...TWO_LOOK_CASE_IDS];
  if (preset === "all") return listPllTrainerCases().map((c) => c.id);
  if (preset === "none") return [];
  return null;
}

export function sameIdSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const have = new Set(a);
  return b.every((id) => have.has(id));
}

export function normalizeSelectedIds(raw) {
  const valid = new Set(listPllTrainerCases().map((c) => c.id));
  if (!Array.isArray(raw)) return [...TWO_LOOK_CASE_IDS];
  const ids = [];
  for (const id of raw) {
    const key = canonicalCaseId(String(id));
    if (valid.has(key) && !ids.includes(key)) ids.push(key);
  }
  return ids;
}

export function loadPllSelection(store = browserStore()) {
  try {
    const raw = store?.getItem?.(PLL_TRAINER_CASES_KEY);
    if (raw == null || raw === "") return [...TWO_LOOK_CASE_IDS];
    return normalizeSelectedIds(JSON.parse(raw));
  } catch {
    return [...TWO_LOOK_CASE_IDS];
  }
}

export function savePllSelection(ids, store = browserStore()) {
  const next = normalizeSelectedIds(ids);
  try {
    store?.setItem?.(PLL_TRAINER_CASES_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  return next;
}

export function toggleSelectedId(selected, id) {
  const current = normalizeSelectedIds(selected);
  if (!listPllTrainerCases().some((c) => c.id === id)) return current;
  return current.includes(id) ? current.filter((key) => key !== id) : [...current, id];
}

export function pickTrainerCase(cases, selectedIds, { previousId = "", random = Math.random } = {}) {
  const ids = new Set(normalizeSelectedIds(selectedIds));
  const pool = (cases || listPllTrainerCases()).filter((c) => ids.has(c.id));
  if (!pool.length) return null;
  const choices = pool.length > 1 && previousId ? pool.filter((c) => c.id !== previousId) : pool;
  const bag = choices.length ? choices : pool;
  const index = Math.min(bag.length - 1, Math.max(0, Math.floor(Number(random()) * bag.length) || 0));
  return bag[index];
}

function normalizePllRecord(row, index) {
  if (!row || typeof row !== "object") return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const caseId = canonicalCaseId(String(row.caseId || ""));
  if (!caseId) return null;
  return {
    id: String(row.id || `p-${index}-${ms}`),
    ms,
    at: Number(row.at) || 0,
    caseId,
    short: caseId === "ua" ? "Ua" : String(row.short || caseId),
    name: String(row.name || ""),
  };
}

export function loadPllTrainerTimes(store = browserStore()) {
  try {
    const raw = store?.getItem?.(PLL_TRAINER_TIMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizePllRecord).filter(Boolean);
  } catch {
    return [];
  }
}

export function savePllTrainerTimes(records, store = browserStore()) {
  const trimmed = (Array.isArray(records) ? records : []).slice(-PLL_TRAINER_MAX);
  try {
    store?.setItem?.(PLL_TRAINER_TIMES_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

export function addPllTrainerTime(entry, store = browserStore()) {
  const records = loadPllTrainerTimes(store);
  const ms = Number(entry?.ms);
  const caseId = String(entry?.caseId || "");
  if (!Number.isFinite(ms) || ms <= 0 || !caseId) return records;
  records.push({
    id: String(entry.id || `p-${Date.now()}-${records.length}`),
    ms,
    at: Number(entry.at) || Date.now(),
    caseId: canonicalCaseId(caseId),
    short: String(entry.short || caseId),
    name: String(entry.name || ""),
  });
  return savePllTrainerTimes(records, store);
}

export function deletePllTrainerTime(id, store = browserStore()) {
  return savePllTrainerTimes(
    loadPllTrainerTimes(store).filter((row) => row.id !== id),
    store
  );
}

export function clearPllTrainerTimes(store = browserStore()) {
  return savePllTrainerTimes([], store);
}

export function summarizePllAttempts(records) {
  const map = new Map();
  for (const row of records || []) {
    if (!row?.caseId || !Number.isFinite(row.ms)) continue;
    let cur = map.get(row.caseId);
    if (!cur) {
      cur = {
        caseId: row.caseId,
        short: row.short,
        name: row.name,
        count: 0,
        best: Infinity,
        sum: 0,
      };
      map.set(row.caseId, cur);
    }
    cur.count += 1;
    cur.sum += row.ms;
    if (row.ms < cur.best) cur.best = row.ms;
  }
  const order = new Map(listPllTrainerCases().map((c, i) => [c.id, i]));
  return [...map.values()]
    .map((row) => ({ ...row, mean: row.sum / row.count }))
    .sort((a, b) => (order.get(a.caseId) ?? 99) - (order.get(b.caseId) ?? 99));
}

function chipHtml(pllCase, selected, currentId) {
  const on = selected.has(pllCase.id);
  const current = pllCase.id === currentId;
  const label = escapeHtml(pllCase.short);
  const title = pllCase.note ? `${pllCase.name}. ${pllCase.note}` : `${pllCase.name}. ${pllCase.cue}`;
  return `<button type="button" class="pll-case-chip${on ? " is-on" : ""}${current ? " is-current" : ""}" data-pll-case="${escapeHtml(pllCase.id)}" aria-pressed="${on ? "true" : "false"}" title="${escapeHtml(title)}">${label}</button>`;
}

export function renderPllCasePicker(selectedIds, currentId = "") {
  const selected = new Set(normalizeSelectedIds(selectedIds));
  const cases = listPllTrainerCases();
  const byId = new Map(cases.map((c) => [c.id, c]));
  const chips = (ids) => ids.map((id) => chipHtml(byId.get(id), selected, currentId)).join("");
  const rest = PLL_KNOWN_CASES.map((c) => c.id).filter((id) => !TWO_LOOK_SHARED.has(id));
  return `<div class="pll-pick-group">
      <p class="pll-pick-label">2-look</p>
      <div class="pll-pick-chips">${chips(TWO_LOOK_CASE_IDS)}</div>
    </div>
    <div class="pll-pick-chips">${chips(rest)}</div>`;
}

export function renderTrainerCase(pllCase) {
  if (!pllCase) {
    return `<p class="pll-trainer-empty">Select at least one PLL case.</p>`;
  }
  const title = escapeHtml(pllCase.short);
  const note = pllCase.note ? `<p class="pll-trainer-note">${escapeHtml(pllCase.note)}</p>` : "";
  const moves = escapeHtml(pllCase.algDisplay || pllCase.alg);
  const setup = escapeHtml(caseSetupMoves(pllCase.alg));
  return `<div class="pll-trainer-picture">
      <button type="button" class="btn btn-ghost btn-small pll-trainer-reveal" id="pll-trainer-diagram" aria-expanded="false" aria-controls="pll-trainer-diagram-body">Show picture</button>
      <div class="pll-trainer-diagram" id="pll-trainer-diagram-body" hidden>${renderCaseDiagram(pllCase.diagram)}</div>
    </div>
    <div class="pll-trainer-copy">
      <h2 class="pll-trainer-name">${title}</h2>
      <p class="pll-trainer-fullname">${escapeHtml(pllCase.name)}</p>
      <p class="pll-trainer-cue">${escapeHtml(pllCase.cue)}</p>
      ${note}
      <button type="button" class="btn btn-ghost btn-small pll-trainer-reveal" id="pll-trainer-show-alg" aria-expanded="false" aria-controls="pll-trainer-alg">Show moves</button>
      <code class="alg pll-trainer-alg" id="pll-trainer-alg" hidden>${moves}</code>
      <div class="pll-trainer-setup">
        <p class="pll-trainer-setup-kicker">From a solved cube</p>
        <code class="alg">${setup}</code>
      </div>
      <button type="button" class="btn btn-ghost btn-small" id="pll-trainer-next">Another case</button>
    </div>`;
}

export function renderPllTimesList(records) {
  if (!records?.length) {
    return `<p class="timer-times-empty">Times for each PLL case will appear here</p>`;
  }
  const best = records.reduce((min, row) => Math.min(min, row.ms), Infinity);
  const items = [...records]
    .reverse()
    .map((row, i) => {
      const bestCls = row.ms === best && row.ms > 0 ? " is-best" : "";
      const label = caseMark(row);
      return `<li data-id="${escapeHtml(row.id)}">
        <div class="timer-time-row timer-time-row-pll">
          <span class="timer-time-index">#${records.length - i}</span>
          <span class="timer-time-case">${escapeHtml(label)}</span>
          <span class="timer-time-ms${bestCls}">${formatClock(row.ms)}</span>
          <button type="button" class="timer-time-delete" data-delete="${escapeHtml(row.id)}" aria-label="Delete ${escapeHtml(label)} ${formatClock(row.ms)}">×</button>
        </div>
        <span class="timer-time-case-name">${escapeHtml(row.name)}</span>
      </li>`;
    })
    .join("");
  return `<ol class="timer-times-list">${items}</ol>`;
}

export function renderPllCaseSummary(records) {
  const rows = summarizePllAttempts(records);
  if (!rows.length) return "";
  const cards = rows
    .map(
      (row) => `<li>
        <span class="pll-case-stats-name">${escapeHtml(caseMark(row))}</span>
        <strong>${formatClock(row.best)}</strong>
        <span class="pll-case-stats-meta">avg ${formatClock(row.mean)} · ${row.count}</span>
      </li>`
    )
    .join("");
  return `<h2 class="timer-times-title">By case</h2><ul class="pll-case-stats">${cards}</ul>`;
}

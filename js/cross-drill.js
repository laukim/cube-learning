/**
 * Cross drill times. Stored apart from full solves so they stay out of
 * solve averages and the Google sync (that sync only reads practice times).
 */

import { formatSolvedAt, sortSolves } from "./solve-order.js";
import { formatClock } from "./solve-timer.js";

export const CROSS_DRILL_TIMES_KEY = "cube-coach-cross-drill-times";
export const CROSS_DRILL_INSPECT_KEY = "cube-coach-cross-drill-inspect";
export const CROSS_DRILL_CHART_WINDOW_KEY = "cube-coach-cross-drill-chart-window";
export const CROSS_DRILL_MAX = 500;

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

function normalizeCrossRecord(row, index) {
  if (!row || typeof row !== "object") return null;
  const ms = Number(row.ms);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const record = {
    id: String(row.id || `c-${index}-${ms}`),
    ms,
    at: Number(row.at) || 0,
    scramble: String(row.scramble || ""),
  };
  const length = Number(row.length);
  if (Number.isFinite(length) && length > 0) record.length = length;
  return record;
}

export function loadCrossDrillTimes(store = browserStore()) {
  try {
    const raw = store?.getItem?.(CROSS_DRILL_TIMES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return sortSolves(parsed.map(normalizeCrossRecord).filter(Boolean));
  } catch {
    return [];
  }
}

export function saveCrossDrillTimes(records, store = browserStore()) {
  const trimmed = sortSolves(records).slice(-CROSS_DRILL_MAX);
  try {
    store?.setItem?.(CROSS_DRILL_TIMES_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

function newCrossId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `c-${Date.now().toString(36)}-${rand}`;
}

export function addCrossDrillTime(entry, store = browserStore()) {
  const records = loadCrossDrillTimes(store);
  const ms = Number(entry?.ms);
  if (!Number.isFinite(ms) || ms <= 0) return records;
  const atNumber = Number(entry?.at);
  const record = {
    id: String(entry?.id || newCrossId()),
    ms,
    at: Number.isFinite(atNumber) && atNumber > 0 ? Math.round(atNumber) : Date.now(),
    scramble: String(entry?.scramble || ""),
  };
  const length = Number(entry?.length);
  if (Number.isFinite(length) && length > 0) record.length = length;
  if (entry && typeof entry === "object") entry.id = record.id;
  records.push(record);
  return saveCrossDrillTimes(records, store);
}

export function deleteCrossDrillTime(id, store = browserStore()) {
  return saveCrossDrillTimes(
    loadCrossDrillTimes(store).filter((row) => row.id !== id),
    store
  );
}

export function clearCrossDrillTimes(store = browserStore()) {
  return saveCrossDrillTimes([], store);
}

/** Times list shows the scramble, not the optimal solution, so Repeat is not spoiled. */
export function renderCrossTimesList(records) {
  const ordered = sortSolves(records);
  if (!ordered.length) {
    return `<p class="timer-times-empty">Cross drill times will appear here</p>`;
  }
  const best = ordered.reduce((min, row) => (row.ms > 0 && row.ms < min ? row.ms : min), Infinity);
  const items = [...ordered]
    .reverse()
    .map((row, i) => {
      const when = formatSolvedAt(row.at);
      const whenHtml = when
        ? `<time class="timer-time-when" datetime="${escapeHtml(new Date(row.at).toISOString())}">${escapeHtml(when)}</time>`
        : "";
      const bestCls = row.ms === best && row.ms > 0 ? " is-best" : "";
      const scramble = row.scramble
        ? `<code class="timer-time-scramble">${escapeHtml(row.scramble)}</code>`
        : "";
      return `<li data-id="${escapeHtml(row.id)}">
        <div class="timer-time-row">
          <span class="timer-time-index">#${ordered.length - i}</span>
          <span class="timer-time-ms${bestCls}">${formatClock(row.ms)}${whenHtml}</span>
          <button type="button" class="timer-time-delete" data-delete="${escapeHtml(row.id)}" aria-label="Delete ${formatClock(row.ms)}">×</button>
        </div>
        ${scramble}
      </li>`;
    })
    .join("");
  return `<ol class="timer-times-list">${items}</ol>`;
}

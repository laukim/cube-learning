import { randomScrambleMoves } from "./cube.js?v=timer3";
import { formatClock } from "./solve-timer.js?v=splits1";

export const PRACTICE_TIMES_KEY = "cube-coach-practice-times";
export const PRACTICE_INSPECT_KEY = "cube-coach-practice-inspect";
export const PRACTICE_MODE_KEY = "cube-coach-practice-mode";
export const PRACTICE_MAX = 500;
export const TIMER_MODE_SINGLE = "single";
export const TIMER_MODE_SPLITS = "splits";
export const SPLIT_BOUNCE_MS = 150;

export const SPLIT_STEPS = [
  { id: "cross", short: "Cross", title: "White cross" },
  { id: "f2l", short: "F2L", title: "F2L" },
  { id: "final", short: "Final", title: "Final" },
];

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
  return parsed
    .map((row, i) => normalizeRecord(row, i))
    .filter(Boolean);
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
  return record;
}

export function normalizeSplits(raw) {
  if (!raw || typeof raw !== "object") return null;
  const cross = Number(raw.cross);
  const f2l = Number(raw.f2l);
  const final = Number(raw.final);
  if (![cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { cross, f2l, final };
}

export function loadTimerMode(store = browserStore()) {
  const raw = store?.getItem?.(PRACTICE_MODE_KEY);
  return raw === TIMER_MODE_SPLITS ? TIMER_MODE_SPLITS : TIMER_MODE_SINGLE;
}

export function saveTimerMode(mode, store = browserStore()) {
  const value = mode === TIMER_MODE_SPLITS ? TIMER_MODE_SPLITS : TIMER_MODE_SINGLE;
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

export function liveSplitDurations(marks = [], elapsed = 0, { running = false, splits = null } = {}) {
  if (splits) return { ...splits };
  const out = { cross: null, f2l: null, final: null };
  const crossMark = marks[0];
  const f2lMark = marks[1];
  if (crossMark != null) out.cross = Math.max(0, crossMark);
  else if (running) out.cross = Math.max(0, elapsed);

  if (f2lMark != null) out.f2l = Math.max(0, f2lMark - (crossMark || 0));
  else if (running && crossMark != null) out.f2l = Math.max(0, elapsed - crossMark);

  if (f2lMark != null && (running || elapsed >= f2lMark)) {
    out.final = Math.max(0, elapsed - f2lMark);
  }
  return out;
}

export function renderLiveSplits({ marks = [], elapsed = 0, running = false, splits = null } = {}) {
  const durations = liveSplitDurations(marks, elapsed, { running, splits });
  const liveIndex = running ? currentSplitIndex(marks) : -1;
  return SPLIT_STEPS.map((step, i) => {
    const ms = durations[step.id];
    const isLive = i === liveIndex;
    const shown = ms != null ? formatClock(ms) : "—";
    const cls = isLive ? "is-live" : ms != null ? "is-done" : "";
    return `<li${cls ? ` class="${cls}"` : ""}><span>${step.short}</span><strong>${shown}</strong></li>`;
  }).join("");
}

export function savePracticeTimes(records, store = browserStore()) {
  const trimmed = (Array.isArray(records) ? records : []).slice(-PRACTICE_MAX);
  try {
    store?.setItem?.(PRACTICE_TIMES_KEY, JSON.stringify(trimmed));
  } catch {
    /* quota / private mode */
  }
  return trimmed;
}

export function addPracticeTime(entry, store = browserStore()) {
  const records = loadPracticeTimes(store);
  const ms = Number(entry?.ms);
  if (!Number.isFinite(ms) || ms <= 0) return records;
  const record = {
    id: String(entry.id || `t-${Date.now()}-${records.length}`),
    ms,
    at: Number(entry.at) || Date.now(),
    scramble: String(entry.scramble || ""),
  };
  const splits = normalizeSplits(entry.splits);
  if (splits) record.splits = splits;
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

export function loadInspectionSeconds(store = browserStore()) {
  const raw = store?.getItem?.(PRACTICE_INSPECT_KEY);
  const n = Number(raw);
  return [0, 3, 5, 10, 15].includes(n) ? n : 0;
}

export function saveInspectionSeconds(seconds, store = browserStore()) {
  const n = Number(seconds);
  const value = [0, 3, 5, 10, 15].includes(n) ? n : 0;
  try {
    store?.setItem?.(PRACTICE_INSPECT_KEY, String(value));
  } catch {
    /* ignore */
  }
  return value;
}

export function generatePracticeScramble(moves = 20) {
  return randomScrambleMoves(moves);
}

export function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

/** WCA-style average: drop best and worst, mean of the rest. Needs at least 5. */
export function averageOf(values, n) {
  if (!Array.isArray(values) || values.length < n || n < 3) return null;
  const window = values.slice(-n);
  const sorted = [...window].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return mean(trimmed);
}

export function rollingAverages(values, n) {
  return values.map((_, i) => (i + 1 < n ? null : averageOf(values.slice(0, i + 1), n)));
}

/** Clock time when Cross / F2L finished (F2L is Cross + F2L duration). */
export function splitFinishTimes(splits) {
  if (!splits) return null;
  const cross = Number(splits.cross);
  const f2l = Number(splits.f2l);
  if (!Number.isFinite(cross) || cross < 0 || !Number.isFinite(f2l) || f2l < 0) return null;
  return { cross, f2l: cross + f2l };
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
  const stages = SPLIT_STEPS.map((step) => {
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

export function computeStats(records) {
  const times = (records || []).map((r) => r.ms).filter((ms) => Number.isFinite(ms) && ms > 0);
  const empty = {
    count: 0,
    mean: null,
    best: null,
    worst: null,
    trimmed: null,
    ao5: null,
    ao12: null,
    splits: null,
  };
  if (!times.length) return { ...empty, splits: computeSplitStats(records) };

  const sorted = [...times].sort((a, b) => a - b);
  return {
    count: times.length,
    mean: mean(times),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    trimmed: times.length >= 3 ? mean(sorted.slice(1, -1)) : null,
    ao5: averageOf(times, 5),
    ao12: averageOf(times, 12),
    splits: computeSplitStats(records),
  };
}

export function renderProgressChart(records, { width = 420, height = 180 } = {}) {
  const rows = chartRows(records);
  const times = rows.map((row) => row.ms);
  if (times.length < 2) {
    return `<div class="timer-chart-empty">Solve twice and a progress chart appears here — singles, ao5, ao12, and Cross / F2L finish times.</div>`;
  }

  const crossFinish = rows.map((row) => splitFinishTimes(row.splits)?.cross ?? null);
  const f2lFinish = rows.map((row) => splitFinishTimes(row.splits)?.f2l ?? null);
  const hasSplitSeries = crossFinish.some((ms) => ms != null) || f2lFinish.some((ms) => ms != null);

  const pad = { t: 16, r: 12, b: 28, l: 44 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ao5 = rollingAverages(times, 5);
  const ao12 = rollingAverages(times, 12);
  const plotted = times.concat(
    ao5.filter((n) => n != null),
    ao12.filter((n) => n != null),
    crossFinish.filter((n) => n != null),
    f2lFinish.filter((n) => n != null)
  );
  const min = Math.min(...plotted);
  const max = Math.max(...plotted);
  const span = Math.max(50, max - min);
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const range = hi - lo || 1;

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

  const ticks = 3;
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
    series
      .map((ms, i) => {
        if (ms == null) return "";
        return `<circle class="${className}" cx="${xAt(i).toFixed(1)}" cy="${yAt(ms).toFixed(1)}" r="2.6"><title>Solve ${i + 1} ${label}: ${formatClock(ms)}</title></circle>`;
      })
      .join("");

  const dots = seriesDots(times, "timer-chart-dot", "single");
  const crossDots = seriesDots(crossFinish, "timer-chart-dot-cross", "Cross");
  const f2lDots = seriesDots(f2lFinish, "timer-chart-dot-f2l", "F2L");

  const ao5Path = line(ao5);
  const ao12Path = line(ao12);
  const crossPath = line(crossFinish);
  const f2lPath = line(f2lFinish);
  const aria = hasSplitSeries
    ? "Solve times over session, with Cross and F2L finish times"
    : "Solve times over session";

  const splitLegend = hasSplitSeries
    ? `<li><span class="swatch swatch-cross"></span>Cross</li>
    <li><span class="swatch swatch-f2l"></span>F2L</li>`
    : "";

  return `<svg class="timer-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}">
    ${grid.join("")}
    <path class="timer-chart-singles" d="${line(times)}" fill="none" />
    ${ao5Path ? `<path class="timer-chart-ao5" d="${ao5Path}" fill="none" />` : ""}
    ${ao12Path ? `<path class="timer-chart-ao12" d="${ao12Path}" fill="none" />` : ""}
    ${crossPath ? `<path class="timer-chart-cross" d="${crossPath}" fill="none" />` : ""}
    ${f2lPath ? `<path class="timer-chart-f2l" d="${f2lPath}" fill="none" />` : ""}
    ${dots}
    ${crossDots}
    ${f2lDots}
    <text class="timer-chart-axis" x="${pad.l}" y="${height - 8}">1</text>
    <text class="timer-chart-axis timer-chart-axis-end" x="${width - pad.r}" y="${height - 8}">${times.length}</text>
  </svg>
  <ul class="timer-chart-legend">
    <li><span class="swatch swatch-single"></span>Single</li>
    <li><span class="swatch swatch-ao5"></span>ao5</li>
    <li><span class="swatch swatch-ao12"></span>ao12</li>
    ${splitLegend}
  </ul>`;
}

function dash(ms) {
  return ms == null ? "—" : formatClock(ms);
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
  if (!records.length) {
    return `<p class="timer-times-empty">Your solve times will appear here</p>`;
  }
  const items = [...records]
    .reverse()
    .map((row, i) => {
      const scramble = row.scramble
        ? `<code class="timer-time-scramble">${escapeHtml(row.scramble)}</code>`
        : "";
      const splits = row.splits
        ? `<div class="timer-time-splits">${SPLIT_STEPS.map(
            (step) =>
              `<span><em>${step.short}</em> ${formatClock(row.splits[step.id])}</span>`
          ).join("")}</div>`
        : "";
      return `<li data-id="${escapeHtml(row.id)}">
        <div class="timer-time-row">
          <span class="timer-time-index">#${records.length - i}</span>
          <span class="timer-time-ms">${formatClock(row.ms)}</span>
          <button type="button" class="timer-time-delete" data-delete="${escapeHtml(row.id)}" aria-label="Delete ${formatClock(row.ms)}">×</button>
        </div>
        ${splits}
        ${scramble}
      </li>`;
    })
    .join("");
  return `<ol class="timer-times-list">${items}</ol>`;
}

export function renderStats(stats) {
  const rows = [
    ["Solves", String(stats.count || 0)],
    ["Average", dash(stats.mean)],
    ["Best", dash(stats.best)],
    ["Worst", dash(stats.worst)],
    ["Trimmed", dash(stats.trimmed)],
    ["ao5", dash(stats.ao5)],
    ["ao12", dash(stats.ao12)],
  ];
  return rows
    .map(
      ([label, value]) => `<div class="timer-stat">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>`
    )
    .join("");
}

export function renderSplitStats(splitStats) {
  if (!splitStats?.stages?.length) return "";
  const totalMean = splitStats.stages.reduce((sum, stage) => sum + stage.mean, 0) || 1;
  const rows = splitStats.stages
    .map((stage) => {
      const pct = Math.max(8, Math.round((stage.mean / totalMean) * 100));
      const slow = stage.id === splitStats.slowestId ? " is-slowest" : "";
      return `<div class="timer-split-avg${slow}">
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
  return Boolean(el?.closest?.("input, select, textarea, [contenteditable=true]"));
}

function idleStatus(mode) {
  return mode === TIMER_MODE_SPLITS
    ? "Space or tap to start · space or tap again at Cross, F2L, then solved"
    : "Space or tap to start · next scramble appears when you stop";
}

function runningStatus(mode, marks = []) {
  if (mode !== TIMER_MODE_SPLITS) return "Timing — space or tap to stop";
  const next = SPLIT_STEPS[currentSplitIndex(marks)];
  if (next.id === "cross") return "Timing — space or tap when white cross is done";
  if (next.id === "f2l") return "Timing — space or tap when F2L is done";
  return "Timing — space or tap when solved";
}

export function initPracticeTimer({
  store = browserStore(),
  isActive = () => false,
} = {}) {
  const clockBtn = document.getElementById("practice-clock");
  const clockValue = document.getElementById("practice-clock-value");
  const scrambleEl = document.getElementById("practice-scramble");
  const statusEl = document.getElementById("practice-status");
  const timesEl = document.getElementById("timer-times");
  const statsEl = document.getElementById("timer-stats");
  const splitStatsEl = document.getElementById("timer-split-stats");
  const chartEl = document.getElementById("timer-chart");
  const inspectEl = document.getElementById("timer-inspect");
  const clearBtn = document.getElementById("timer-clear");
  const splitsEl = document.getElementById("practice-splits");
  const modeBtns = [...document.querySelectorAll("[data-timer-mode]")];

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
    lastTapElapsed: 0,
    lastSplits: null,
  };

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
    const show = state.mode === TIMER_MODE_SPLITS;
    splitsEl.hidden = !show;
    if (!show) return;
    const running = state.phase === "running";
    const inspecting = state.phase === "inspecting";
    splitsEl.innerHTML = renderLiveSplits({
      marks: inspecting ? [] : state.marks,
      elapsed: running ? elapsed : elapsed || 0,
      running,
      splits: running || inspecting ? null : state.lastSplits,
    });
  }

  function paintClock(ms, inspecting = false) {
    if (inspecting) {
      clockValue.textContent = String(Math.max(0, ms));
      paintSplits(0);
      return;
    }
    const { m, s, centi } = formatTimerParts(ms);
    clockValue.innerHTML = `${m}<span class="practice-colon">:</span>${s}<span class="practice-centi">${centi}</span>`;
    paintSplits(ms);
  }

  function newScramble({ announce = false } = {}) {
    state.scramble = generatePracticeScramble();
    if (scrambleEl) scrambleEl.textContent = state.scramble;
    if (announce) setStatus("New scramble");
  }

  function renderRecords() {
    const records = loadPracticeTimes(store);
    const stats = computeStats(records);
    if (timesEl) timesEl.innerHTML = renderTimesList(records);
    if (statsEl) statsEl.innerHTML = renderStats(stats);
    if (splitStatsEl) splitStatsEl.innerHTML = renderSplitStats(stats.splits);
    if (chartEl) chartEl.innerHTML = renderProgressChart(records);
    if (clearBtn) clearBtn.disabled = records.length === 0;
  }

  function cancelTimers() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    window.clearInterval(state.inspectTimer);
    state.inspectTimer = 0;
  }

  function cancelSession() {
    cancelTimers();
    setPhase("idle");
    state.startedAt = 0;
    state.marks = [];
    state.lastTapElapsed = 0;
    state.lastSplits = null;
    paintClock(0);
    setStatus(idleStatus(state.mode));
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
    state.lastTapElapsed = 0;
    state.lastSplits = null;
    setStatus(runningStatus(state.mode, state.marks));
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
      const splits =
        state.mode === TIMER_MODE_SPLITS && state.marks.length >= SPLIT_STEPS.length - 1
          ? splitDurationsFromMarks(state.marks, ms)
          : null;
      state.lastSplits = splits;
      paintClock(ms);
      addPracticeTime({ ms, at: Date.now(), scramble: state.scramble, splits }, store);
      renderRecords();
      newScramble();
      const splitBits = splits
        ? SPLIT_STEPS.map((step) => `${step.short} ${formatClock(splits[step.id])}`).join(" · ")
        : "";
      setStatus(
        splitBits
          ? `Stopped at ${formatClock(ms)} · ${splitBits}. Scramble ready.`
          : `Stopped at ${formatClock(ms)}. Scramble ready for the next solve.`
      );
      state.marks = [];
      state.lastTapElapsed = 0;
    } else {
      state.lastSplits = null;
      paintClock(0);
      setStatus("Inspection cancelled");
    }
  }

  function toggle() {
    if (!isActive()) return;
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
        setStatus(runningStatus(state.mode, state.marks));
        paintSplits(elapsed);
        return;
      }
      stopTiming();
    } else if (state.phase === "inspecting") cancelSession();
    else startInspection();
  }

  function setMode(mode) {
    if (state.phase !== "idle") return;
    state.mode = saveTimerMode(mode, store);
    state.lastSplits = null;
    state.marks = [];
    paintSplits(0);
    setStatus(idleStatus(state.mode));
    syncModeButtons();
  }

  clockBtn.addEventListener("click", () => {
    toggle();
    clockBtn.blur();
  });
  scrambleEl?.addEventListener("click", () => {
    if (state.phase !== "idle") return;
    newScramble({ announce: true });
  });
  inspectEl?.addEventListener("change", () => {
    saveInspectionSeconds(inspectEl.value, store);
  });
  clearBtn?.addEventListener("click", () => {
    if (!loadPracticeTimes(store).length) return;
    if (!window.confirm("Clear all timer records?")) return;
    clearPracticeTimes(store);
    state.lastSplits = null;
    renderRecords();
    paintSplits(0);
    setStatus("All times cleared");
  });
  timesEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    deletePracticeTime(btn.dataset.delete, store);
    renderRecords();
    setStatus("Time deleted");
  });
  for (const btn of modeBtns) {
    btn.addEventListener("click", () => setMode(btn.dataset.timerMode));
  }

  document.addEventListener("keydown", (e) => {
    if (!isActive() || e.code !== "Space") return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener("keyup", (e) => {
    if (!isActive() || e.repeat || e.code !== "Space") return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    toggle();
  });

  if (inspectEl) inspectEl.value = String(loadInspectionSeconds(store));
  setPhase("idle");
  newScramble();
  paintClock(0);
  renderRecords();
  setStatus(idleStatus(state.mode));

  return {
    refresh: renderRecords,
    cancel: cancelSession,
    getPhase: () => state.phase,
    getMode: () => state.mode,
  };
}

import { randomScrambleMoves } from "./cube.js?v=timer3";
import { formatClock } from "./solve-timer.js?v=timer3";

export const PRACTICE_TIMES_KEY = "cube-coach-practice-times";
export const PRACTICE_INSPECT_KEY = "cube-coach-practice-inspect";
export const PRACTICE_MAX = 500;

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
  return {
    id: String(row.id || `t-${index}-${ms}`),
    ms,
    at: Number(row.at) || 0,
    scramble: String(row.scramble || ""),
  };
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
  records.push({
    id: String(entry.id || `t-${Date.now()}-${records.length}`),
    ms,
    at: Number(entry.at) || Date.now(),
    scramble: String(entry.scramble || ""),
  });
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
  };
  if (!times.length) return empty;

  const sorted = [...times].sort((a, b) => a - b);
  return {
    count: times.length,
    mean: mean(times),
    best: sorted[0],
    worst: sorted[sorted.length - 1],
    trimmed: times.length >= 3 ? mean(sorted.slice(1, -1)) : null,
    ao5: averageOf(times, 5),
    ao12: averageOf(times, 12),
  };
}

export function renderProgressChart(records, { width = 420, height = 180 } = {}) {
  const times = (records || []).map((r) => r.ms).filter((ms) => Number.isFinite(ms) && ms > 0);
  if (times.length < 2) {
    return `<div class="timer-chart-empty">Solve twice and a progress chart appears here — singles, ao5, and ao12.</div>`;
  }

  const pad = { t: 16, r: 12, b: 28, l: 44 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ao5 = rollingAverages(times, 5);
  const ao12 = rollingAverages(times, 12);
  const plotted = times.concat(ao5.filter((n) => n != null), ao12.filter((n) => n != null));
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
      const cmd = i > 0 && series[i - 1] != null ? "L" : "M";
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

  const dots = times
    .map(
      (ms, i) =>
        `<circle class="timer-chart-dot" cx="${xAt(i).toFixed(1)}" cy="${yAt(ms).toFixed(1)}" r="2.4"><title>Solve ${i + 1}: ${formatClock(ms)}</title></circle>`
    )
    .join("");

  const ao5Path = line(ao5);
  const ao12Path = line(ao12);

  return `<svg class="timer-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Solve times over session">
    ${grid.join("")}
    <path class="timer-chart-singles" d="${line(times)}" fill="none" />
    ${ao5Path ? `<path class="timer-chart-ao5" d="${ao5Path}" fill="none" />` : ""}
    ${ao12Path ? `<path class="timer-chart-ao12" d="${ao12Path}" fill="none" />` : ""}
    ${dots}
    <text class="timer-chart-axis" x="${pad.l}" y="${height - 8}">1</text>
    <text class="timer-chart-axis timer-chart-axis-end" x="${width - pad.r}" y="${height - 8}">${times.length}</text>
  </svg>
  <ul class="timer-chart-legend">
    <li><span class="swatch swatch-single"></span>Single</li>
    <li><span class="swatch swatch-ao5"></span>ao5</li>
    <li><span class="swatch swatch-ao12"></span>ao12</li>
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
      return `<li data-id="${escapeHtml(row.id)}">
        <div class="timer-time-row">
          <span class="timer-time-index">#${records.length - i}</span>
          <span class="timer-time-ms">${formatClock(row.ms)}</span>
          <button type="button" class="timer-time-delete" data-delete="${escapeHtml(row.id)}" aria-label="Delete ${formatClock(row.ms)}">×</button>
        </div>
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

function isTypingTarget(el) {
  return Boolean(el?.closest?.("input, select, textarea, [contenteditable=true]"));
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
  const chartEl = document.getElementById("timer-chart");
  const inspectEl = document.getElementById("timer-inspect");
  const clearBtn = document.getElementById("timer-clear");

  if (!clockBtn || !clockValue) return { refresh() {}, cancel() {} };

  const state = {
    phase: "idle", // idle | inspecting | running
    startedAt: 0,
    inspectLeft: 0,
    scramble: "",
    raf: 0,
    inspectTimer: 0,
  };

  function setPhase(phase) {
    state.phase = phase;
    clockBtn.dataset.phase = phase;
    clockBtn.setAttribute(
      "aria-label",
      phase === "running" ? "Stop timer" : phase === "inspecting" ? "Cancel inspection" : "Start timer"
    );
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function paintClock(ms, inspecting = false) {
    if (inspecting) {
      clockValue.textContent = String(Math.max(0, ms));
      return;
    }
    const { m, s, centi } = formatTimerParts(ms);
    clockValue.innerHTML = `${m}<span class="practice-colon">:</span>${s}<span class="practice-centi">${centi}</span>`;
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
    paintClock(0);
    setStatus("Space or tap to start");
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
    setStatus("Timing — space or tap to stop");
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
      paintClock(ms);
      addPracticeTime({ ms, at: Date.now(), scramble: state.scramble }, store);
      renderRecords();
      newScramble();
      setStatus(`Stopped at ${formatClock(ms)}. Scramble ready for the next solve.`);
    } else {
      paintClock(0);
      setStatus("Inspection cancelled");
    }
  }

  function toggle() {
    if (!isActive()) return;
    if (state.phase === "running") stopTiming();
    else if (state.phase === "inspecting") cancelSession();
    else startInspection();
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
    renderRecords();
    setStatus("All times cleared");
  });
  timesEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    deletePracticeTime(btn.dataset.delete, store);
    renderRecords();
    setStatus("Time deleted");
  });

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

  return {
    refresh: renderRecords,
    cancel: cancelSession,
    getPhase: () => state.phase,
  };
}

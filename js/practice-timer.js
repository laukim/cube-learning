import { randomScrambleMoves } from "./cube.js?v=timer4";
import { formatClock } from "./solve-timer.js?v=splits5";

export const PRACTICE_TIMES_KEY = "cube-coach-practice-times";
export const PRACTICE_INSPECT_KEY = "cube-coach-practice-inspect";
export const PRACTICE_MODE_KEY = "cube-coach-practice-mode";
export const PRACTICE_CHART_WINDOW_KEY = "cube-coach-practice-chart-window";
export const PRACTICE_MAX = 500;
export const TIMER_MODE_SINGLE = "single";
export const TIMER_MODE_SPLITS = "splits";
export const SPLIT_BOUNCE_MS = 150;
/** Chart window sizes; 0 = all solves in the session. */
export const CHART_WINDOW_OPTIONS = [25, 50, 100, 0];
export const DEFAULT_CHART_WINDOW = 50;
export const CHART_PAD = { t: 16, r: 12, b: 28, l: 44 };
export const DEFAULT_CHART_SIZE = { width: 420, height: 180 };
export const ENLARGED_CHART_SIZE = { width: 960, height: 440 };

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

export function loadChartWindow(store = browserStore()) {
  const raw = store?.getItem?.(PRACTICE_CHART_WINDOW_KEY);
  if (raw == null || raw === "") return DEFAULT_CHART_WINDOW;
  const n = Number(raw);
  return CHART_WINDOW_OPTIONS.includes(n) ? n : DEFAULT_CHART_WINDOW;
}

export function saveChartWindow(windowSize, store = browserStore()) {
  const n = Number(windowSize);
  const value = CHART_WINDOW_OPTIONS.includes(n) ? n : DEFAULT_CHART_WINDOW;
  try {
    store?.setItem?.(PRACTICE_CHART_WINDOW_KEY, String(value));
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
  const row = (label, value) =>
    value
      ? `<div class="timer-chart-tip-row"><span>${label}</span><strong>${value}</strong></div>`
      : "";
  return `<div class="timer-chart-tip-solve">Solve ${point.n}</div>
    ${row("Single", point.single)}
    ${row("Cross", point.cross)}
    ${row("F2L", point.f2l)}
    ${row("Cross avg", point.crossAvg)}
    ${row("F2L avg", point.f2lAvg)}
    ${row("ao5", point.ao5)}
    ${row("ao12", point.ao12)}`;
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

export function renderProgressChart(records, { width, height, windowSize = DEFAULT_CHART_WINDOW, enlarged = false } = {}) {
  const all = Array.isArray(records) ? records : [];
  const { records: windowed, startIndex } = sliceChartRecords(all, windowSize);
  const rows = chartRows(windowed);
  const times = rows.map((row) => row.ms);
  if (times.length < 2) {
    return `<div class="timer-chart-empty">Solve twice and a progress chart appears here — singles, ao5, ao12, and Cross / F2L finish times.</div>`;
  }

  const size = enlarged ? ENLARGED_CHART_SIZE : DEFAULT_CHART_SIZE;
  width = Number(width) || size.width;
  height = Number(height) || size.height;

  const crossFinish = rows.map((row) => splitFinishTimes(row.splits)?.cross ?? null);
  const f2lFinish = rows.map((row) => splitFinishTimes(row.splits)?.f2l ?? null);
  const hasSplitSeries = crossFinish.some((ms) => ms != null) || f2lFinish.some((ms) => ms != null);

  const pad = CHART_PAD;
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const ao5 = rollingAverages(times, 5);
  const ao12 = rollingAverages(times, 12);
  const showSplitAverages = Boolean(enlarged && hasSplitSeries);
  const crossAvg = showSplitAverages ? runningMean(crossFinish) : [];
  const f2lAvg = showSplitAverages ? runningMean(f2lFinish) : [];
  const plotted = times.concat(
    ao5.filter((n) => n != null),
    ao12.filter((n) => n != null),
    crossFinish.filter((n) => n != null),
    f2lFinish.filter((n) => n != null),
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
  const crossDots = seriesDots(crossFinish, "timer-chart-dot-cross", "Cross");
  const f2lDots = seriesDots(f2lFinish, "timer-chart-dot-f2l", "F2L");

  const ao5Path = line(ao5);
  const ao12Path = line(ao12);
  const crossPath = line(crossFinish);
  const f2lPath = line(f2lFinish);
  const crossAvgPath = showSplitAverages ? line(crossAvg) : "";
  const f2lAvgPath = showSplitAverages ? line(f2lAvg) : "";
  const windowNote =
    windowSize > 0 && all.length > times.length
      ? ` · last ${times.length} of ${all.length}`
      : "";
  const aria = hasSplitSeries
    ? showSplitAverages
      ? `Solve times over session, with Cross and F2L finish times and averages${windowNote}`
      : `Solve times over session, with Cross and F2L finish times${windowNote}`
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
    cross: crossFinish[i] != null ? formatClock(crossFinish[i]) : null,
    f2l: f2lFinish[i] != null ? formatClock(f2lFinish[i]) : null,
    ao5: ao5[i] != null ? formatClock(ao5[i]) : null,
    ao12: ao12[i] != null ? formatClock(ao12[i]) : null,
    crossAvg: showSplitAverages && crossAvg[i] != null ? formatClock(crossAvg[i]) : null,
    f2lAvg: showSplitAverages && f2lAvg[i] != null ? formatClock(f2lAvg[i]) : null,
    x: Number(xAt(i).toFixed(1)),
    y: Number(yAt(ms).toFixed(1)),
    yCross: crossFinish[i] != null ? Number(yAt(crossFinish[i]).toFixed(1)) : null,
    yF2l: f2lFinish[i] != null ? Number(yAt(f2lFinish[i]).toFixed(1)) : null,
  }));

  const enlargeBtn = enlarged
    ? ""
    : `<button type="button" class="btn btn-ghost btn-small timer-chart-enlarge" data-enlarge-chart aria-haspopup="dialog" aria-controls="timer-chart-dialog">Enlarge</button>`;

  return `<div class="timer-chart-frame${enlarged ? " is-enlarged" : ""}">
    ${enlargeBtn}
    <svg class="timer-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${aria}" data-width="${width}" data-height="${height}" data-pad-t="${pad.t}" data-pad-r="${pad.r}" data-pad-b="${pad.b}" data-pad-l="${pad.l}">
    ${grid.join("")}
    <path class="timer-chart-singles" d="${line(times)}" fill="none" />
    ${ao5Path ? `<path class="timer-chart-ao5" d="${ao5Path}" fill="none" />` : ""}
    ${ao12Path ? `<path class="timer-chart-ao12" d="${ao12Path}" fill="none" />` : ""}
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
    <li><span class="swatch swatch-ao5"></span>ao5</li>
    <li><span class="swatch swatch-ao12"></span>ao12</li>
    ${splitLegend}
  </ul>
  </div>`;
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
    ["Solves", String(stats.count || 0), ""],
    ["Average", dash(stats.mean), ""],
    ["Best", dash(stats.best), ""],
    ["Worst", dash(stats.worst), ""],
    ["Cross avg", dash(stageMean(stats.splits, "cross")), "timer-stat-cross"],
    ["F2L avg", dash(stageMean(stats.splits, "f2l")), "timer-stat-f2l"],
    ["Cross best", dash(stageBest(stats.splits, "cross")), "timer-stat-cross"],
    ["F2L best", dash(stageBest(stats.splits, "f2l")), "timer-stat-f2l"],
    ["Trimmed", dash(stats.trimmed), ""],
    ["ao5", dash(stats.ao5), ""],
    ["ao12", dash(stats.ao12), ""],
  ];
  return rows
    .map(
      ([label, value, extra]) => `<div class="timer-stat${extra ? ` ${extra}` : ""}">
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
  return Boolean(el?.closest?.("input, select, textarea, [contenteditable=true], dialog"));
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
  const chartDialog = document.getElementById("timer-chart-dialog");
  const enlargedEl = document.getElementById("timer-chart-enlarged");
  const chartCloseBtn = document.getElementById("timer-chart-dialog-close");
  const inspectEl = document.getElementById("timer-inspect");
  const chartWindowEl = document.getElementById("timer-chart-window");
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
    chartWindow: loadChartWindow(store),
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

  function paintEnlargedChart(records) {
    if (!enlargedEl) return;
    enlargedEl.innerHTML = renderProgressChart(records, {
      windowSize: state.chartWindow,
      enlarged: true,
    });
    bindChartInteract(enlargedEl);
  }

  function openEnlargedChart() {
    if (!chartDialog) return;
    const records = loadPracticeTimes(store);
    const { records: windowed } = sliceChartRecords(records, state.chartWindow);
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
    const records = loadPracticeTimes(store);
    const stats = computeStats(records);
    if (timesEl) timesEl.innerHTML = renderTimesList(records);
    if (statsEl) statsEl.innerHTML = renderStats(stats);
    if (splitStatsEl) splitStatsEl.innerHTML = renderSplitStats(stats.splits);
    if (chartEl) {
      chartEl.innerHTML = renderProgressChart(records, { windowSize: state.chartWindow });
      bindChartInteract(chartEl);
    }
    if (chartDialog?.open) paintEnlargedChart(records);
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
  chartWindowEl?.addEventListener("change", () => {
    state.chartWindow = saveChartWindow(chartWindowEl.value, store);
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
    if (chartDialog?.open || isTypingTarget(e.target)) return;
    e.preventDefault();
  });
  document.addEventListener("keyup", (e) => {
    if (!isActive() || e.repeat || e.code !== "Space") return;
    if (chartDialog?.open || isTypingTarget(e.target)) return;
    e.preventDefault();
    toggle();
  });

  if (inspectEl) inspectEl.value = String(loadInspectionSeconds(store));
  if (chartWindowEl) chartWindowEl.value = String(state.chartWindow);
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

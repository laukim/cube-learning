import { formatClock } from "./solve-timer.js?v=p1coach1";
import { normalizeMoves, phaseSegments, solveMoveStats } from "./move-log.js?v=postsolve1";

/**
 * Post-solve card for a smart-cube solve.
 * Cross / F2L / OLL / PLL when those marks exist. Final replaces OLL and PLL
 * when the last layer was not split. Pair rows are the gaps between pair marks.
 * No fluency score — that number is not something this timer measures.
 */

const STAGE_ORDER = ["cross", "f2l", "oll", "pll", "final"];

const STAGE_META = {
  cross: { letter: "C", label: "Cross" },
  f2l: { letter: "F", label: "F2L" },
  oll: { letter: "O", label: "OLL" },
  pll: { letter: "P", label: "PLL" },
  final: { letter: "Final", label: "Final" },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTps(tps) {
  return Number.isFinite(tps) ? tps.toFixed(2) : "—";
}

function inWindow(t, start, end, first) {
  if (t > end) return false;
  return first ? t >= start : t > start;
}

function countSteps(moves, start, end, first) {
  let steps = 0;
  for (const row of moves) {
    if (inWindow(row.t, start, end, first)) steps += 1;
  }
  return steps;
}

function stageTps(steps, ms) {
  if (!(ms > 0)) return null;
  return steps / (ms / 1000);
}

/** Integer percents that sum to 100. Zero-length stages stay at 0. */
function sharePercents(stages) {
  const total = stages.reduce((sum, stage) => sum + stage.ms, 0);
  if (!(total > 0)) return stages.map(() => 0);
  const raw = stages.map((stage) => (stage.ms / total) * 100);
  const floors = raw.map((n) => Math.floor(n));
  let left = 100 - floors.reduce((sum, n) => sum + n, 0);
  const order = raw
    .map((n, index) => ({ index, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return floors;
}

function rollupStages(segments, moves, totalMs) {
  if (!segments?.length) return null;
  const buckets = new Map();
  for (const segment of segments) {
    const id = segment.id;
    if (!STAGE_META[id]) continue;
    const bucket = buckets.get(id) || { id, ms: 0, start: segment.start, end: segment.end };
    bucket.ms += Math.max(0, segment.end - segment.start);
    bucket.start = Math.min(bucket.start, segment.start);
    bucket.end = Math.max(bucket.end, segment.end);
    buckets.set(id, bucket);
  }
  const present = STAGE_ORDER.filter((id) => buckets.has(id));
  if (!present.length) return null;
  return present.map((id, index) => {
    const bucket = buckets.get(id);
    const meta = STAGE_META[id];
    const steps = countSteps(moves, bucket.start, bucket.end, index === 0);
    const ms = Math.max(0, Math.round(bucket.ms));
    return {
      id,
      letter: meta.letter,
      label: meta.label,
      ms,
      steps,
      tps: stageTps(steps, ms),
      share: totalMs > 0 ? ms / totalMs : 0,
    };
  });
}

function pairRows(pairs, moves) {
  if (!pairs?.length) return null;
  return pairs.map((pair) => {
    const ms = Math.max(0, Math.round(pair.end - pair.start));
    const steps = countSteps(moves, pair.start, pair.end, false);
    return {
      label: pair.ids.join(" "),
      ms,
      steps,
    };
  });
}

/**
 * Steps, TPS, and stage rows for one stored solve.
 * Null without a move log. Stages stay null when the solve has no split marks.
 */
export function postSolveSummary({ moves, splits, totalMs, ms: solvedMs } = {}) {
  const list = normalizeMoves(moves);
  const ms = Number(totalMs ?? solvedMs);
  if (!list || !Number.isFinite(ms) || ms <= 0) return null;
  const stats = solveMoveStats(list, ms);
  if (!stats) return null;
  const phases = phaseSegments(splits);
  return {
    ms,
    steps: stats.moves,
    tps: stats.tps,
    stages: rollupStages(phases.segments, list, ms),
    pairs: pairRows(phases.f2lPairs, list),
  };
}

function timeMarkup(ms) {
  const text = formatClock(ms);
  const match = text.match(/^(.*)\.(\d{2})$/);
  if (!match) return escapeHtml(text);
  return `${escapeHtml(match[1])}<span class="post-solve-centi">.${match[2]}</span>`;
}

function renderRing(stages) {
  const drawn = stages.filter((stage) => stage.ms > 0);
  if (!drawn.length) return "";
  const r = 38;
  const c = 2 * Math.PI * r;
  const total = drawn.reduce((sum, stage) => sum + stage.ms, 0);
  const gap = drawn.length > 1 ? Math.min(3.5, c / drawn.length / 8) : 0;
  let cursor = 0;
  const arcs = drawn
    .map((stage) => {
      const len = (stage.ms / total) * c;
      const draw = Math.max(0, len - gap);
      const dash = `${draw.toFixed(3)} ${(c - draw).toFixed(3)}`;
      const offset = (-cursor).toFixed(3);
      cursor += len;
      return `<circle class="post-solve-arc is-${stage.id}" cx="60" cy="60" r="${r}" fill="none" stroke-width="11" stroke-dasharray="${dash}" stroke-dashoffset="${offset}"></circle>`;
    })
    .join("");
  const percents = sharePercents(stages);
  const label = stages.map((stage, index) => `${stage.label} ${percents[index]}%`).join(", ");
  return `<svg class="post-solve-ring" viewBox="0 0 120 120" role="img" aria-label="Stage share: ${escapeHtml(label)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg>`;
}

function renderLegend(stages) {
  const percents = sharePercents(stages);
  const items = stages
    .map(
      (stage, index) =>
        `<li class="is-${stage.id}"><span class="post-solve-swatch" aria-hidden="true"></span>${escapeHtml(stage.label)} <span class="post-solve-pct">${percents[index]}%</span></li>`
    )
    .join("");
  return `<ul class="post-solve-legend">${items}</ul>`;
}

function renderTable(stages) {
  const head = stages
    .map((stage) => `<th scope="col" title="${escapeHtml(stage.label)}">${escapeHtml(stage.letter)}</th>`)
    .join("");
  const time = stages.map((stage) => `<td>${escapeHtml(formatClock(stage.ms))}</td>`).join("");
  const steps = stages.map((stage) => `<td>${stage.steps}</td>`).join("");
  const tps = stages.map((stage) => `<td>${escapeHtml(formatTps(stage.tps))}</td>`).join("");
  return `<table class="post-solve-table">
    <thead><tr><th scope="col"></th>${head}</tr></thead>
    <tbody>
      <tr><th scope="row">Time</th>${time}</tr>
      <tr><th scope="row">Steps</th>${steps}</tr>
      <tr><th scope="row">TPS</th>${tps}</tr>
    </tbody>
  </table>`;
}

function renderPairs(pairs, { open = false } = {}) {
  if (!pairs?.length) return "";
  const rows = pairs
    .map(
      (pair) =>
        `<li><span class="post-solve-pair-name">${escapeHtml(pair.label)}</span><span class="post-solve-pair-time">${escapeHtml(formatClock(pair.ms))}</span><span class="post-solve-pair-steps">${pair.steps} ${pair.steps === 1 ? "step" : "steps"}</span></li>`
    )
    .join("");
  return `<details class="post-solve-pairs"${open ? " open" : ""}>
    <summary>F2L pairs</summary>
    <ul>${rows}</ul>
  </details>`;
}

/**
 * One card: time, PB, steps, TPS, stage ring, and the C / F / O / P table.
 * `canReplay` adds the button that plays the stored log on the live cube.
 */
export function renderPostSolveCard(summary, { pb = false, canReplay = false, pairsOpen = false } = {}) {
  if (!summary) return "";
  const stepsLabel = summary.steps === 1 ? "step" : "steps";
  const badge = pb ? `<span class="post-solve-pb">PB</span>` : "";
  const timeLabel = formatClock(summary.ms);
  const aria = pb
    ? `${timeLabel}, personal best. Tap to start the next solve.`
    : `${timeLabel}. Tap to start the next solve.`;
  const share = summary.stages?.length
    ? `<div class="post-solve-share">${renderRing(summary.stages)}${renderLegend(summary.stages)}</div>
       <div class="post-solve-table-wrap">${renderTable(summary.stages)}</div>`
    : "";
  const replay = canReplay
    ? `<div class="post-solve-actions"><button type="button" class="btn btn-ghost btn-small post-solve-replay" data-post-solve-replay>Replay</button></div>`
    : "";
  return `<section class="post-solve-card${pb ? " is-pb" : ""}" aria-label="Solve summary">
    <button type="button" class="post-solve-time" data-post-solve-start aria-label="${escapeHtml(aria)}">
      <span class="post-solve-time-value">${timeMarkup(summary.ms)}</span>
      ${badge}
    </button>
    <p class="post-solve-meta"><span>${summary.steps} ${stepsLabel}</span><span>${escapeHtml(formatTps(summary.tps))} TPS</span></p>
    ${share}
    ${renderPairs(summary.pairs, { open: pairsOpen })}
    ${replay}
  </section>`;
}

/** A full splits solve used by the preview URL and the card tests. */
export function previewSolveRecord() {
  const moves = [
    { move: "R", t: 400 },
    { move: "U", t: 1100 },
    { move: "R'", t: 1800 },
    { move: "U'", t: 2500 },
    { move: "F", t: 3200 },
    { move: "R", t: 4000 },
    { move: "U", t: 4800 },
    { move: "R'", t: 5600 },
    { move: "U'", t: 6400 },
    { move: "R", t: 7200 },
    { move: "U", t: 8000 },
    { move: "R'", t: 9000 },
    { move: "U'", t: 10000 },
    { move: "F", t: 11000 },
    { move: "R", t: 12000 },
    { move: "U", t: 12800 },
    { move: "R'", t: 13600 },
    { move: "U'", t: 14500 },
    { move: "F", t: 15400 },
    { move: "R", t: 16200 },
    { move: "U", t: 17000 },
    { move: "R'", t: 18000 },
  ];
  return {
    ms: 18000,
    scramble: "R U R' U' F2 D L' B2 U R2 F' D2 L U' B R' F L2 D'",
    moves,
    splits: {
      cross: 4000,
      f2l: 8000,
      final: 6000,
      oll: 2500,
      pll: 3500,
      pairs: [
        { id: "FR", at: 6400 },
        { id: "BR", at: 9000 },
        { id: "BL", at: 11000 },
        { id: "FL", at: 12000 },
      ],
    },
  };
}

import { STEPS } from "./solver.js";
import { countNamedAlgs, countYTurns, formatAlgCounts } from "./coach-report.js";
import { analyzeF2lFlow, formatF2lFlow } from "./f2l-trainer.js?v=conn1";

export const SPLIT_SHORT = {
  "white-cross": "Cross",
  f2l: "F2L",
  "yellow-cross": "Y-cross",
  "yellow-face": "Y-face",
  headlights: "Headlights",
  "yellow-edges": "Edges",
};

export const SPLIT_GROUPS = [
  { id: "cross", title: "White cross", indices: [0] },
  { id: "f2l", title: "First two layers", indices: [1] },
  { id: "oll", title: "Yellow face (OLL)", indices: [2, 3] },
  { id: "pll", title: "Perm (PLL)", indices: [4, 5] },
];

const STEP_COACHING = [
  {
    tab: "Cross",
    tip: "Drill white cross with the Cross tab — four edges, centres matching, without hunting on the bottom.",
  },
  {
    tab: "F2L",
    tip: "F2L: pair each white corner with its edge and insert together. The F2L tab drills CubeHead’s 41 (1R / 1L twins; no L → just 11).",
  },
  {
    tab: "OLL",
    tip: "Yellow cross is one alg: F, righty, F′. Hold the L or line correctly so you don’t repeat extra times.",
  },
  {
    tab: "OLL",
    tip: "Yellow face: Sune only. 1 corner → bottom-left. 0 → no yellow on front. 2 adj → on the right. 2 opp → top-left + bottom-right.",
  },
  {
    tab: "PLL",
    tip: "Headlights on the LEFT, then T-perm. No headlights → T-perm once from anywhere, then headlights appear.",
  },
  {
    tab: "PLL",
    tip: "Bar at the BACK, then U-perm. No bar → U-perm once, then put the new bar at back and repeat.",
  },
];

export function formatClock(ms) {
  const clamped = Math.max(0, Number(ms) || 0);
  const cs = Math.floor(clamped / 10);
  const centi = cs % 100;
  const totalSec = Math.floor(cs / 100);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60);
  const frac = String(centi).padStart(2, "0");
  if (m > 0) return `${m}:${String(s).padStart(2, "0")}.${frac}`;
  return `${s}.${frac}`;
}

export function formatDelta(ms) {
  const abs = formatClock(Math.abs(ms));
  if (ms <= -50) return `${abs} faster`;
  if (ms >= 50) return `${abs} slower`;
  return "same as last";
}

export function createTimer() {
  return {
    phase: "idle",
    startMs: 0,
    endMs: 0,
    stepStartMs: 0,
    stepStartMoves: 0,
    lastDone: 0,
    splits: [],
  };
}

export function resetTimer(t) {
  t.phase = "idle";
  t.startMs = 0;
  t.endMs = 0;
  t.stepStartMs = 0;
  t.stepStartMoves = 0;
  t.lastDone = 0;
  t.splits = [];
  return t;
}

export function armTimer(t) {
  resetTimer(t);
  t.phase = "armed";
  return t;
}

export function startTimer(t, now, moveCount, alreadyDone = 0, steps = STEPS) {
  if (t.phase !== "armed") return t;
  const seeded = Math.max(0, Math.min(alreadyDone, steps.length));
  t.phase = "running";
  t.startMs = now;
  t.stepStartMs = now;
  t.stepStartMoves = moveCount;
  t.endMs = 0;
  t.lastDone = seeded;
  t.splits = [];
  for (let i = 0; i < seeded; i++) {
    const step = steps[i];
    t.splits.push({
      index: i,
      id: step.id,
      title: step.title,
      ms: 0,
      moves: 0,
    });
  }
  return t;
}

export function elapsedMs(t, now) {
  if (t.phase === "idle" || t.phase === "armed") return 0;
  if (t.phase === "done") return Math.max(0, t.endMs - t.startMs);
  return Math.max(0, now - t.startMs);
}

export function currentSplitMs(t, now) {
  if (t.phase !== "running") return 0;
  return Math.max(0, now - t.stepStartMs);
}

export function noteProgress(t, { now, moveCount, stepsDone, solved, steps = STEPS }) {
  if (t.phase !== "running") return t;

  const done = (stepsDone || []).filter(Boolean).length;

  // First occurrence only — if they later break a finished step (or undo), keep the split.
  // Credit the step they were actually on. Extra steps that become true on the
  // same move are skips (last Sune can also leave corners AUF-able — that must
  // not dump the Sune onto headlights).
  if (done > t.lastDone) {
    for (let i = t.lastDone; i < done; i++) {
      const firstOfBatch = i === t.lastDone;
      const step = steps[i];
      t.splits.push({
        index: i,
        id: step.id,
        title: step.title,
        ms: firstOfBatch ? Math.max(0, now - t.stepStartMs) : 0,
        moves: firstOfBatch ? Math.max(0, moveCount - t.stepStartMoves) : 0,
      });
    }
    t.lastDone = done;
    t.stepStartMs = now;
    t.stepStartMoves = moveCount;
  }

  if (solved) {
    t.phase = "done";
    t.endMs = now;
  }
  return t;
}

function sumSplits(splits, indices) {
  return indices.reduce(
    (acc, i) => {
      const s = splits[i];
      if (!s) return acc;
      acc.ms += s.ms;
      acc.moves += s.moves;
      return acc;
    },
    { ms: 0, moves: 0 }
  );
}

export function buildAnalysis({ totalMs, splits, totalMoves, previousTotalMs = null }) {
  const rows = STEPS.map((step, i) => {
    const split = splits[i] || { ms: 0, moves: 0 };
    const share = totalMs > 0 ? split.ms / totalMs : 0;
    return {
      index: i,
      id: step.id,
      title: step.title,
      short: SPLIT_SHORT[step.id] || step.title,
      ms: split.ms,
      moves: split.moves,
      share,
    };
  });

  let slowest = rows[0];
  for (const row of rows) {
    if (row.ms > slowest.ms) slowest = row;
  }

  const groups = SPLIT_GROUPS.map((g) => {
    const { ms, moves } = sumSplits(splits, g.indices);
    return {
      ...g,
      ms,
      moves,
      share: totalMs > 0 ? ms / totalMs : 0,
    };
  });

  let slowestGroup = groups[0];
  for (const g of groups) {
    if (g.ms > slowestGroup.ms) slowestGroup = g;
  }

  const seconds = totalMs / 1000;
  const tps = seconds > 0 ? totalMoves / seconds : 0;
  const coach = STEP_COACHING[slowest.index];

  const insights = [];
  const sharePct = Math.round(slowest.share * 100);
  insights.push(
    `${slowest.title} took ${formatClock(slowest.ms)} (${sharePct}% of the solve) — the longest milestone.`
  );
  insights.push(coach.tip);

  if (slowestGroup.id === "pll" && slowestGroup.share >= 0.35) {
    insights.push(
      `Perm was ${Math.round(slowestGroup.share * 100)}% of the clock. PLL tab: headlights (T-perm) then bar-at-back (U-perm).`
    );
  } else if (slowestGroup.id === "oll" && slowestGroup.share >= 0.35) {
    insights.push(
      `Yellow face was ${Math.round(slowestGroup.share * 100)}% of the clock. OLL tab: cross alg then Sune holds.`
    );
  } else if (slowestGroup.id === "f2l" && slowestGroup.share >= 0.4) {
    insights.push(
      `First two layers were ${Math.round(slowestGroup.share * 100)}% of the solve. Pairing on the F2L tab is the usual next leap.`
    );
  }

  if (tps > 0 && tps < 0.7) {
    insights.push(
      `${tps.toFixed(2)} turns/sec — a lot of pause between moves. Recognition, not turning speed, is likely the wait.`
    );
  }

  if (previousTotalMs != null && previousTotalMs > 0) {
    const diff = totalMs - previousTotalMs;
    insights.push(`Versus your last timed solve: ${formatDelta(diff)} (${formatClock(previousTotalMs)}).`);
  }

  return {
    totalMs,
    totalMoves,
    tps,
    rows,
    groups,
    slowest,
    slowestGroup,
    insights,
    coachTab: coach.tab,
  };
}

export function findPauses(trace, thresholdMs = 3000) {
  const pauses = [];
  if (!Array.isArray(trace)) return pauses;
  for (let i = 1; i < trace.length; i++) {
    const gap = (trace[i].ms || 0) - (trace[i - 1].ms || 0);
    if (gap < thresholdMs) continue;
    pauses.push({
      after: trace[i - 1].move,
      before: trace[i].move,
      ms: gap,
    });
  }
  pauses.sort((a, b) => b.ms - a.ms);
  return pauses;
}

export function formatSolveReport(analysis, extra = {}) {
  const {
    scramble = "",
    solution = "",
    undos = 0,
    pauses = [],
    at = null,
    splits = [],
    f2lPairs = [],
  } = extra;
  const tps = analysis.tps > 0 ? analysis.tps.toFixed(2) : "—";
  const lines = [
    `COACH ${formatClock(analysis.totalMs)} · ${analysis.totalMoves} moves · ${tps} tps · slowest ${analysis.slowest.short}`,
  ];
  if (at) {
    const d = new Date(at);
    if (!Number.isNaN(d.getTime())) {
      lines.push(d.toISOString().replace("T", " ").slice(0, 16) + " UTC");
    }
  }
  if (scramble) {
    lines.push(`Scramble: ${scramble}`);
  }
  lines.push("");

  const splitById = new Map((splits || []).map((s) => [s.id, s]));
  for (const row of analysis.rows) {
    const split = splitById.get(row.id) || {};
    const alg = split.alg || "";
    const sec = row.ms / 1000;
    const rowTps = sec > 0 && row.moves ? (row.moves / sec).toFixed(2) : "—";
    lines.push(
      `${row.index + 1}. ${row.title} · ${formatClock(row.ms)} · ${row.moves} moves · ${rowTps} tps`
    );
    if (row.id === "f2l" && f2lPairs.length) {
      const pairBits = f2lPairs.map((p, i) => {
        const prev = i === 0 ? 0 : f2lPairs[i - 1].ms;
        return `${p.pair} in ${formatClock(p.ms - prev)}`;
      });
      lines.push(`   pairs: ${pairBits.join(" · ")}`);
    }
    if (row.id === "f2l" && alg && scramble) {
      const crossAlg = splitById.get("white-cross")?.alg || "";
      lines.push(...formatF2lFlow(analyzeF2lFlow(scramble, crossAlg, alg)));
    }
    if (alg) {
      const counts = countNamedAlgs(alg);
      const yTurns = countYTurns(alg);
      const label = formatAlgCounts(counts, yTurns);
      if (label) lines.push(`   algs: ${label}`);
      lines.push(`   ${alg}`);
    }
    const stepPauses = findPauses(split.trace || [], 3000);
    if (stepPauses.length) {
      const bits = stepPauses
        .slice(0, 4)
        .map((p) => `${formatClock(p.ms)} before ${p.before}`);
      lines.push(`   pauses: ${bits.join(", ")}`);
    }
    lines.push("");
  }

  if (undos > 0) lines.push(`Undos: ${undos}`);
  if (pauses.length && !splits.some((s) => (s.trace || []).length)) {
    lines.push("Pauses (≥3s)");
    for (const p of pauses.slice(0, 8)) {
      lines.push(`${formatClock(p.ms)} before ${p.before} (after ${p.after})`);
    }
    lines.push("");
  }
  if (solution && !splits.some((s) => s.alg)) {
    lines.push(`Solution: ${solution}`);
    lines.push("");
  }
  for (const t of analysis.insights) lines.push(t);
  return lines.join("\n");
}

function barWidth(share) {
  const pct = Math.max(2, Math.round(share * 100));
  return `${pct}%`;
}

export function renderAnalysisHtml(analysis) {
  const { totalMs, totalMoves, tps, rows, groups, slowest, insights } = analysis;
  const tpsLabel = tps > 0 ? `${tps.toFixed(2)} tps` : "—";

  const groupHtml = groups
    .map(
      (g) => `<div class="analysis-group">
        <div class="analysis-group-head">
          <span>${g.title}</span>
          <strong>${formatClock(g.ms)}</strong>
        </div>
        <div class="analysis-bar-track" aria-hidden="true">
          <span class="analysis-bar-fill ${g.id === analysis.slowestGroup.id ? "is-slowest" : ""}" style="width:${barWidth(g.share)}"></span>
        </div>
        <span class="analysis-group-meta">${Math.round(g.share * 100)}% · ${g.moves} moves</span>
      </div>`
    )
    .join("");

  const rowHtml = rows
    .map((row) => {
      const isSlowest = row.index === slowest.index;
      return `<li class="analysis-row ${isSlowest ? "is-slowest" : ""}">
        <span class="analysis-row-name">${row.index + 1}. ${row.title}</span>
        <span class="analysis-row-moves">${row.moves} moves</span>
        <span class="analysis-row-time">${formatClock(row.ms)}</span>
        <div class="analysis-bar-track" aria-hidden="true">
          <span class="analysis-bar-fill ${isSlowest ? "is-slowest" : ""}" style="width:${barWidth(row.share)}"></span>
        </div>
      </li>`;
    })
    .join("");

  const insightHtml = insights.map((t) => `<li>${t}</li>`).join("");

  const scramble = analysis.scramble ? escapeHtml(analysis.scramble) : "";
  const solution = analysis.solution ? escapeHtml(analysis.solution) : "";
  const reconHtml =
    scramble || solution
      ? `<div class="analysis-recon">
        ${scramble ? `<p><span>Scramble</span><code>${scramble}</code></p>` : ""}
        ${solution ? `<p><span>Solution</span><code>${solution}</code></p>` : ""}
      </div>`
      : "";

  const shareBtn = analysis.canShare !== false
    ? `<button type="button" class="btn btn-small btn-primary" id="btn-share-solve">Share to chat</button>`
    : "";

  const report = analysis.report ? escapeHtml(analysis.report) : "";
  const reportHtml = report
    ? `<label class="analysis-report-wrap">
        <span>Report — tap Share, or long-press this text → Copy</span>
        <textarea id="solve-report-text" readonly rows="10">${report}</textarea>
      </label>`
    : "";

  return `<div class="analysis-hero">
      <p class="analysis-kicker">Solve analysis</p>
      <p class="analysis-total">${formatClock(totalMs)}</p>
      <p class="analysis-hero-meta">${totalMoves} moves · ${tpsLabel} · slowest ${slowest.short}</p>
    </div>
    <div class="analysis-groups">${groupHtml}</div>
    <ol class="analysis-rows">${rowHtml}</ol>
    <ul class="analysis-insights">${insightHtml}</ul>
    ${reconHtml}
    ${reportHtml}
    <div class="analysis-actions">
      ${shareBtn}
      <button type="button" class="btn btn-small ${shareBtn ? "" : "btn-primary"}" id="btn-copy-solve">Copy</button>
    </div>
    <p class="analysis-share-hint">On iPhone: Share → Copy, or long-press the report. Then paste into the Cursor chat on your Mac.</p>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const HISTORY_KEY = "bylayer-solve-history";
const HISTORY_MAX = 20;

export function loadSolveHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordSolve(entry) {
  const history = loadSolveHistory();
  history.push(entry);
  const trimmed = history.slice(-HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore quota */
  }
  return trimmed;
}

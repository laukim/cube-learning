/**
 * P1 coaching stats for the timer.
 * Level is ao100. Stage pause/turn and an OLL/PLL split come from a cube log.
 * OLL vs PLL is stored only when the replay shows the boundary; otherwise Final stays whole.
 */
import { applyMove, stringToFacelets } from "./cube.js?v=timer4";
import { faceletsForScramble } from "./cube-reconstruction.js?v=p1coach1";
import { normalizeMoves } from "./move-log.js?v=p1coach1";
import { formatClock, splitStagesFromFacelets } from "./solve-timer.js?v=p1coach1";

export const AO100_GOAL_KEY = "cube-coach-ao100-goal";
export const LEVEL_WINDOW = 100;
/** A gap this long inside a stage is recognition, not turning. */
export const PAUSE_GAP_MS = 500;
/**
 * Yellow face already oriented within this long after the F2L mark counts as
 * an OLL skip (or OLL finished on the F2L pause), not a late guess.
 */
export const OLL_AT_F2L_MS = 500;
export const GOAL_SLOPE_SPAN = 20;
export const SUB_SECONDS = [50, 45, 40];
export const HIST_BINS = [
  { label: "<30", min: 0, max: 30000 },
  { label: "30–35", min: 30000, max: 35000 },
  { label: "35–40", min: 35000, max: 40000 },
  { label: "40–45", min: 40000, max: 45000 },
  { label: "45–50", min: 45000, max: 50000 },
  { label: "50–60", min: 50000, max: 60000 },
  { label: "60–75", min: 60000, max: 75000 },
  { label: "75+", min: 75000, max: Infinity },
];

const STEP_META = {
  cross: { short: "Cross" },
  f2l: { short: "F2L" },
  final: { short: "Final" },
  oll: { short: "OLL" },
  pll: { short: "PLL" },
  solve: { short: "Solve" },
};

const layerCache = new Map();

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dash(ms) {
  return Number.isFinite(ms) ? formatClock(ms) : "—";
}

function finiteTimes(times) {
  return (times || []).filter((ms) => Number.isFinite(ms) && ms > 0);
}

export function loadAo100Goal(store) {
  const ms = Number(store?.getItem?.(AO100_GOAL_KEY));
  if (!Number.isFinite(ms) || ms < 5000 || ms > 600000) return null;
  return Math.round(ms);
}

export function saveAo100Goal(ms, store) {
  try {
    if (ms == null) {
      store?.removeItem?.(AO100_GOAL_KEY);
      return null;
    }
    const stored = Math.round(ms);
    store?.setItem?.(AO100_GOAL_KEY, String(stored));
    return stored;
  } catch {
    return null;
  }
}

/** Seconds in the field. Null clears. Undefined is not a time. */
export function parseGoalInput(text) {
  const raw = String(text ?? "")
    .trim()
    .replace(/s$/i, "")
    .trim();
  if (!raw) return null;
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 5 || seconds > 600) return undefined;
  return Math.round(seconds * 1000);
}

export function formatGoalSeconds(ms) {
  if (!Number.isFinite(ms)) return "";
  const seconds = ms / 1000;
  if (Number.isInteger(seconds)) return String(seconds);
  return seconds.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function subPercents(times) {
  const window = finiteTimes(times).slice(-LEVEL_WINDOW);
  return {
    count: window.length,
    rows: SUB_SECONDS.map((sec) => {
      const under = window.filter((ms) => ms < sec * 1000).length;
      return {
        sec,
        under,
        pct: window.length ? Math.round((under / window.length) * 100) : null,
      };
    }),
  };
}

export function timeHistogram(times) {
  const window = finiteTimes(times).slice(-LEVEL_WINDOW);
  const bins = HIST_BINS.map((bin) => ({
    label: bin.label,
    count: window.filter((ms) => ms >= bin.min && ms < bin.max).length,
  }));
  return { count: window.length, bins };
}

/**
 * Gap to a target ao100, and a rough solve count from the recent ao100 slope.
 * `priorAo100` is the ao100 from `span` solves earlier. No slope is invented.
 */
export function goalForecast({ ao100, priorAo100, span, targetMs, count } = {}) {
  const target = Number.isFinite(targetMs) ? targetMs : null;
  const current = Number.isFinite(ao100) ? ao100 : null;
  const have = Number(count) || 0;
  if (target == null) return { target: null, ao100: current, gap: null, solves: null, reason: "none", count: have };
  if (current == null) {
    return {
      target,
      ao100: null,
      gap: null,
      solves: null,
      reason: "short",
      need: Math.max(0, LEVEL_WINDOW - have),
      count: have,
    };
  }
  const gap = current - target;
  if (gap <= 0) return { target, ao100: current, gap, solves: 0, reason: "met", count: have };
  const prior = Number(priorAo100);
  const n = Number(span) || 0;
  if (!Number.isFinite(prior) || n <= 0) {
    return { target, ao100: current, gap, solves: null, reason: "slope", count: have };
  }
  const perSolve = (prior - current) / n;
  if (perSolve <= 0) return { target, ao100: current, gap, solves: null, perSolve, reason: "flat", count: have };
  return {
    target,
    ao100: current,
    gap,
    solves: Math.ceil(gap / perSolve),
    perSolve,
    reason: "eta",
    count: have,
  };
}

export function formatGoalOutlook(outlook) {
  if (!outlook || outlook.reason === "none") return "Set a target ao100 to see the gap.";
  if (outlook.reason === "short") {
    const soFar = LEVEL_WINDOW - (outlook.need ?? LEVEL_WINDOW);
    return `ao100 starts at 100 solves · ${soFar} so far.`;
  }
  if (outlook.reason === "met") return "ao100 is at the target.";
  const gapLabel = `${formatClock(outlook.gap)} above the target`;
  if (outlook.reason === "slope") return `${gapLabel} · ETA needs 20 solves of ao100 history.`;
  if (outlook.reason === "flat") return `${gapLabel} · recent ao100 is not coming down.`;
  const rough = outlook.solves > 999 ? "999+" : String(outlook.solves);
  return `${gapLabel} · about ${rough} solves at the recent pace.`;
}

function replaySolve(scramble, moves) {
  const letters = faceletsForScramble(scramble);
  if (letters.length !== 54) return null;
  const state = stringToFacelets(letters);
  if (state.length !== 54 || state.some((color) => !color)) return null;
  const frames = [{ t: 0, move: "", stage: splitStagesFromFacelets(state) }];
  for (const row of moves) {
    applyMove(state, row.move);
    frames.push({ t: row.t, move: row.move, stage: splitStagesFromFacelets(state) });
  }
  return frames;
}

function isAuf(move) {
  return move === "U" || move === "U'" || move === "U2";
}

/**
 * Split Final into OLL and PLL from a scramble plus the cube's move log.
 * Returns null unless the replay ends solved, F2L is actually done at the
 * stored F2L mark, and a later unsolved yellow face is followed by a real PLL
 * (more than a trailing U, unless that yellow face was already there when F2L
 * finished). A last-layer alg that only looks oriented on the final U is left
 * as Final.
 */
export function lastLayerSplit({ scramble, moves, splits, totalMs } = {}) {
  const list = normalizeMoves(moves);
  if (!list || !splits) return null;
  const total = Number(totalMs);
  const cross = Number(splits.cross);
  const f2l = Number(splits.f2l);
  const final = Number(splits.final);
  if (![total, cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) return null;
  if (Math.abs(cross + f2l + final - total) > 1) return null;
  const f2lAt = cross + f2l;
  if (!(final > 0) || !(f2lAt < total)) return null;

  const frames = replaySolve(scramble, list);
  if (!frames?.length || !frames[frames.length - 1].stage.solved) return null;
  const atMark = [...frames].reverse().find((frame) => frame.t <= f2lAt);
  if (!atMark?.stage.f2l) return null;

  let ollAt = null;
  if (atMark.stage.oll) ollAt = f2lAt;
  else {
    const hit = frames.find((frame) => frame.t >= f2lAt && frame.stage.oll);
    if (!hit) return null;
    ollAt = hit.t;
  }
  if (!(ollAt >= f2lAt && ollAt < total)) return null;

  const after = list.filter((row) => row.t > ollAt);
  if (!after.length) return null;
  const onlyAuf = after.length === 1 && isAuf(after[0].move);
  const heldAtF2l = ollAt <= f2lAt + OLL_AT_F2L_MS;
  if (onlyAuf && !heldAtF2l) return null;

  const oll = Math.round(ollAt - f2lAt);
  const pll = Math.round(final) - oll;
  if (oll < 0 || pll <= 0) return null;
  return { oll, pll };
}

export function lastLayerForSolve(record) {
  if (!record?.splits) return null;
  const storedOll = Number(record.splits.oll);
  const storedPll = Number(record.splits.pll);
  if (Number.isFinite(storedOll) && Number.isFinite(storedPll)) {
    return { oll: Math.round(storedOll), pll: Math.round(storedPll) };
  }
  if (!record.moves || !record.scramble) return null;
  const key = [
    record.id,
    record.ms,
    record.moves.length,
    record.splits.cross,
    record.splits.f2l,
    record.splits.final,
    record.scramble,
  ].join("|");
  if (layerCache.has(key)) return layerCache.get(key);
  const layer = lastLayerSplit({
    scramble: record.scramble,
    moves: record.moves,
    splits: record.splits,
    totalMs: record.ms,
  });
  if (layerCache.size > 4000) layerCache.clear();
  layerCache.set(key, layer);
  return layer;
}

/** Stored splits, plus OLL/PLL when the cube log can support them. */
export function splitsForDisplay(record) {
  if (!record?.splits) return null;
  const layer = lastLayerForSolve(record);
  if (!layer) return record.splits;
  return { ...record.splits, oll: layer.oll, pll: layer.pll };
}

/**
 * Pause vs turning inside one stage.
 * Gaps of at least PAUSE_GAP_MS are pause. The rest of the stage is turning.
 * A stage of a second or more with no logged turn is unknown — null, not a guess.
 */
export function stagePace(moves, start, end, pauseGap = PAUSE_GAP_MS) {
  const list = normalizeMoves(moves);
  if (!list) return null;
  const a = Number(start);
  const b = Number(end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  const duration = b - a;
  if (duration === 0) return { pause: 0, turning: 0, moves: 0 };
  const cuts = [a];
  let movesIn = 0;
  for (const row of list) {
    if (row.t > a && row.t < b) {
      cuts.push(row.t);
      movesIn += 1;
    } else if (row.t === a || row.t === b) {
      movesIn += 1;
    }
  }
  if (movesIn === 0 && duration >= 1000) return null;
  cuts.push(b);
  let pause = 0;
  for (let i = 1; i < cuts.length; i++) {
    const gap = cuts[i] - cuts[i - 1];
    if (gap >= pauseGap) pause += gap;
  }
  pause = Math.min(duration, Math.round(pause));
  return { pause, turning: Math.round(duration - pause), moves: movesIn };
}

export function effortStages(record) {
  const moves = record?.moves;
  const total = Number(record?.ms);
  if (!normalizeMoves(moves) || !Number.isFinite(total) || total <= 0) return [];
  const shown = splitsForDisplay(record);
  const windows = [];
  if (shown && [shown.cross, shown.f2l, shown.final].every((n) => Number.isFinite(Number(n)))) {
    const cross = Number(shown.cross);
    const f2lAt = cross + Number(shown.f2l);
    windows.push({ id: "cross", start: 0, end: cross });
    windows.push({ id: "f2l", start: cross, end: f2lAt });
    if (Number.isFinite(Number(shown.oll)) && Number.isFinite(Number(shown.pll))) {
      const ollEnd = f2lAt + Number(shown.oll);
      windows.push({ id: "oll", start: f2lAt, end: ollEnd });
      windows.push({ id: "pll", start: ollEnd, end: total });
    } else {
      windows.push({ id: "final", start: f2lAt, end: total });
    }
  } else {
    windows.push({ id: "solve", start: 0, end: total });
  }
  const out = [];
  for (const window of windows) {
    const pace = stagePace(moves, window.start, window.end);
    if (!pace || pace.turning + pace.pause <= 0) continue;
    out.push({ id: window.id, short: STEP_META[window.id].short, ...pace });
  }
  return out;
}

export function renderEffort(record) {
  const stages = effortStages(record);
  if (!stages.length) return "";
  const text = stages
    .map((stage) => `${stage.short} turn ${formatClock(stage.turning)} · pause ${formatClock(stage.pause)}`)
    .join(" · ");
  return `<p class="timer-time-effort">${escapeHtml(text)}</p>`;
}

export function displayedStageIds(splits) {
  if (!splits) return [];
  if (Number.isFinite(Number(splits.oll)) && Number.isFinite(Number(splits.pll))) return ["cross", "f2l", "oll", "pll"];
  if ([splits.cross, splits.f2l, splits.final].every((n) => Number.isFinite(Number(n)) && Number(n) >= 0)) {
    return ["cross", "f2l", "final"];
  }
  return [];
}

/**
 * The stage that cost the most versus that stage's ao100, or versus goal pace
 * when ao100 is not filled in yet. No comparison when neither reference exists.
 */
export function describeBottleneck({ splits, refs = {}, goalMs = null } = {}) {
  const ids = displayedStageIds(splits);
  const stages = ids
    .map((id) => ({
      id,
      short: STEP_META[id].short,
      ms: Number(splits[id]),
      ref: refs[id] || {},
    }))
    .filter((stage) => Number.isFinite(stage.ms) && stage.ms >= 0);
  if (!stages.length) return null;

  const allAo = stages.every((stage) => Number.isFinite(stage.ref.ao100));
  const goal = Number(goalMs);
  const allGoal =
    Number.isFinite(goal) &&
    goal > 0 &&
    stages.every((stage) => stage.ref.count >= 5 && Number.isFinite(stage.ref.mean));

  if (!allAo && !allGoal) {
    const slow = stages.reduce((best, stage) => (stage.ms > best.ms ? stage : best));
    return {
      id: slow.id,
      short: slow.short,
      ms: slow.ms,
      gap: null,
      basis: null,
      over: true,
      bottleneck: `Bottleneck ${slow.short} ${formatClock(slow.ms)}`,
      drill: `Drill ${slow.short}`,
    };
  }

  let pace = null;
  const basis = allAo ? "ao100" : "goal";
  if (basis === "goal") {
    const sum = stages.reduce((total, stage) => total + stage.ref.mean, 0);
    pace = Object.fromEntries(stages.map((stage) => [stage.id, (goal * stage.ref.mean) / sum]));
  }
  const scored = stages.map((stage) => {
    const reference = basis === "ao100" ? stage.ref.ao100 : pace[stage.id];
    return { ...stage, gap: stage.ms - reference };
  });
  const over = scored.filter((stage) => stage.gap > 100);
  const versus = basis === "ao100" ? "your ao100" : "goal pace";
  if (!over.length) {
    return { id: null, basis, over: false, bottleneck: `No stage over ${versus}`, drill: "" };
  }
  over.sort((a, b) => b.gap - a.gap || b.ms - a.ms);
  const pick = over[0];
  return {
    id: pick.id,
    short: pick.short,
    ms: pick.ms,
    gap: pick.gap,
    basis,
    over: true,
    bottleneck: `Bottleneck ${pick.short} ${formatClock(pick.ms)} · ${formatClock(pick.gap)} over ${versus}`,
    drill: `Drill ${pick.short}`,
  };
}

export function renderLevelChip(stats) {
  const ao = stats?.ao100;
  const count = Number(stats?.count) || 0;
  const value = Number.isFinite(ao) ? `ao100 ${formatClock(ao)}` : "ao100 —";
  const need = Number.isFinite(ao) ? "" : `<span class="coach-level-need">${Math.min(count, LEVEL_WINDOW)}/${LEVEL_WINDOW}</span>`;
  return `<span class="coach-level-kicker">Level</span><strong class="coach-level-value">${escapeHtml(value)}</strong>${need}`;
}

export function renderCoachFocus(line) {
  if (!line?.bottleneck) return "";
  const drill = line.drill ? `<p class="coach-drill">${escapeHtml(line.drill)}</p>` : "";
  return `<p class="coach-bottleneck">${escapeHtml(line.bottleneck)}</p>${drill}`;
}

function renderHistogram(hist) {
  if (!hist.count) {
    return `<p class="coach-hist-empty">A histogram of the last 100 appears after a solve.</p>`;
  }
  const peak = Math.max(...hist.bins.map((bin) => bin.count), 1);
  const caption =
    hist.count >= LEVEL_WINDOW ? "Last 100 solves" : `Last ${hist.count} solve${hist.count === 1 ? "" : "s"}`;
  const rows = hist.bins
    .map((bin) => {
      const width = bin.count ? Math.max(4, Math.round((bin.count / peak) * 100)) : 0;
      return `<div class="coach-hist-row">
        <span>${escapeHtml(bin.label)}</span>
        <span class="coach-hist-track"><span class="coach-hist-fill" style="width:${width}%"></span></span>
        <span>${bin.count}</span>
      </div>`;
    })
    .join("");
  const summary = hist.bins.map((bin) => `${bin.count} in ${bin.label}`).join(", ");
  return `<div class="coach-hist" role="img" aria-label="${escapeHtml(`${caption}: ${summary}`)}">
    <p class="coach-hist-caption">${escapeHtml(caption)}</p>
    ${rows}
  </div>`;
}

function renderSubs(subs) {
  const bits = subs.rows
    .map((row) => {
      const value = row.pct == null ? "—" : `${row.pct}%`;
      const title =
        row.pct == null ? "" : ` title="${row.under} of ${subs.count} under ${row.sec} seconds"`;
      return `<span${title}>sub-${row.sec} <strong>${value}</strong></span>`;
    })
    .join("");
  const label =
    subs.count >= LEVEL_WINDOW ? "Last 100" : subs.count > 0 ? `Last ${subs.count}` : "Last 100";
  return `<p class="coach-subs"><span class="coach-subs-label">${label}</span> ${bits}</p>`;
}

export function renderCoachingDetail({ stats, goalMs = null, outlook = null } = {}) {
  const subs = subPercents(stats?.last100);
  const hist = timeHistogram(stats?.last100);
  const goalValue = formatGoalSeconds(goalMs);
  const outlookText = formatGoalOutlook(outlook || { reason: goalMs == null ? "none" : "short", need: LEVEL_WINDOW });
  return `<section class="coach-detail" aria-label="Level">
    <div class="coach-detail-levels">
      <p class="coach-ao"><em>ao100</em><strong>${dash(stats?.ao100)}</strong></p>
      <p class="coach-mean"><em>All-time mean</em><strong>${dash(stats?.mean)}</strong></p>
    </div>
    ${renderSubs(subs)}
    ${renderHistogram(hist)}
    <form class="coach-goal" id="coach-goal-form">
      <label class="coach-goal-label" for="coach-goal-input">Target ao100</label>
      <input id="coach-goal-input" name="goal" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="40" value="${escapeHtml(goalValue)}" aria-label="Target ao100 in seconds" />
      <span class="coach-goal-unit">s</span>
      <button type="submit" class="btn btn-small btn-ghost">Set</button>
    </form>
    <p class="coach-eta">${escapeHtml(outlookText)}</p>
  </section>`;
}

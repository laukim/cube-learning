import { COLOR_HEX, applyAlg, faceletsToString, solvedFacelets } from "./cube.js?v=cube1";
import { NOISY_ALG_NAMES, countNamedAlgs, countYTurns, formatAlgCounts } from "./coach-report.js?v=cube2";
import {
  formatMoveMeta,
  moveNotation,
  normalizeMoves,
  pausesBetween,
  RECOGNITION_PAUSE_MS,
  reconstructionHooks,
  worstPause,
} from "./move-log.js?v=p2coach1";

const LETTER_COLOR = {
  U: "yellow",
  R: "red",
  F: "blue",
  D: "white",
  L: "orange",
  B: "green",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Coach facelets after `scramble` on a solved cube. Blank if cubejs cannot apply it. */
export function faceletsForScramble(scramble) {
  try {
    const facelets = solvedFacelets();
    const alg = String(scramble || "").trim();
    if (alg) applyAlg(facelets, alg);
    return faceletsToString(facelets);
  } catch {
    return "";
  }
}

function faceCells(facelets, face) {
  const start = face * 9;
  let cells = "";
  for (let i = 0; i < 9; i++) {
    const letter = facelets[start + i] || "";
    const color = LETTER_COLOR[letter];
    const fill = COLOR_HEX[color] || "#2a2a2e";
    const col = i % 3;
    const row = Math.floor(i / 3);
    cells += `<rect x="${col * 16}" y="${row * 16}" width="15" height="15" rx="2" fill="${fill}"/>`;
  }
  return cells;
}

/** Small unfolded cube. Facelets are coach letters (U yellow … B green). */
export function renderCubeNet(facelets) {
  const text = String(facelets || "");
  if (text.length !== 54) return "";
  const faces = [
    { id: 0, x: 52, y: 2 },
    { id: 4, x: 2, y: 52 },
    { id: 2, x: 52, y: 52 },
    { id: 1, x: 102, y: 52 },
    { id: 5, x: 152, y: 52 },
    { id: 3, x: 52, y: 102 },
  ];
  const groups = faces
    .map((face) => `<g transform="translate(${face.x} ${face.y})">${faceCells(text, face.id)}</g>`)
    .join("");
  return `<svg class="cube-net" viewBox="0 0 202 152" role="img" aria-label="Cube state, white on the bottom and blue in front">${groups}</svg>`;
}

function formatGap(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Elapsed time when F2L was marked. Null when the solve has no stage marks. */
function f2lDoneMs(splits) {
  if (!splits || typeof splits !== "object") return null;
  const cross = Number(splits.cross);
  const f2l = Number(splits.f2l);
  if (!Number.isFinite(cross) || !Number.isFinite(f2l) || cross < 0 || f2l < 0) return null;
  return cross + f2l;
}

/**
 * Stage of the move that ended a pause.
 * That move belongs to Cross or F2L when it lands on the mark, and to Final after F2L.
 */
function stageAt(at, splits) {
  if (!splits || typeof splits !== "object") return "";
  const crossEnd = Number(splits.cross);
  const f2l = Number(splits.f2l);
  if (!Number.isFinite(crossEnd) || !Number.isFinite(f2l) || crossEnd < 0 || f2l < 0) return "";
  const f2lEnd = crossEnd + f2l;
  if (at <= crossEnd) return "Cross";
  if (at <= f2lEnd) return "F2L";
  const oll = Number(splits.oll);
  const pll = Number(splits.pll);
  if (Number.isFinite(oll) && Number.isFinite(pll) && oll >= 0 && pll > 0 && Math.abs(oll + pll - (Number(splits.final) || oll + pll)) <= 1) {
    if (at <= f2lEnd + oll) return "OLL";
    return "PLL";
  }
  return "Final";
}

/** Moves strictly after the F2L mark. Empty until the solve has stage marks. */
function lastLayerNotation(moves, splits) {
  const done = f2lDoneMs(splits);
  if (done == null) return "";
  const list = normalizeMoves(moves) || [];
  const layer = list.filter((row) => row.t > done);
  if (!layer.length) return "";
  return layer.map((row) => row.move).join(" ");
}

function lastLayerAlgLine(moves, splits) {
  const notation = lastLayerNotation(moves, splits);
  if (!notation) return "";
  const counts = countNamedAlgs(notation);
  for (const name of NOISY_ALG_NAMES) delete counts[name];
  return formatAlgCounts(counts, countYTurns(notation));
}

function segmentAt(t, segments) {
  if (!segments?.length) return null;
  for (const segment of segments) {
    if (t < segment.start) return null;
    if (t <= segment.end) return segment;
  }
  return null;
}

function renderPhaseStrip(segments, moves) {
  if (!segments?.length) return "";
  const end = segments[segments.length - 1].end;
  if (!(end > 0)) return "";
  const bars = [];
  const labels = [];
  for (const segment of segments) {
    const duration = segment.end - segment.start;
    if (duration <= 0) continue;
    const grow = Math.max(1, Math.round(duration));
    const cls = [`is-${segment.id}`, segment.pair ? "is-pair" : "", segment.alt ? "is-alt" : ""]
      .filter(Boolean)
      .join(" ");
    const title = `${segment.label} ${formatGap(duration)}`;
    bars.push(
      `<span class="timer-recon-seg ${cls}" style="flex:${grow} 1 0" title="${escapeHtml(title)}"></span>`
    );
    labels.push(
      `<span class="${cls}" style="flex:${grow} 1 0" title="${escapeHtml(title)}">${escapeHtml(segment.label)}</span>`
    );
  }
  if (!bars.length) return "";
  const pauses = pausesBetween(moves, RECOGNITION_PAUSE_MS).filter((pause) => pause.at > 0 && pause.at <= end + 1);
  const marks = pauses
    .map((pause) => {
      const pct = Math.max(0, Math.min(100, (pause.at / end) * 100));
      const title = `Pause ${formatGap(pause.ms)} before ${pause.before}`;
      return `<span class="timer-recon-pause" style="left:${pct.toFixed(2)}%" title="${escapeHtml(title)}"></span>`;
    })
    .join("");
  const phaseBits = segments
    .filter((segment) => segment.end > segment.start)
    .map((segment) => `${segment.label} ${formatGap(segment.end - segment.start)}`);
  const pauseBits = pauses.map((pause) => `${formatGap(pause.ms)} before ${pause.before}`);
  const aria = pauseBits.length
    ? `Phases: ${phaseBits.join(", ")}. Pauses: ${pauseBits.join(", ")}.`
    : `Phases: ${phaseBits.join(", ")}.`;
  return `<div class="timer-recon-strip">
    <div class="timer-recon-bar" role="img" aria-label="${escapeHtml(aria)}">${bars.join("")}${marks}</div>
    <div class="timer-recon-legend" aria-hidden="true">${labels.join("")}</div>
  </div>`;
}

function pauseLine(pause, splits) {
  if (!pause) return "";
  const stage = stageAt(pause.at, splits);
  const where = stage ? ` in ${stage}` : "";
  return `Worst pause ${formatGap(pause.ms)}${where} at ${formatGap(pause.at)}, after ${pause.after} before ${pause.before}`;
}

/**
 * Move list for a solve that was recorded from the cube.
 * The pause line is the longest gap of at least 3s.
 * Named algs are longer last-layer matches after the F2L mark. Short triggers stay hidden.
 * `totalMs` adds turns per second to the summary. Without it the summary stays the move count.
 */
export function renderReconstruction(moves, splits, totalMs = null) {
  const hooks = reconstructionHooks(moves, splits);
  if (!hooks.moves.length) return "";
  const meta = formatMoveMeta(hooks.moves, totalMs);
  const count = hooks.moves.length;
  const countLabel = meta || `${count} move${count === 1 ? "" : "s"}`;
  const pauseByAt = new Map();
  for (const pause of pausesBetween(hooks.moves, RECOGNITION_PAUSE_MS)) pauseByAt.set(pause.at, pause);
  const tokens = hooks.moves
    .map((row) => {
      const segment = segmentAt(row.t, hooks.segments);
      const pause = pauseByAt.get(row.t);
      const cls = ["timer-recon-move", segment ? `is-${segment.id}` : "", pause ? "is-pause" : ""]
        .filter(Boolean)
        .join(" ");
      let title = formatGap(row.t);
      if (pause) title += ` · pause ${formatGap(pause.ms)}`;
      return `<span class="${cls}" title="${escapeHtml(title)}">${escapeHtml(row.move)}</span>`;
    })
    .join(" ");
  const named = lastLayerAlgLine(hooks.moves, splits);
  const namedHtml = named ? `<p class="timer-reconstruction-algs">${escapeHtml(named)}</p>` : "";
  const pause = worstPause(hooks.moves);
  const pauseText = pauseLine(pause, splits);
  const pauseHtml = pauseText
    ? `<p class="timer-reconstruction-pause">${escapeHtml(pauseText)}</p>`
    : "";
  const strip = renderPhaseStrip(hooks.segments, hooks.moves);
  return `<div class="timer-reconstruction-block">
    ${strip}
    <details class="timer-reconstruction">
      <summary>
        <span class="timer-reconstruction-kicker">Reconstruction · ${countLabel}</span>
        <span class="timer-reconstruction-show">Show</span>
        <span class="timer-reconstruction-hide">Hide</span>
      </summary>
      <div class="timer-reconstruction-panel">
        <p class="timer-reconstruction-moves">${tokens}</p>
        ${namedHtml}
        ${pauseHtml}
      </div>
    </details>
  </div>`;
}

export function reconstructionNotation(moves) {
  return moveNotation(moves);
}

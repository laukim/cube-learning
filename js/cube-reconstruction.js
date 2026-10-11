import { COLOR_HEX, applyAlg, faceletsToString, solvedFacelets } from "./cube.js?v=cube1";
import { NOISY_ALG_NAMES, countNamedAlgs, countYTurns, formatAlgCounts } from "./coach-report.js?v=cube2";
import { moveNotation, normalizeMoves, reconstructionHooks, worstPause } from "./move-log.js?v=cube2";

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
 */
export function renderReconstruction(moves, splits) {
  const hooks = reconstructionHooks(moves);
  if (!hooks.moves.length) return "";
  const tokens = hooks.moves
    .map((row) => {
      const at = formatGap(row.t);
      return `<span class="timer-recon-move" title="${escapeHtml(at)}">${escapeHtml(row.move)}</span>`;
    })
    .join(" ");
  const named = lastLayerAlgLine(hooks.moves, splits);
  const namedHtml = named ? `<p class="timer-reconstruction-algs">${escapeHtml(named)}</p>` : "";
  const pause = worstPause(hooks.moves);
  const pauseText = pauseLine(pause, splits);
  const pauseHtml = pauseText
    ? `<p class="timer-reconstruction-pause">${escapeHtml(pauseText)}</p>`
    : "";
  const count = hooks.moves.length;
  const countLabel = `${count} move${count === 1 ? "" : "s"}`;
  return `<details class="timer-reconstruction">
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
  </details>`;
}

export function reconstructionNotation(moves) {
  return moveNotation(moves);
}

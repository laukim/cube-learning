import { COLOR_HEX, applyAlg, faceletsToString, solvedFacelets } from "./cube.js?v=cube1";
import { countNamedAlgs, countYTurns, formatAlgCounts } from "./coach-report.js?v=cube1";
import { moveNotation, normalizeMoves, pausesBetween, reconstructionHooks } from "./move-log.js?v=cube1";

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

/**
 * Move list for a solve that was recorded from the cube.
 * Named algs reuse the coach's alg list. Stage splits are a follow-up.
 */
export function renderReconstruction(moves) {
  const hooks = reconstructionHooks(moves);
  if (!hooks.moves.length) return "";
  // TODO(coaching): render hooks.cross / hooks.f2lPairs / hooks.oll / hooks.pll
  // once those are filled in. Pauses are only listed, not turned into advice.
  const tokens = hooks.moves
    .map((row) => {
      const at = formatGap(row.t);
      return `<span class="timer-recon-move" title="${escapeHtml(at)}">${escapeHtml(row.move)}</span>`;
    })
    .join(" ");
  const named = formatAlgCounts(countNamedAlgs(hooks.notation), countYTurns(hooks.notation));
  const namedHtml = named ? `<p class="timer-reconstruction-algs">${escapeHtml(named)}</p>` : "";
  const pause = pausesBetween(hooks.moves)[0];
  const pauseHtml = pause
    ? `<p class="timer-reconstruction-pause">Pause ${escapeHtml(formatGap(pause.ms))} before ${escapeHtml(pause.before)}</p>`
    : "";
  return `<div class="timer-reconstruction">
    <p class="timer-reconstruction-kicker">Reconstruction · ${hooks.moves.length} move${hooks.moves.length === 1 ? "" : "s"}</p>
    <p class="timer-reconstruction-moves">${tokens}</p>
    ${namedHtml}
    ${pauseHtml}
  </div>`;
}

export function reconstructionNotation(moves) {
  return moveNotation(moves);
}

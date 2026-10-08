/**
 * Smart-cube move log and GAN → coach orientation.
 *
 * GAN firmware reports faces in its own coordinates (solved: white on U, green
 * on F, red on R). The coach holds white on the bottom and blue in front, so
 * yellow is U and blue is F. Moves and facelets are converted into that hold
 * before they are stored or compared with a scramble.
 *
 * TODO(coaching): segment a stored log into Cross, each F2L pair, OLL, and PLL.
 * `reconstructionHooks` is the hand-off; this module only normalizes the log.
 */

const FACES = ["U", "R", "F", "D", "L", "B"];

/** Home-face colour on a GAN cube (white top, green front). */
export const GAN_FACE_COLOR = {
  U: "white",
  R: "red",
  F: "green",
  D: "yellow",
  L: "orange",
  B: "blue",
};

/** Home-face colour in the coach (white bottom, blue front). */
export const APP_FACE_COLOR = {
  U: "yellow",
  R: "red",
  F: "blue",
  D: "white",
  L: "orange",
  B: "green",
};

const APP_COLOR_FACE = Object.fromEntries(Object.entries(APP_FACE_COLOR).map(([face, color]) => [color, face]));

/** GAN face turn → the same physical face in coach notation. Clockwise stays clockwise. */
const GAN_MOVE_FACE = { U: "D", D: "U", F: "B", B: "F", R: "R", L: "L" };
const APP_MOVE_FACE = { U: "D", D: "U", F: "B", B: "F", R: "R", L: "L" };

const MAX_MOVES = 400;
const MAX_T = 48 * 60 * 60 * 1000;

function U(x) {
  return x - 1;
}
function R(x) {
  return U(9) + x;
}
function F(x) {
  return R(9) + x;
}
function D(x) {
  return F(9) + x;
}
function L(x) {
  return D(9) + x;
}
function B(x) {
  return L(9) + x;
}

/** Corner / edge facelet indices, same order cubejs uses for URFDLB. */
const CORNER_SLOTS = [
  [["U", "R", "F"], [U(9), R(1), F(3)]],
  [["U", "F", "L"], [U(7), F(1), L(3)]],
  [["U", "L", "B"], [U(1), L(1), B(3)]],
  [["U", "B", "R"], [U(3), B(1), R(3)]],
  [["D", "F", "R"], [D(3), F(9), R(7)]],
  [["D", "L", "F"], [D(1), L(9), F(7)]],
  [["D", "B", "L"], [D(7), B(9), L(7)]],
  [["D", "R", "B"], [D(9), R(9), B(7)]],
];

const EDGE_SLOTS = [
  [["U", "R"], [U(6), R(2)]],
  [["U", "F"], [U(8), F(2)]],
  [["U", "L"], [U(4), L(2)]],
  [["U", "B"], [U(2), B(2)]],
  [["D", "R"], [D(6), R(8)]],
  [["D", "F"], [D(2), F(8)]],
  [["D", "L"], [D(4), L(8)]],
  [["D", "B"], [D(8), B(8)]],
  [["F", "R"], [F(6), R(4)]],
  [["F", "L"], [F(4), L(6)]],
  [["B", "L"], [B(6), L(4)]],
  [["B", "R"], [B(4), R(6)]],
];

function buildSlots() {
  const slots = Array(54).fill(null);
  for (let face = 0; face < 6; face++) {
    slots[face * 9 + 4] = { kind: "center", faces: [FACES[face]], slot: 0 };
  }
  for (const [faces, indices] of CORNER_SLOTS) {
    indices.forEach((index, slot) => {
      slots[index] = { kind: "corner", faces, slot };
    });
  }
  for (const [faces, indices] of EDGE_SLOTS) {
    indices.forEach((index, slot) => {
      slots[index] = { kind: "edge", faces, slot };
    });
  }
  if (slots.some((slot) => !slot)) throw new Error("facelet slot map is incomplete");
  return slots;
}

const SLOTS = buildSlots();

function sameColors(a, b) {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((color, i) => color === right[i]);
}

function colorsOf(faces, scheme) {
  return faces.map((face) => scheme[face]);
}

/** GAN facelet index → coach facelet index for the same physical sticker. */
function buildGanToApp() {
  const map = Array(54).fill(-1);
  for (let ganIndex = 0; ganIndex < 54; ganIndex++) {
    const piece = SLOTS[ganIndex];
    const ganColors = colorsOf(piece.faces, GAN_FACE_COLOR);
    const sticker = ganColors[piece.slot];
    let found = -1;
    for (let appIndex = 0; appIndex < 54; appIndex++) {
      const appPiece = SLOTS[appIndex];
      if (appPiece.kind !== piece.kind) continue;
      const appColors = colorsOf(appPiece.faces, APP_FACE_COLOR);
      if (appColors[appPiece.slot] === sticker && sameColors(appColors, ganColors)) {
        found = appIndex;
        break;
      }
    }
    if (found < 0) throw new Error(`no coach sticker for GAN facelet ${ganIndex}`);
    map[ganIndex] = found;
  }
  return map;
}

const GAN_TO_APP = buildGanToApp();

export function cubeEventMove(event) {
  const raw = String(event?.move ?? event ?? "").trim();
  const face = raw[0]?.toUpperCase();
  if (!face || !FACES.includes(face)) return "";
  const direction = Number(event?.direction);
  // Gen3/Gen4 encode a half turn as direction 2. Some payloads already say U2.
  if (direction === 2 || raw[1] === "2") return `${face}2`;
  if (direction === 1 || raw[1] === "'") return `${face}'`;
  return face;
}

function relabelMove(move, faces) {
  const token = cubeEventMove(move);
  if (!token) return "";
  const face = faces[token[0]];
  if (!face) return "";
  return face + token.slice(1);
}

export function ganMoveToApp(move) {
  return relabelMove(move, GAN_MOVE_FACE);
}

export function appMoveToGan(move) {
  return relabelMove(move, APP_MOVE_FACE);
}

/** 54-char GAN Kociemba facelets → coach facelets (white bottom, blue front). */
export function ganFaceletsToApp(ganFacelets) {
  const src = String(ganFacelets || "");
  if (src.length !== 54) return "";
  const out = Array(54);
  for (let i = 0; i < 54; i++) {
    const color = GAN_FACE_COLOR[src[i]];
    const letter = color ? APP_COLOR_FACE[color] : "";
    if (!letter) return "";
    out[GAN_TO_APP[i]] = letter;
  }
  return out.join("");
}

export function faceletsSolved(facelets) {
  const text = String(facelets || "");
  if (text.length !== 54) return false;
  for (let face = 0; face < 6; face++) {
    const center = text[face * 9 + 4];
    for (let i = 0; i < 9; i++) if (text[face * 9 + i] !== center) return false;
  }
  return true;
}

/**
 * Timestamped turns for one solve. `t` is milliseconds from the start on the
 * computer clock. `cubeT` is the cube's own clock when the packet had one.
 * Empty / junk input becomes null so older rows stay valid.
 */
export function normalizeMoves(raw) {
  if (raw == null || raw === "") return null;
  let list = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const item of list) {
    if (out.length >= MAX_MOVES) break;
    if (!item || typeof item !== "object") continue;
    const move = cubeEventMove(item.move);
    const t = Number(item.t);
    if (!move || !Number.isFinite(t) || t < 0 || t > MAX_T) continue;
    const row = { move, t: Math.round(t) };
    const cubeT = Number(item.cubeT);
    if (Number.isFinite(cubeT) && cubeT >= 0 && cubeT <= 0xffffffff) row.cubeT = Math.round(cubeT);
    out.push(row);
  }
  return out.length ? out : null;
}

export function moveNotation(moves) {
  const list = normalizeMoves(moves) || [];
  return list.map((row) => row.move).join(" ");
}

/** Gaps long enough to matter later for pause coaching. */
export function pausesBetween(moves, thresholdMs = 3000) {
  const list = normalizeMoves(moves) || [];
  const pauses = [];
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].t - list[i - 1].t;
    if (gap < thresholdMs) continue;
    pauses.push({ after: list[i - 1].move, before: list[i].move, ms: gap });
  }
  return pauses;
}

/**
 * What the practice timer should do with one cube update.
 * Spacebar handling stays in the timer; this only describes the cube path.
 * PLL and cross drill stay on spacebar — a full solve is the single / splits clock.
 */
export function cubeTimerDecision({
  phase = "idle",
  mode = "single",
  armed = false,
  inspectionSeconds = 0,
  facelets = "",
  target = "",
  solved = false,
  move = "",
  sawMove = false,
  wasUnsolved = false,
  hold = false,
} = {}) {
  if (mode !== "single" && mode !== "splits") return { action: "ignore" };
  if (move) {
    if (phase === "running") return { action: "log" };
    if (phase === "inspecting" || (phase === "idle" && armed)) return { action: "start" };
    return { action: "ignore" };
  }
  if (phase === "running" && solved && (sawMove || wasUnsolved)) return { action: "stop" };
  if (phase === "idle" && facelets && target && facelets === target) {
    if (hold) return { action: "ignore" };
    if (armed) return { action: "ready" };
    return { action: Number(inspectionSeconds) > 0 ? "inspect" : "arm" };
  }
  if (phase === "idle" && hold && facelets && target && facelets !== target) return { action: "release" };
  if (phase === "idle" && armed && facelets && target && facelets !== target) return { action: "disarm" };
  return { action: "ignore" };
}

/**
 * Shape a stored log for a later coaching pass.
 * cross / f2lPairs / oll / pll stay null until that pass exists.
 */
export function reconstructionHooks(moves) {
  const list = normalizeMoves(moves) || [];
  return {
    moves: list,
    notation: list.map((row) => row.move).join(" "),
    pauses: pausesBetween(list),
    cross: null,
    f2lPairs: null,
    oll: null,
    pll: null,
  };
}

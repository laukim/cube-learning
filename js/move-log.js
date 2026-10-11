/**
 * Smart-cube move log and GAN → coach orientation.
 *
 * GAN firmware reports faces in its own coordinates (solved: white on U, green
 * on F, red on R). The coach holds white on the bottom and blue in front, so
 * yellow is U and blue is F. Moves and facelets are converted into that hold
 * before they are stored or compared with a scramble.
 *
 * `phaseSegments` colors Cross, each detected F2L pair, OLL, and PLL from marks
 * already stored on the solve. It does not guess a phase the solve never marked.
 * Practice-timer Cross / F2L / pair marks are taken while the solve is running:
 * each move advances a shadow cube, and a facelet packet resyncs it. The first
 * time a stage is complete is kept, so a later solved packet does not restamp it.
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
 * White cross in coach letters (white on D, side colours matching the centres).
 * Corners and the last layer are ignored, so a finished cross can still be unsolved.
 */
const WHITE_CROSS_LETTERS = [
  [28, "D", 25, "F"],
  [32, "D", 16, "R"],
  [34, "D", 52, "B"],
  [30, "D", 43, "L"],
];

export function whiteCrossFaceletsDone(facelets) {
  const text = String(facelets || "");
  if (text.length !== 54) return false;
  return WHITE_CROSS_LETTERS.every(
    ([down, downLetter, side, sideLetter]) => text[down] === downLetter && text[side] === sideLetter
  );
}

/**
 * Goal that stops a cube-driven clock.
 * Single, splits, and PLL stop on a solved cube. Cross drill stops when the
 * white cross is done, even if the rest of the cube is still scrambled.
 */
export function cubeTimerGoalReached(mode, facelets) {
  if (mode === "cross") return whiteCrossFaceletsDone(facelets);
  return faceletsSolved(facelets);
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

/**
 * Move count and turns per second for one smart-cube solve.
 * TPS uses the solve's clock, pauses included. Null without a real log and time.
 */
export function solveMoveStats(moves, totalMs) {
  const list = normalizeMoves(moves);
  const ms = Number(totalMs);
  if (!list || !Number.isFinite(ms) || ms <= 0) return null;
  return { moves: list.length, tps: list.length / (ms / 1000) };
}

/** "54 moves · 1.82 tps", or "" when the solve has no cube log. */
export function formatMoveMeta(moves, totalMs) {
  const stats = solveMoveStats(moves, totalMs);
  if (!stats) return "";
  const noun = stats.moves === 1 ? "move" : "moves";
  return `${stats.moves} ${noun} · ${stats.tps.toFixed(2)} tps`;
}

/**
 * A gap this long is recognition rather than turning.
 * The phase strip marks these. The written pause line still uses the longer 3s gap.
 */
export const RECOGNITION_PAUSE_MS = 500;

/**
 * Gaps long enough to matter for pause coaching.
 * `at` is milliseconds from the start of the solve to the move after the gap.
 */
export function pausesBetween(moves, thresholdMs = 3000) {
  const list = normalizeMoves(moves) || [];
  const pauses = [];
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].t - list[i - 1].t;
    if (gap < thresholdMs) continue;
    pauses.push({ after: list[i - 1].move, before: list[i].move, ms: gap, at: list[i].t });
  }
  return pauses;
}

/** Longest gap at or above the threshold. Equal lengths keep the earlier gap. */
export function worstPause(moves, thresholdMs = 3000) {
  let worst = null;
  for (const pause of pausesBetween(moves, thresholdMs)) {
    if (!worst || pause.ms > worst.ms) worst = pause;
  }
  return worst;
}

const CUBE_TIMER_MODES = new Set(["single", "splits", "pll", "cross"]);

/**
 * What the practice timer should do with one cube update.
 * Spacebar handling stays in the timer; this only describes the cube path.
 * Single and splits arm on the full scramble. PLL arms on the case setup.
 * Cross drill arms on the cross scramble. `solved` is that mode's goal:
 * a solved cube, or a finished white cross for Cross drill.
 * This does not mark PLL or Cross drill solves as Cross / F2L splits.
 *
 * After a Single or splits solve, `awaitingScramble` means the next scramble
 * is not loaded yet. Any move deals it. Matching that scramble still inspects
 * or arms. PLL and Cross drill do not use this: a setup turn must not replace
 * the dealt case, and the clock still waits until the cube matches.
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
  awaitingScramble = false,
} = {}) {
  if (!CUBE_TIMER_MODES.has(mode)) return { action: "ignore" };
  const dealsNext = awaitingScramble && (mode === "single" || mode === "splits");
  if (move) {
    if (phase === "running") return { action: "log" };
    if (phase === "inspecting" || (phase === "idle" && armed)) return { action: "start" };
    if (phase === "idle" && dealsNext) return { action: "deal" };
    return { action: "ignore" };
  }
  if (phase === "running" && solved && (sawMove || wasUnsolved)) return { action: "stop" };
  if (phase === "idle" && dealsNext) return { action: "ignore" };
  if (phase === "idle" && facelets && target && facelets === target) {
    if (hold) return { action: "ignore" };
    if (armed) return { action: "ready" };
    return { action: Number(inspectionSeconds) > 0 ? "inspect" : "arm" };
  }
  if (phase === "idle" && hold && facelets && target && facelets !== target) return { action: "release" };
  if (phase === "idle" && armed && facelets && target && facelets !== target) return { action: "disarm" };
  return { action: "ignore" };
}

const F2L_PAIR_ORDER = ["FR", "BR", "BL", "FL"];

function markedStages(splits) {
  if (!splits || typeof splits !== "object") return null;
  const cross = Number(splits.cross);
  const f2l = Number(splits.f2l);
  const final = Number(splits.final);
  if (![cross, f2l, final].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { cross, f2l, final, f2lEnd: cross + f2l };
}

function pushSegment(segments, segment) {
  if (segment.end - segment.start > 0) segments.push(segment);
}

/** Pair marks that finished during F2L, grouped when they land on the same instant. */
function f2lPairGroups(pairs, start, end) {
  if (!Array.isArray(pairs)) return [];
  const rows = [];
  const seen = new Set();
  for (const item of pairs) {
    const id = String(item?.id || "");
    const at = Number(item?.at);
    if (!F2L_PAIR_ORDER.includes(id) || seen.has(id)) continue;
    if (!Number.isFinite(at) || at <= start || at > end + 1) continue;
    seen.add(id);
    rows.push({ id, at: Math.min(end, at) });
  }
  rows.sort((a, b) => a.at - b.at || F2L_PAIR_ORDER.indexOf(a.id) - F2L_PAIR_ORDER.indexOf(b.id));
  const groups = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.at - row.at) <= 1) last.ids.push(row.id);
    else groups.push({ at: row.at, ids: [row.id] });
  }
  return groups;
}

/**
 * Phases a reconstruction can color.
 * Cross, F2L, and Final come from the stored split marks. Pair names come only
 * from pair marks inside the F2L window. OLL and PLL are included only when
 * both were stored and they add up to Final. Anything not detected stays null.
 */
export function phaseSegments(splits) {
  const empty = { segments: null, cross: null, f2lPairs: null, oll: null, pll: null };
  const marks = markedStages(splits);
  if (!marks) return empty;
  const segments = [];
  pushSegment(segments, { id: "cross", label: "Cross", pair: false, start: 0, end: marks.cross });

  const groups = f2lPairGroups(splits.pairs, marks.cross, marks.f2lEnd);
  const f2lPairs = [];
  if (groups.length) {
    let cursor = marks.cross;
    let alt = false;
    for (const group of groups) {
      const at = Math.max(cursor, Math.min(marks.f2lEnd, group.at));
      if (at > cursor) {
        const ids = group.ids.slice();
        segments.push({
          id: "f2l",
          label: ids.join(" "),
          pair: true,
          alt,
          ids,
          start: cursor,
          end: at,
        });
        f2lPairs.push({ ids, start: cursor, end: at });
        alt = !alt;
      }
      cursor = at;
    }
    if (marks.f2lEnd - cursor > 1) {
      pushSegment(segments, { id: "f2l", label: "F2L", pair: false, start: cursor, end: marks.f2lEnd });
    }
  } else {
    pushSegment(segments, { id: "f2l", label: "F2L", pair: false, start: marks.cross, end: marks.f2lEnd });
  }

  const oll = Number(splits.oll);
  const pll = Number(splits.pll);
  const layer =
    Number.isFinite(oll) && Number.isFinite(pll) && oll >= 0 && pll > 0 && Math.abs(oll + pll - marks.final) <= 1;
  if (layer) {
    const ollEnd = marks.f2lEnd + oll;
    pushSegment(segments, { id: "oll", label: "OLL", pair: false, start: marks.f2lEnd, end: ollEnd });
    pushSegment(segments, { id: "pll", label: "PLL", pair: false, start: ollEnd, end: ollEnd + pll });
  } else {
    pushSegment(segments, { id: "final", label: "Final", pair: false, start: marks.f2lEnd, end: marks.f2lEnd + marks.final });
  }

  if (!segments.length) return empty;
  const cross = segments.find((segment) => segment.id === "cross") || null;
  const ollSeg = segments.find((segment) => segment.id === "oll") || null;
  const pllSeg = segments.find((segment) => segment.id === "pll") || null;
  return {
    segments,
    cross: cross ? { start: cross.start, end: cross.end } : null,
    f2lPairs: f2lPairs.length ? f2lPairs : null,
    oll: ollSeg ? { start: ollSeg.start, end: ollSeg.end } : null,
    pll: pllSeg ? { start: pllSeg.start, end: pllSeg.end } : null,
  };
}

/**
 * Shape a stored log for coaching.
 * Pass the solve's splits to fill cross, f2lPairs, oll, and pll.
 * Those stay null when that phase was not detected — pair names are not guessed,
 * and OLL/PLL are not inferred from a Final that was never split.
 */
export function reconstructionHooks(moves, splits = null) {
  const list = normalizeMoves(moves) || [];
  const phases = phaseSegments(splits);
  return {
    moves: list,
    notation: list.map((row) => row.move).join(" "),
    pauses: pausesBetween(list),
    cross: phases.cross,
    f2lPairs: phases.f2lPairs,
    oll: phases.oll,
    pll: phases.pll,
    segments: phases.segments,
  };
}

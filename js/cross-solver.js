/**
 * Optimal white cross on the bottom.
 *
 * The four white edges (white-red, white-blue, white-orange, white-green)
 * sit in 4 of the 12 edge slots, each flipped or not: C(12,4) × 4! × 2^4
 * = 190,080 states. A breadth-first search on that graph is the shortest
 * face-turn solution with white kept on the bottom (no x/y/z).
 *
 * A drill scramble is the inverse of that solution, so applying it to a
 * solved cube lands on a uniform random cross state. Face turns also move
 * other pieces; the drill only times the cross.
 */

import { invertAlgNotation } from "./alg.js";

/** UR UF UL UB DR DF DL DB FR FL BL BR — cubejs edge slot order. */
const SLOT_COUNT = 12;
/** Solved slots of the white edges, in piece order DR, DF, DL, DB. */
const HOME = [4, 5, 6, 7];
const PIECE_COUNT = 4;
export const CROSS_STATE_COUNT = 190080;
const FACT = [1, 1, 2, 6, 24];

/**
 * Preferred tie-break: right-hand faces first. Every sequence is still
 * a shortest solution in face-turn metric.
 */
const FACE_ORDER = ["R", "U", "F", "L", "D", "B"];

/** Quarter-turn source slot and orientation, copied from cubejs Cube.moves. */
const QUARTER = {
  U: {
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  R: {
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  F: {
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  L: {
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  B: {
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
};

const C = Array.from({ length: 13 }, () => [1, 0, 0, 0, 0]);
for (let n = 1; n <= 12; n++) {
  for (let k = 1; k <= 4; k++) C[n][k] = C[n - 1][k] + C[n - 1][k - 1];
}

export const CROSS_MOVE_NAMES = FACE_ORDER.flatMap((face) => [face, `${face}'`, `${face}2`]);
export const CROSS_HOLD = "White on bottom, blue in front";

const DEST = [];
const FLIP = [];

function quarterTables(ep, eo) {
  const destOf = new Uint8Array(SLOT_COUNT);
  const flipMask = new Uint8Array(SLOT_COUNT);
  for (let to = 0; to < SLOT_COUNT; to++) {
    destOf[ep[to]] = to;
    flipMask[ep[to]] = eo[to];
  }
  return { destOf, flipMask };
}

function composeMove(a, b) {
  const destOf = new Uint8Array(SLOT_COUNT);
  const flipMask = new Uint8Array(SLOT_COUNT);
  for (let src = 0; src < SLOT_COUNT; src++) {
    const mid = a.destOf[src];
    destOf[src] = b.destOf[mid];
    flipMask[src] = a.flipMask[src] ^ b.flipMask[mid];
  }
  return { destOf, flipMask };
}

for (const face of FACE_ORDER) {
  const quarter = quarterTables(QUARTER[face].ep, QUARTER[face].eo);
  const half = composeMove(quarter, quarter);
  const inverse = composeMove(half, quarter);
  DEST.push(quarter.destOf, inverse.destOf, half.destOf);
  FLIP.push(quarter.flipMask, inverse.flipMask, half.flipMask);
}

function inverseMoveIndex(move) {
  const kind = move % 3;
  if (kind === 2) return move;
  return move + (kind === 0 ? 1 : -1);
}

const INV = Uint8Array.from({ length: DEST.length }, (_, move) => inverseMoveIndex(move));

function rankPerm(p0, p1, p2, p3) {
  let used = 0;
  let rank = 0;
  const pieces = [p0, p1, p2, p3];
  for (let i = 0; i < PIECE_COUNT; i++) {
    const piece = pieces[i];
    let less = 0;
    for (let j = 0; j < piece; j++) if ((used & (1 << j)) === 0) less++;
    rank += less * FACT[3 - i];
    used |= 1 << piece;
  }
  return rank;
}

function encodeLoc(l0, l1, l2, l3, o0, o1, o2, o3) {
  let s0 = l0;
  let s1 = l1;
  let s2 = l2;
  let s3 = l3;
  let a0 = 0;
  let a1 = 1;
  let a2 = 2;
  let a3 = 3;
  let tmp;
  if (s0 > s1) {
    tmp = s0;
    s0 = s1;
    s1 = tmp;
    tmp = a0;
    a0 = a1;
    a1 = tmp;
  }
  if (s2 > s3) {
    tmp = s2;
    s2 = s3;
    s3 = tmp;
    tmp = a2;
    a2 = a3;
    a3 = tmp;
  }
  if (s0 > s2) {
    tmp = s0;
    s0 = s2;
    s2 = tmp;
    tmp = a0;
    a0 = a2;
    a2 = tmp;
  }
  if (s1 > s3) {
    tmp = s1;
    s1 = s3;
    s3 = tmp;
    tmp = a1;
    a1 = a3;
    a3 = tmp;
  }
  if (s1 > s2) {
    tmp = s1;
    s1 = s2;
    s2 = tmp;
    tmp = a1;
    a1 = a2;
    a2 = tmp;
  }
  const comb = C[s0][1] + C[s1][2] + C[s2][3] + C[s3][4];
  const perm = rankPerm(a0, a1, a2, a3);
  const ori = (o0 ? 1 : 0) | (o1 ? 2 : 0) | (o2 ? 4 : 0) | (o3 ? 8 : 0);
  return (comb * 24 + perm) * 16 + ori;
}

function unrankComb(rank, out) {
  let r = rank;
  let k = 4;
  for (let i = 3; i >= 0; i--) {
    let n = k - 1;
    while (n < 12 && C[n + 1][k] <= r) n++;
    out[i] = n;
    r -= C[n][k];
    k--;
  }
}

function unrankPerm(rank, out) {
  let used = 0;
  let r = rank;
  for (let i = 0; i < PIECE_COUNT; i++) {
    const factor = FACT[3 - i];
    let q = (r / factor) | 0;
    r -= q * factor;
    let seen = 0;
    for (let digit = 0; digit < PIECE_COUNT; digit++) {
      if (used & (1 << digit)) continue;
      if (seen === q) {
        out[i] = digit;
        used |= 1 << digit;
        break;
      }
      seen++;
    }
  }
}

function decode(index, loc, ori) {
  const o = index % 16;
  const rest = (index / 16) | 0;
  const perm = rest % 24;
  const comb = (rest / 24) | 0;
  const slots = [0, 0, 0, 0];
  const pieces = [0, 0, 0, 0];
  unrankComb(comb, slots);
  unrankPerm(perm, pieces);
  for (let i = 0; i < PIECE_COUNT; i++) loc[pieces[i]] = slots[i];
  ori[0] = o & 1;
  ori[1] = (o >> 1) & 1;
  ori[2] = (o >> 2) & 1;
  ori[3] = (o >> 3) & 1;
}

export const SOLVED_CROSS_INDEX = encodeLoc(HOME[0], HOME[1], HOME[2], HOME[3], 0, 0, 0, 0);

let solveMove = null;
let distance = null;
let godsNumber = 0;

/** Build the shortest-path table. Safe to call more than once. */
export function warmCrossSolver() {
  if (solveMove) return godsNumber;
  const n = CROSS_STATE_COUNT;
  const movesTowardSolved = new Uint8Array(n);
  const dist = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const qLoc = new Uint8Array(n * 4);
  const qOri = new Uint8Array(n * 4);
  const qIdx = new Int32Array(n);

  qIdx[0] = SOLVED_CROSS_INDEX;
  qLoc[0] = HOME[0];
  qLoc[1] = HOME[1];
  qLoc[2] = HOME[2];
  qLoc[3] = HOME[3];
  seen[SOLVED_CROSS_INDEX] = 1;
  movesTowardSolved[SOLVED_CROSS_INDEX] = 255;

  let qh = 0;
  let qt = 1;
  let maxDepth = 0;
  while (qh < qt) {
    const base = qh << 2;
    const l0 = qLoc[base];
    const l1 = qLoc[base + 1];
    const l2 = qLoc[base + 2];
    const l3 = qLoc[base + 3];
    const o0 = qOri[base];
    const o1 = qOri[base + 1];
    const o2 = qOri[base + 2];
    const o3 = qOri[base + 3];
    const depth = dist[qIdx[qh]];
    qh++;
    for (let move = 0; move < DEST.length; move++) {
      const dest = DEST[move];
      const flip = FLIP[move];
      const n0 = dest[l0];
      const n1 = dest[l1];
      const n2 = dest[l2];
      const n3 = dest[l3];
      const p0 = o0 ^ flip[l0];
      const p1 = o1 ^ flip[l1];
      const p2 = o2 ^ flip[l2];
      const p3 = o3 ^ flip[l3];
      const idx = encodeLoc(n0, n1, n2, n3, p0, p1, p2, p3);
      if (seen[idx]) continue;
      seen[idx] = 1;
      const nextDepth = depth + 1;
      dist[idx] = nextDepth;
      if (nextDepth > maxDepth) maxDepth = nextDepth;
      movesTowardSolved[idx] = INV[move];
      const tb = qt << 2;
      qLoc[tb] = n0;
      qLoc[tb + 1] = n1;
      qLoc[tb + 2] = n2;
      qLoc[tb + 3] = n3;
      qOri[tb] = p0;
      qOri[tb + 1] = p1;
      qOri[tb + 2] = p2;
      qOri[tb + 3] = p3;
      qIdx[qt++] = idx;
    }
  }
  if (qt !== n) throw new Error(`Cross solver reached ${qt} of ${n} states`);
  solveMove = movesTowardSolved;
  distance = dist;
  godsNumber = maxDepth;
  return godsNumber;
}

export function crossGodsNumber() {
  warmCrossSolver();
  return godsNumber;
}

export function crossDistance(index) {
  warmCrossSolver();
  return distance[index];
}

/** Where each white edge sits: loc[piece] is the slot, ori[piece] is 0 or 1. */
export function crossPlacement(index) {
  const loc = new Uint8Array(4);
  const ori = new Uint8Array(4);
  decode(index, loc, ori);
  return {
    loc: [loc[0], loc[1], loc[2], loc[3]],
    ori: [ori[0], ori[1], ori[2], ori[3]],
  };
}

export function crossIndexFromPlacement(loc, ori) {
  return encodeLoc(loc[0], loc[1], loc[2], loc[3], ori[0], ori[1], ori[2], ori[3]);
}

/**
 * Cubejs edge permutation and orientation.
 * Pieces DR DF DL DB are indices 4..7.
 */
export function crossIndexFromPermutation(ep, eo) {
  const loc = [-1, -1, -1, -1];
  const ori = [0, 0, 0, 0];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const piece = ep[slot];
    if (piece >= 4 && piece <= 7) {
      loc[piece - 4] = slot;
      ori[piece - 4] = eo[slot] & 1;
    }
  }
  return encodeLoc(loc[0], loc[1], loc[2], loc[3], ori[0], ori[1], ori[2], ori[3]);
}

export function applyCrossMove(index, move) {
  warmCrossSolver();
  const moveIndex = typeof move === "number" ? move : CROSS_MOVE_NAMES.indexOf(move);
  if (moveIndex < 0) throw new Error(`Unknown cross move: ${move}`);
  const loc = new Uint8Array(4);
  const ori = new Uint8Array(4);
  decode(index, loc, ori);
  const dest = DEST[moveIndex];
  const flip = FLIP[moveIndex];
  const n0 = dest[loc[0]];
  const n1 = dest[loc[1]];
  const n2 = dest[loc[2]];
  const n3 = dest[loc[3]];
  const p0 = ori[0] ^ flip[loc[0]];
  const p1 = ori[1] ^ flip[loc[1]];
  const p2 = ori[2] ^ flip[loc[2]];
  const p3 = ori[3] ^ flip[loc[3]];
  return encodeLoc(n0, n1, n2, n3, p0, p1, p2, p3);
}

/** Shortest face turns that solve this cross state. Empty when it is already solved. */
export function optimalCrossMoves(index) {
  warmCrossSolver();
  if (index === SOLVED_CROSS_INDEX) return [];
  const loc = new Uint8Array(4);
  const ori = new Uint8Array(4);
  decode(index, loc, ori);
  const names = [];
  let state = index;
  for (let guard = 0; state !== SOLVED_CROSS_INDEX; guard++) {
    if (guard > 12) throw new Error("Cross solution did not reach solved");
    const move = solveMove[state];
    names.push(CROSS_MOVE_NAMES[move]);
    const dest = DEST[move];
    const flip = FLIP[move];
    const n0 = dest[loc[0]];
    const n1 = dest[loc[1]];
    const n2 = dest[loc[2]];
    const n3 = dest[loc[3]];
    const p0 = ori[0] ^ flip[loc[0]];
    const p1 = ori[1] ^ flip[loc[1]];
    const p2 = ori[2] ^ flip[loc[2]];
    const p3 = ori[3] ^ flip[loc[3]];
    loc[0] = n0;
    loc[1] = n1;
    loc[2] = n2;
    loc[3] = n3;
    ori[0] = p0;
    ori[1] = p1;
    ori[2] = p2;
    ori[3] = p3;
    state = encodeLoc(n0, n1, n2, n3, p0, p1, p2, p3);
  }
  return names;
}

/**
 * Uniform random unsolved cross. `scramble` applied to a solved cube reaches
 * that state; `solution` is a shortest white-on-bottom solve.
 */
export function randomCrossCase(random = Math.random) {
  warmCrossSolver();
  const span = CROSS_STATE_COUNT - 1;
  let pick = Math.floor(Number(random()) * span);
  if (!Number.isFinite(pick) || pick < 0 || pick >= span) pick = 0;
  const index = pick >= SOLVED_CROSS_INDEX ? pick + 1 : pick;
  const moves = optimalCrossMoves(index);
  const solution = moves.join(" ");
  return {
    index,
    solution,
    scramble: invertAlgNotation(solution),
    length: moves.length,
    hold: CROSS_HOLD,
  };
}

/** How many of the four white edges are outside the bottom layer (slots 4–7). */
export function crossEdgesOffBottom(ep) {
  let count = 0;
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    const piece = ep[slot];
    if (piece >= 4 && piece <= 7 && (slot < 4 || slot > 7)) count++;
  }
  return count;
}

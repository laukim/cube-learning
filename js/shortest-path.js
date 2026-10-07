/**
 * Shortest path on the full 3×3, half-turn metric.
 *
 * Each reachable position is a node. Each face turn (U, U', U2, …) is an
 * edge. A minimum-move solve is a shortest path back to solved, so a
 * breadth-first search finds it. Scrambles stay at 5 moves or fewer: the
 * search only has to explore the ball inside that distance, which is small
 * enough to run in the browser.
 *
 * Move tables are the cubie cycles from cubejs (corners URF…DRB, edges
 * UR…BR). Opposite faces commute, so after a move the search skips the same
 * face and the opposite face when that face has a lower index. That still
 * reaches every position at the same distance.
 */

export const MAX_SCRAMBLE = 5;
export const PATH_LENGTHS = [3, 4, 5];

const HTM_FACES = ["U", "R", "F", "D", "L", "B"];
const POWER_SUFFIX = ["", "2", "'"];
const FACE_AXIS = [0, 1, 2, 0, 1, 2];

/** Index order matches cubejs: face * 3 + power, power 0 = quarter, 1 = half, 2 = inverse. */
export const HTM_MOVE_NAMES = HTM_FACES.flatMap((face) => POWER_SUFFIX.map((suffix) => face + suffix));

const MOVE_INDEX = new Map(HTM_MOVE_NAMES.map((name, index) => [name, index]));

const PREFERRED_FACES = ["R", "U", "F", "L", "D", "B"];
const PREFERRED_POWERS = [0, 2, 1];
const SEARCH_MOVES = [];
for (const faceName of PREFERRED_FACES) {
  const face = HTM_FACES.indexOf(faceName);
  for (const power of PREFERRED_POWERS) SEARCH_MOVES.push(face * 3 + power);
}

/** Quarter turns. cp/ep list the piece that arrives in each slot. */
const QUARTERS = [
  {
    cp: [3, 0, 1, 2, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    cp: [4, 1, 2, 0, 7, 5, 6, 3],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    cp: [1, 5, 2, 3, 0, 4, 6, 7],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  {
    cp: [0, 1, 2, 3, 5, 6, 7, 4],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    cp: [0, 2, 6, 3, 4, 1, 5, 7],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    cp: [0, 1, 3, 7, 4, 5, 2, 6],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
];

function compose(a, b) {
  const cp = new Uint8Array(8);
  const co = new Uint8Array(8);
  const ep = new Uint8Array(12);
  const eo = new Uint8Array(12);
  for (let to = 0; to < 8; to++) {
    const from = b.cp[to];
    cp[to] = a.cp[from];
    co[to] = (a.co[from] + b.co[to]) % 3;
  }
  for (let to = 0; to < 12; to++) {
    const from = b.ep[to];
    ep[to] = a.ep[from];
    eo[to] = (a.eo[from] + b.eo[to]) & 1;
  }
  return { cp, co, ep, eo };
}

function isIdentityMove(state) {
  for (let i = 0; i < 8; i++) if (state.cp[i] !== i || state.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (state.ep[i] !== i || state.eo[i] !== 0) return false;
  return true;
}

const MOVES = [];
for (const quarter of QUARTERS) {
  const half = compose(quarter, quarter);
  const inverse = compose(half, quarter);
  MOVES.push(quarter, half, inverse);
  if (!isIdentityMove(compose(inverse, quarter))) {
    throw new Error("Face turn did not have order 4");
  }
}

const CORNER_FACELET = [
  [8, 9, 20],
  [6, 18, 38],
  [0, 36, 47],
  [2, 45, 11],
  [29, 26, 15],
  [27, 44, 24],
  [33, 53, 42],
  [35, 17, 51],
];
const EDGE_FACELET = [
  [5, 10],
  [7, 19],
  [3, 37],
  [1, 46],
  [32, 16],
  [28, 25],
  [30, 43],
  [34, 52],
  [23, 12],
  [21, 41],
  [50, 39],
  [48, 14],
];
const CORNER_COLOR = ["URF", "UFL", "ULB", "UBR", "DFR", "DLF", "DBL", "DRB"];
const EDGE_COLOR = ["UR", "UF", "UL", "UB", "DR", "DF", "DL", "DB", "FR", "FL", "BL", "BR"];

const scratchCp = new Uint8Array(8);
const scratchCo = new Uint8Array(8);
const scratchEp = new Uint8Array(12);
const scratchEo = new Uint8Array(12);

function applyInPlace(cp, co, ep, eo, move) {
  const table = MOVES[move];
  for (let to = 0; to < 8; to++) {
    const from = table.cp[to];
    scratchCp[to] = cp[from];
    scratchCo[to] = (co[from] + table.co[to]) % 3;
  }
  for (let to = 0; to < 12; to++) {
    const from = table.ep[to];
    scratchEp[to] = ep[from];
    scratchEo[to] = (eo[from] + table.eo[to]) & 1;
  }
  cp.set(scratchCp);
  co.set(scratchCo);
  ep.set(scratchEp);
  eo.set(scratchEo);
}

function scratchSolved() {
  for (let i = 0; i < 8; i++) if (scratchCp[i] !== i || scratchCo[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (scratchEp[i] !== i || scratchEo[i] !== 0) return false;
  return true;
}

function keyFrom(cp, co, ep, eo) {
  return String.fromCharCode(
    48 + cp[0] * 3 + co[0],
    48 + cp[1] * 3 + co[1],
    48 + cp[2] * 3 + co[2],
    48 + cp[3] * 3 + co[3],
    48 + cp[4] * 3 + co[4],
    48 + cp[5] * 3 + co[5],
    48 + cp[6] * 3 + co[6],
    48 + cp[7] * 3 + co[7],
    48 + ep[0] * 2 + eo[0],
    48 + ep[1] * 2 + eo[1],
    48 + ep[2] * 2 + eo[2],
    48 + ep[3] * 2 + eo[3],
    48 + ep[4] * 2 + eo[4],
    48 + ep[5] * 2 + eo[5],
    48 + ep[6] * 2 + eo[6],
    48 + ep[7] * 2 + eo[7],
    48 + ep[8] * 2 + eo[8],
    48 + ep[9] * 2 + eo[9],
    48 + ep[10] * 2 + eo[10],
    48 + ep[11] * 2 + eo[11],
  );
}

function scratchKey() {
  return keyFrom(scratchCp, scratchCo, scratchEp, scratchEo);
}

function lettersFromArrays(cp, co, ep, eo) {
  const result = new Array(54);
  for (let face = 0; face < 6; face++) result[face * 9 + 4] = "URFDLB"[face];
  for (let i = 0; i < 8; i++) {
    const colors = CORNER_COLOR[cp[i]];
    const ori = co[i];
    for (let n = 0; n < 3; n++) result[CORNER_FACELET[i][(n + ori) % 3]] = colors[n];
  }
  for (let i = 0; i < 12; i++) {
    const colors = EDGE_COLOR[ep[i]];
    const ori = eo[i];
    for (let n = 0; n < 2; n++) result[EDGE_FACELET[i][(n + ori) % 2]] = colors[n];
  }
  return result.join("");
}

export function parseHtm(alg) {
  const parts = String(alg ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const indexes = [];
  for (const part of parts) {
    const index = MOVE_INDEX.get(part);
    if (index === undefined) throw new Error(`Unknown move: ${part}`);
    indexes.push(index);
  }
  return indexes;
}

/** Facelet letters after applying `alg` to a solved cube. Matches cubejs `asString()`. */
export function positionLetters(alg) {
  const cp = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const co = new Uint8Array(8);
  const ep = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const eo = new Uint8Array(12);
  for (const move of parseHtm(alg)) applyInPlace(cp, co, ep, eo, move);
  return lettersFromArrays(cp, co, ep, eo);
}

function pick(random, count) {
  let index = Math.floor(Number(random()) * count);
  if (!Number.isFinite(index) || index < 0) index = 0;
  if (index >= count) index = count - 1;
  return index;
}

const FACE_NAMES = ["U", "D", "R", "L", "F", "B"];
const POWER_NAMES = ["", "'", "2"];
const OPPOSITE_PAIRS = [
  ["U", "D"],
  ["R", "L"],
  ["F", "B"],
];

function inverseName(move) {
  if (move.endsWith("2")) return move;
  if (move.endsWith("'")) return move.slice(0, -1);
  return `${move}'`;
}

function nextFace(random, banned) {
  const faces = FACE_NAMES.filter((face) => !banned.includes(face));
  return faces[pick(random, faces.length)];
}

function looseScramble(length, random) {
  const parts = [];
  let lastFace = "";
  for (let i = 0; i < length; i++) {
    const face = nextFace(random, [lastFace]);
    parts.push(face + POWER_NAMES[pick(random, POWER_NAMES.length)]);
    lastFace = face;
  }
  return parts.join(" ");
}

/**
 * A contiguous A B A' on opposite faces collapses to B, because those faces
 * commute. The written scramble is `length` moves; a shortest path is shorter.
 * The triple sits in a random spot so it is not always the first three turns.
 */
function detourScramble(length, random) {
  const [faceA, faceB] = OPPOSITE_PAIRS[pick(random, OPPOSITE_PAIRS.length)];
  const first = faceA + POWER_NAMES[pick(random, POWER_NAMES.length)];
  const mid = faceB + POWER_NAMES[pick(random, POWER_NAMES.length)];
  const third = inverseName(first);
  const prefixLen = pick(random, length - 2);
  const suffixLen = length - 3 - prefixLen;
  const parts = [];
  let lastFace = "";
  for (let i = 0; i < prefixLen; i++) {
    const banned = [lastFace];
    if (i === prefixLen - 1) banned.push(faceA);
    const face = nextFace(random, banned);
    parts.push(face + POWER_NAMES[pick(random, POWER_NAMES.length)]);
    lastFace = face;
  }
  parts.push(first, mid, third);
  lastFace = faceA;
  for (let i = 0; i < suffixLen; i++) {
    const face = nextFace(random, [lastFace]);
    parts.push(face + POWER_NAMES[pick(random, POWER_NAMES.length)]);
    lastFace = face;
  }
  return parts.join(" ");
}

/**
 * Random face-turn scramble of `length` moves. The same face is never used
 * twice in a row. About one scramble in three hides an opposite-face
 * cancellation, so undoing the scramble is a solution but not always a
 * shortest path.
 */
export function randomHtmScramble(length, random = Math.random) {
  const moves = length | 0;
  if (moves < 1 || moves > MAX_SCRAMBLE) {
    throw new Error(`Scramble length must be 1–${MAX_SCRAMBLE}`);
  }
  if (moves >= 3 && random() < 1 / 3) return detourScramble(moves, random);
  return looseScramble(moves, random);
}

function moveName(index) {
  return HTM_FACES[(index / 3) | 0] + POWER_SUFFIX[index % 3];
}

function faceAllowed(prevFace, face, pruneOpposites) {
  if (prevFace < 0) return true;
  if (face === prevFace) return false;
  if (pruneOpposites && FACE_AXIS[face] === FACE_AXIS[prevFace] && face < prevFace) return false;
  return true;
}

/**
 * Breadth-first search from the scrambled position back to solved.
 * `step(budget)` expands up to `budget` nodes and returns the result once,
 * or null while the search still has nodes left. Safe to keep one search
 * running across timers so the page can keep accepting turns.
 */
export function createShortestPathSearch(scramble, options = {}) {
  const tokens = parseHtm(scramble);
  const pruneOpposites = options.pruneOpposites !== false;
  if (tokens.length > MAX_SCRAMBLE) {
    throw new Error(`Scrambles longer than ${MAX_SCRAMBLE} moves are not searched in the browser`);
  }

  const cp = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const co = new Uint8Array(8);
  const ep = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const eo = new Uint8Array(12);
  for (const move of tokens) applyInPlace(cp, co, ep, eo, move);

  let doneResult = null;
  let failed = "";
  const alreadySolved =
    cp.every((piece, index) => piece === index) &&
    co.every((ori) => ori === 0) &&
    ep.every((piece, index) => piece === index) &&
    eo.every((ori) => ori === 0);
  if (alreadySolved) doneResult = { moves: [], length: 0, within: 0 };

  const maxDepth = tokens.length;
  // Positions within 4 moves of anywhere: 46,741. Depth 5 stores that ball and
  // only checks the next layer for the solved node.
  const CAP = 48000;
  const poolCp = new Uint8Array(CAP * 8);
  const poolCo = new Uint8Array(CAP * 8);
  const poolEp = new Uint8Array(CAP * 12);
  const poolEo = new Uint8Array(CAP * 12);
  const parent = new Int32Array(CAP);
  const via = new Uint8Array(CAP);
  const nodeDepth = new Uint8Array(CAP);
  const seen = new Set();
  let qh = 0;
  let qt = 0;

  if (!doneResult) {
    scratchCp.set(cp);
    scratchCo.set(co);
    scratchEp.set(ep);
    scratchEo.set(eo);
    poolCp.set(scratchCp, 0);
    poolCo.set(scratchCo, 0);
    poolEp.set(scratchEp, 0);
    poolEo.set(scratchEo, 0);
    parent[0] = -1;
    via[0] = 255;
    nodeDepth[0] = 0;
    seen.add(scratchKey());
    qt = 1;
  }

  function finish(childMove, fromNode) {
    const indexes = [childMove];
    let node = fromNode;
    while (node > 0) {
      indexes.push(via[node]);
      node = parent[node];
    }
    indexes.reverse();
    // Nodes already queued at the solution depth are a later layer. Only the
    // completed shallower layers prove the minimum length.
    const solvedDepth = nodeDepth[fromNode] + 1;
    let within = 0;
    for (let i = 0; i < qt; i++) if (nodeDepth[i] < solvedDepth) within++;
    doneResult = {
      moves: indexes.map(moveName),
      length: indexes.length,
      within,
    };
  }

  function applyFromPool(src, move) {
    const table = MOVES[move];
    const corner = src * 8;
    const edge = src * 12;
    for (let to = 0; to < 8; to++) {
      const from = table.cp[to];
      scratchCp[to] = poolCp[corner + from];
      scratchCo[to] = (poolCo[corner + from] + table.co[to]) % 3;
    }
    for (let to = 0; to < 12; to++) {
      const from = table.ep[to];
      scratchEp[to] = poolEp[edge + from];
      scratchEo[to] = (poolEo[edge + from] + table.eo[to]) & 1;
    }
  }

  function expandNode(src) {
    const prevFace = src === 0 ? -1 : (via[src] / 3) | 0;
    const depth = nodeDepth[src];
    for (let i = 0; i < SEARCH_MOVES.length; i++) {
      const move = SEARCH_MOVES[i];
      const face = (move / 3) | 0;
      if (!faceAllowed(prevFace, face, pruneOpposites)) continue;
      applyFromPool(src, move);
      if (scratchSolved()) {
        finish(move, src);
        return;
      }
      const childDepth = depth + 1;
      if (childDepth >= maxDepth) continue;
      const key = scratchKey();
      if (seen.has(key)) continue;
      if (qt >= CAP) {
        failed = "Search ran out of room";
        return;
      }
      const dst = qt++;
      seen.add(key);
      poolCp.set(scratchCp, dst * 8);
      poolCo.set(scratchCo, dst * 8);
      poolEp.set(scratchEp, dst * 12);
      poolEo.set(scratchEo, dst * 12);
      parent[dst] = src;
      via[dst] = move;
      nodeDepth[dst] = childDepth;
    }
  }

  function step(budget = 2000) {
    if (doneResult) return doneResult;
    if (failed) return null;
    const limit = budget < 1 ? 1 : budget | 0;
    let n = 0;
    while (qh < qt && n < limit) {
      expandNode(qh);
      qh++;
      n++;
      if (doneResult || failed) break;
    }
    if (!doneResult && !failed && qh >= qt) {
      failed = "No solution within the scramble length";
    }
    return doneResult;
  }

  return {
    step,
    get done() {
      return doneResult !== null;
    },
    get error() {
      return failed;
    },
  };
}

/** Run the search to completion. */
export function shortestPath(scramble, options) {
  const search = createShortestPathSearch(scramble, options);
  let result = null;
  while (!result && !search.error) result = search.step(100000);
  if (!result) throw new Error(search.error || "Shortest path search failed");
  return result;
}

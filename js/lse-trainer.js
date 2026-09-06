/**
 * Roux LSE (last six edges) — EO → UL/UR → M-slice.
 * Guide always returns one definite M/U alg (BFS), never a vague option list.
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  faceletsToString,
  getFace,
  isSolved,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { blocksDone } from "./roux-blocks.js";
// CMLL permutation is checked by the Roux guide before LSE; during LSE, U moves
// displace corners temporarily, so we only require oriented U corners here.

const HOLD_NOTE =
  "White on D · blue F. Do the alg exactly — tap LSE hint again after it finishes.";

/** All LSE moves. */
const MU = ["U", "U'", "U2", "M", "M'", "M2"];
/** After UL/UR are placed: keep them (no U / U'). */
const MU_FINISH = ["M", "M'", "M2", "U2"];

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

/** EO: U/D edge stickers are only white or yellow. */
export function lseEoDone(facelets) {
  const udEdges = [
    ["U", 1],
    ["U", 3],
    ["U", 5],
    ["U", 7],
    ["D", 1],
    ["D", 7],
  ];
  return udEdges.every(([face, i]) => {
    const c = sticker(facelets, face, i);
    return c === "white" || c === "yellow";
  });
}

export function ulUrDone(facelets) {
  return (
    sticker(facelets, "U", 3) === "yellow" &&
    sticker(facelets, "L", 1) === "orange" &&
    sticker(facelets, "U", 5) === "yellow" &&
    sticker(facelets, "R", 1) === "red"
  );
}

function mCentersDone(facelets) {
  return (
    getFace(facelets, "F")[4] === "blue" &&
    getFace(facelets, "B")[4] === "green" &&
    getFace(facelets, "U")[4] === "yellow" &&
    getFace(facelets, "D")[4] === "white"
  );
}

function mEdgesDone(facelets) {
  return (
    sticker(facelets, "U", 7) === "yellow" &&
    sticker(facelets, "F", 1) === "blue" &&
    sticker(facelets, "U", 1) === "yellow" &&
    sticker(facelets, "B", 1) === "green" &&
    sticker(facelets, "D", 1) === "white" &&
    sticker(facelets, "F", 7) === "blue" &&
    sticker(facelets, "D", 7) === "white" &&
    sticker(facelets, "B", 7) === "green"
  );
}

export function lseComplete(facelets) {
  return isSolved(facelets);
}

function badEoSlots(facelets) {
  const slots = [
    ["U", 1, "UB"],
    ["U", 3, "UL"],
    ["U", 5, "UR"],
    ["U", 7, "UF"],
    ["D", 1, "DF"],
    ["D", 7, "DB"],
  ];
  return slots.filter(([face, i]) => {
    const c = sticker(facelets, face, i);
    return c !== "white" && c !== "yellow";
  });
}

/**
 * Shortest M/U alg to reach goalFn. Returns "" if already there, null if none.
 * Skips consecutive moves on the same axis (U* then U*, or M* then M*).
 */
export function bfsMuAlg(start, goalFn, { moves = MU, maxDepth = 12 } = {}) {
  if (goalFn(start)) return "";
  const queue = [{ f: cloneFacelets(start), path: [] }];
  const seen = new Set([faceletsToString(start)]);
  let head = 0;
  while (head < queue.length) {
    const { f, path } = queue[head++];
    if (path.length >= maxDepth) continue;
    const lastAxis = path.length ? path[path.length - 1][0] : "";
    for (const mv of moves) {
      if (mv[0] === lastAxis) continue;
      const next = cloneFacelets(f);
      applyMove(next, mv);
      const key = faceletsToString(next);
      if (seen.has(key)) continue;
      seen.add(key);
      const npath = path.concat(mv);
      if (goalFn(next)) return npath.join(" ");
      queue.push({ f: next, path: npath });
    }
  }
  return null;
}

function locateEdge(facelets, colors) {
  const want = new Set(colors);
  const locs = [
    { id: "UF", read: () => [sticker(facelets, "U", 7), sticker(facelets, "F", 1)] },
    { id: "UR", read: () => [sticker(facelets, "U", 5), sticker(facelets, "R", 1)] },
    { id: "UB", read: () => [sticker(facelets, "U", 1), sticker(facelets, "B", 1)] },
    { id: "UL", read: () => [sticker(facelets, "U", 3), sticker(facelets, "L", 1)] },
    { id: "DF", read: () => [sticker(facelets, "D", 1), sticker(facelets, "F", 7)] },
    { id: "DB", read: () => [sticker(facelets, "D", 7), sticker(facelets, "B", 7)] },
  ];
  for (const loc of locs) {
    const [a, b] = loc.read();
    if (want.has(a) && want.has(b)) return loc.id;
  }
  return "?";
}

function eoHint(facelets) {
  const bad = badEoSlots(facelets);
  const n = bad.length;
  const labels = bad.map(([, , id]) => id).join(", ");
  const alg = bfsMuAlg(facelets, lseEoDone, { moves: MU, maxDepth: 10 });
  if (alg == null) {
    return hint(
      `EO · ${n} bad`,
      `Bad edges at ${labels || "—"}. Couldn’t find a short M/U fix — reset LSE or undo.`,
      "",
      HOLD_NOTE
    );
  }
  if (alg === "") {
    return hint("EO · done", "No blue/green on U or D. Next: place UL & UR.", "", HOLD_NOTE);
  }
  return hint(
    `EO · ${n} bad`,
    `Bad edge stickers on U/D at: ${labels}. Do this exact sequence, then tap LSE hint again.`,
    alg,
    HOLD_NOTE
  );
}

function ulUrHint(facelets) {
  const orangeAt = locateEdge(facelets, ["orange", "yellow"]);
  const redAt = locateEdge(facelets, ["red", "yellow"]);
  const alg = bfsMuAlg(facelets, ulUrDone, { moves: MU, maxDepth: 12 });
  if (alg == null) {
    return hint(
      "UL/UR",
      `Orange–yellow at ${orangeAt}, red–yellow at ${redAt}. No short M/U solution found — undo or New LSE.`,
      "",
      HOLD_NOTE
    );
  }
  if (alg === "") {
    return hint("UL/UR · done", "Orange at UL, red at UR. Next: centres + M-slice.", "", HOLD_NOTE);
  }
  return hint(
    "UL/UR",
    `Orange–yellow is at ${orangeAt}; red–yellow is at ${redAt}. Park orange at UL and red at UR (yellow on U) with this alg:`,
    alg,
    HOLD_NOTE
  );
}

function sliceCaseName(facelets) {
  if (!mCentersDone(facelets)) return "centres";
  if (mEdgesDone(facelets)) return "done";
  // Cheap labels for the four M-slice edges
  const uf =
    sticker(facelets, "U", 7) === "yellow" && sticker(facelets, "F", 1) === "blue";
  const ub =
    sticker(facelets, "U", 1) === "yellow" && sticker(facelets, "B", 1) === "green";
  const df =
    sticker(facelets, "D", 1) === "white" && sticker(facelets, "F", 7) === "blue";
  const db =
    sticker(facelets, "D", 7) === "white" && sticker(facelets, "B", 7) === "green";
  const ok = [uf, ub, df, db].filter(Boolean).length;
  if (ok === 0) return "4-cycle / swap";
  if (ok === 2) return "2 edges left";
  return "M-slice";
}

function sliceHint(facelets) {
  const label = sliceCaseName(facelets);
  const alg = bfsMuAlg(facelets, isSolved, { moves: MU_FINISH, maxDepth: 14 });
  if (alg == null) {
    // Allow U as a last resort (rare)
    const alg2 = bfsMuAlg(facelets, isSolved, { moves: MU, maxDepth: 14 });
    if (alg2 == null) {
      return hint(
        `M-slice · ${label}`,
        "No short finish found with M/U2. Undo a move or tap Again on the LSE drill.",
        "",
        HOLD_NOTE
      );
    }
    return hint(
      `M-slice · ${label}`,
      "Finish the four M-slice edges (and centres) with this exact alg:",
      alg2,
      HOLD_NOTE
    );
  }
  if (alg === "") {
    return hint("LSE · solved", "Last six edges done.", "", "");
  }
  const copy = !mCentersDone(facelets)
    ? "Centres first, then the four M-slice edges. Do this exact alg:"
    : `Case: ${label}. Do this exact alg to finish:`;
  return hint(`M-slice · ${label}`, copy, alg, HOLD_NOTE);
}

/** Yellow on all four U corners — CMLL orientation (M/U keep this). */
function uCornersOriented(facelets) {
  return [0, 2, 6, 8].every((i) => sticker(facelets, "U", i) === "yellow");
}

/**
 * LSE-ready: blocks done + U corners oriented.
 * Do NOT require full CMLL permutation — U turns during UL/UR move corners
 * and would falsely bounce back to “finish CMLL”.
 */
function lseReady(facelets) {
  return blocksDone(facelets) && uCornersOriented(facelets);
}

export function analyzeLse(facelets) {
  if (!lseReady(facelets)) {
    return {
      eo: false,
      ulur: false,
      complete: false,
      stage: "need-cmll",
      hint: hint(
        "Finish CMLL first",
        "LSE needs both blocks and yellow on all four U corners.",
        "",
        "FB → SB → CMLL → LSE."
      ),
    };
  }

  if (isSolved(facelets)) {
    return {
      eo: true,
      ulur: true,
      complete: true,
      stage: "done",
      hint: hint("Solved", "Last six edges done — full Roux solve.", "", ""),
    };
  }

  if (!lseEoDone(facelets)) {
    return {
      eo: false,
      ulur: false,
      complete: false,
      stage: "eo",
      hint: eoHint(facelets),
    };
  }

  if (!ulUrDone(facelets)) {
    return {
      eo: true,
      ulur: false,
      complete: false,
      stage: "ulur",
      hint: ulUrHint(facelets),
    };
  }

  return {
    eo: true,
    ulur: true,
    complete: false,
    stage: "slice",
    hint: sliceHint(facelets),
  };
}

export const LSE_TIPS = [
  {
    title: "Three steps, one alg each",
    body: "EO → UL/UR → M-slice. The coach always gives one definite M/U sequence for the current case — don’t pick from a menu.",
  },
  {
    title: "EO",
    body: "No blue or green on U or D edge spots. Bad count is always even (0, 2, 4, 6). Apply the shown alg once, then hint again.",
  },
  {
    title: "UL / UR",
    body: "Orange–yellow at UL, red–yellow at UR, yellow on top. M moves don’t touch those slots; U does.",
  },
  {
    title: "M-slice",
    body: "With UL/UR parked, only M and U2 are needed. Centres (blue front, yellow top), then the four M edges.",
  },
];

/**
 * Beginner LSE case list — EO / UL-UR / centres / 4c families.
 * Every setup is M/U-only from solved and verified to walk to solved
 * via analyzeLse() definite algs.
 */
export const LSE_DRILL_CASES = [
  // —— EO (2 bad) ——
  { id: "eo-2-a", name: "EO · 2 bad · A", setup: () => "M U M U M" },
  { id: "eo-2-b", name: "EO · 2 bad · B", setup: () => "M U M U M'" },
  { id: "eo-2-c", name: "EO · 2 bad · C", setup: () => "M U M' U M" },
  { id: "eo-2-d", name: "EO · 2 bad · D", setup: () => "M U M U' M" },
  // —— EO (4 bad) ——
  { id: "eo-4-m", name: "EO · 4 · M", setup: () => "M" },
  { id: "eo-4-mp", name: "EO · 4 · M'", setup: () => "M'" },
  { id: "eo-4-um", name: "EO · 4 · U M", setup: () => "U M" },
  { id: "eo-4-ump", name: "EO · 4 · U M'", setup: () => "U M'" },
  { id: "eo-4-arrow", name: "EO · 4 · arrow", setup: () => "M' U' M U' M' U2 M" },
  // —— UL / UR ——
  { id: "ulur-u", name: "UL/UR · U", setup: () => "U" },
  { id: "ulur-up", name: "UL/UR · U'", setup: () => "U'" },
  { id: "ulur-u2", name: "UL/UR · U2", setup: () => "U2" },
  { id: "ulur-um2", name: "UL/UR · U M2", setup: () => "U M2" },
  { id: "ulur-upm2", name: "UL/UR · U' M2", setup: () => "U' M2" },
  { id: "ulur-swap", name: "UL/UR · swapped", setup: () => "M2 U2 M2" },
  // —— Centres + M-slice ——
  { id: "cen-m2", name: "Centres · M2", setup: () => "M2" },
  { id: "cen-u2m", name: "Centres · U2 M", setup: () => "U2 M U2 M" },
  { id: "slice-opp", name: "4c · opposite", setup: () => "M2 U2 M2 U2" },
  { id: "slice-u2m2", name: "4c · U2 M2 U2", setup: () => "U2 M2 U2" },
  // —— Mixed ——
  { id: "mix-eo-ulur", name: "Mixed · EO+UL/UR", setup: () => "M U M U M U" },
  { id: "mix-full", name: "Mixed · full LSE", setup: () => "M U M2 U M U2" },
];

let lseDrillIndex = 0;
let lseDrillStarted = false;

export function resetLseDrill() {
  lseDrillIndex = 0;
  lseDrillStarted = false;
}

export function getLseDrillInfo() {
  const n = LSE_DRILL_CASES.length;
  const i = ((lseDrillIndex % n) + n) % n;
  const c = LSE_DRILL_CASES[i];
  return { index: i, total: n, id: c.id, name: c.name, started: lseDrillStarted };
}

/** Scramble a specific case by index (for tests / Next order). */
export function scrambleLseAt(facelets, index) {
  const n = LSE_DRILL_CASES.length;
  const i = ((index % n) + n) % n;
  lseDrillIndex = i;
  lseDrillStarted = true;
  const setup = LSE_DRILL_CASES[i].setup();
  const src = solvedFacelets();
  for (let j = 0; j < 54; j++) facelets[j] = src[j];
  applyAlg(facelets, setup);
  return setup;
}

export function scrambleLse(facelets, mode = "next") {
  const n = LSE_DRILL_CASES.length;
  if (mode === "again" && lseDrillStarted) {
    /* keep */
  } else if (mode === "next" || !lseDrillStarted) {
    if (lseDrillStarted) lseDrillIndex = (lseDrillIndex + 1) % n;
    lseDrillStarted = true;
  }
  return scrambleLseAt(facelets, lseDrillIndex);
}

/** Progress chips for the LSE panel. */
export function lseProgress(facelets) {
  const eo = lseEoDone(facelets);
  const ulur = eo && ulUrDone(facelets);
  const done = isSolved(facelets);
  return [
    { id: "eo", label: "EO", done: eo },
    { id: "ulur", label: "UL/UR", done: ulur },
    { id: "slice", label: "M-slice", done },
  ];
}

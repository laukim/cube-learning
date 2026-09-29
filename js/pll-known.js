/**
 * One-look PLL cards for the cases already known.
 * Move strings are Cube Academy’s primary algs:
 * https://www.cube.academy/pll-algs
 * T, Y, Ub, H, and Z match the 2-look strings in pll-trainer.js.
 * Ua on the full PLL page is a different alg from 2-look Ua.
 * Diagrams are drawn in-app (no remote images).
 */

import { invertAlg } from "./alg.js";
import { PLL_H, PLL_T, PLL_UB, PLL_Y, PLL_Z } from "./pll-trainer.js";

const HOLD =
  "White on bottom · blue = F. Turn only U until the side colours match the picture — don’t orbit the cube to chase F or R.";

export const PLL_KNOWN_CASES = [
  {
    id: "f",
    short: "F",
    name: "F-perm",
    cue: "One full bar, nothing else",
    alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
    algDisplay: "R' U' F' (R U R' U') R' F (R2 U' R') U' (R U R') U R",
    steps:
      "One full bar, nothing else — three side stickers the same, and no headlights or pairs on the other sides.\nTurn only U until that bar is on the left.\nDo the F-perm.",
    sides: {
      B: ["green", "blue", "red"],
      L: ["orange", "orange", "orange"],
      R: ["blue", "red", "green"],
      F: ["blue", "green", "red"],
    },
    edges: { swaps: [["UF", "UB"]] },
    corners: { swaps: [["URF", "UBR"]] },
  },
  {
    id: "y",
    short: "Y",
    name: "Y-perm",
    cue: "Two bars, same side, apart",
    alg: PLL_Y.alg,
    algDisplay: "F (R U' R' U') R U R' F' (R U R' U') R' F R F'",
    steps:
      "Two bars on the same side, but apart. No headlights.\nHere the front-left is a blue pair and the back-left sticker is also blue, with the left face between them.\nTurn only U until it matches the picture, then the Y-perm. Same alg as 2-look.",
    sides: {
      B: ["blue", "orange", "green"],
      L: ["orange", "green", "red"],
      R: ["red", "red", "orange"],
      F: ["blue", "blue", "green"],
    },
    edges: { swaps: [["UL", "UB"]] },
    corners: { swaps: [["URF", "ULB"]] },
  },
  {
    id: "jb",
    short: "Jb",
    name: "Jb-perm",
    cue: "Full bar on the left",
    alg: "R U R' F' R U R' U' R' F R2 U' R' U'",
    algDisplay: "(R U R' F') (R U R' U') R' F (R2 U' R') U'",
    steps:
      "Full bar on the left — three side stickers the same — plus a matching pair on each other side. The front pair sits on the right, away from the bar. That pattern is Jb. T’s headlights are not a full bar: the edge between them does not match.\nTurn only U until the bar is on the left.\nDo the Jb-perm. It is the T-perm with F' pulled forward. No x moves.",
    sides: {
      B: ["green", "green", "red"],
      L: ["orange", "orange", "orange"],
      R: ["blue", "blue", "green"],
      F: ["blue", "red", "red"],
    },
    edges: { swaps: [["UF", "UR"]] },
    corners: { swaps: [["URF", "UBR"]] },
  },
  {
    id: "na",
    short: "Na",
    name: "Na-perm",
    cue: "Diagonal mess",
    alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
    algDisplay: "(R U R' U) R U R' F' (R U R' U') R' F (R2 U' R') U2 R U' R'",
    steps:
      "Diagonal mess — no bar and no headlights. Every side is a broken pair, and the corners that swap sit on a diagonal.\nTurn only U until the pairs point the same way as the picture.\nDo the Na-perm.",
    sides: {
      B: ["green", "green", "blue"],
      L: ["red", "red", "orange"],
      R: ["orange", "orange", "red"],
      F: ["green", "blue", "blue"],
    },
    edges: { swaps: [["UR", "UL"]] },
    corners: { swaps: [["UFL", "UBR"]] },
  },
  {
    id: "t",
    short: "T",
    name: "T-perm",
    cue: "Headlights on the left",
    alg: PLL_T.alg,
    algDisplay: "(R U R' U') R' F (R2 U' R') U' (R U R' F')",
    steps:
      "Headlights on the left: the two corner stickers match and the edge between them does not. Not a full bar.\nTurn only U until those headlights are on the left.\nDo the T-perm. Same alg as 2-look PLL.",
    sides: {
      B: ["green", "green", "red"],
      L: ["orange", "red", "orange"],
      R: ["blue", "orange", "green"],
      F: ["blue", "blue", "red"],
    },
    edges: { swaps: [["UR", "UL"]] },
    corners: { swaps: [["URF", "UBR"]] },
  },
  {
    id: "ua",
    short: "Ua",
    name: "Ua-perm",
    cue: "Full bar on the front",
    alg: "R U R' U R' U' R2 U' R' U R' U R",
    algDisplay: "(R U R' U) R' U' (R2 U' R') U R' U R",
    steps:
      "One full bar on the front — three matching stickers. The other three sides are headlights.\nTurn only U until that bar is at the front, like the picture.\nDo Cube Academy’s full PLL Ua. The 2-look Ua is a different alg (bar at the back).",
    sides: {
      B: ["blue", "red", "blue"],
      L: ["red", "orange", "red"],
      R: ["orange", "blue", "orange"],
      F: ["green", "green", "green"],
    },
    edges: { cycle: ["UF", "UR", "UB"] },
    corners: {},
  },
  {
    id: "ub",
    short: "Ub",
    name: "Ub-perm",
    cue: "Full bar on the front",
    alg: PLL_UB.alg,
    algDisplay: "R' U (R' U') (R' U') R' U (R U R2)",
    steps:
      "One full bar on the front, and that front edge already matches the front centre. The other three edges cycle.\nTurn only U until the bar is at the front.\nDo Ub. Same moves as 2-look Ub — Cube Academy’s R3 is just R'.",
    sides: {
      B: ["green", "red", "green"],
      L: ["orange", "green", "orange"],
      R: ["red", "orange", "red"],
      F: ["blue", "blue", "blue"],
    },
    edges: { cycle: ["UL", "UR", "UB"] },
    corners: {},
  },
  {
    id: "h",
    short: "H",
    name: "H-perm",
    cue: "No bars — opposite edges",
    alg: PLL_H.alg,
    algDisplay: "M2 U' (M2 U2 M2) U' M2",
    steps:
      "No bars. Opposite edges are swapped, so every side is headlights.\nMatch the picture (any U that looks like this), then the H-perm.\nM follows L. Same alg as 2-look.",
    sides: {
      B: ["green", "blue", "green"],
      L: ["orange", "red", "orange"],
      R: ["red", "orange", "red"],
      F: ["blue", "green", "blue"],
    },
    edges: { swaps: [["UR", "UL"], ["UF", "UB"]] },
    corners: {},
  },
  {
    id: "z",
    short: "Z",
    name: "Z-perm",
    cue: "Headlights, not the H pattern",
    alg: PLL_Z.alg,
    algDisplay: "M' U' (M2 U') (M2 U') M' U2 M2",
    steps:
      "No full bar. Headlights on every side, but the colours are not the H pattern — the front and back edges swap and the corners cycle.\nTurn only U until it matches the picture, then the Z-perm.\nSame M alg as 2-look.",
    sides: {
      B: ["orange", "blue", "orange"],
      L: ["blue", "orange", "blue"],
      R: ["green", "red", "green"],
      F: ["red", "green", "red"],
    },
    edges: { swaps: [["UF", "UB"]] },
    corners: { cycle: ["URF", "UFL", "ULB", "UBR"] },
  },
];

const HOLD_NOTE = HOLD;

let pllLook = "two";
let selectedId = "f";

export function getPllLook() {
  return pllLook;
}

export function setPllLook(next) {
  if (next === "two" || next === "known") pllLook = next;
}

export function getKnownPllId() {
  return selectedId;
}

export function selectKnownPll(id) {
  if (PLL_KNOWN_CASES.some((c) => c.id === id)) selectedId = id;
}

export function getKnownPllCase() {
  return PLL_KNOWN_CASES.find((c) => c.id === selectedId) || PLL_KNOWN_CASES[0];
}

export function knownPllSetupAlg(pllCase = getKnownPllCase()) {
  return invertAlg(pllCase.alg);
}

export function knownPllDiagram(pllCase) {
  return {
    type: "pll-recog",
    caption: `${pllCase.short} · ${pllCase.cue} · back ↑`,
    sides: pllCase.sides,
    edges: pllCase.edges,
    corners: pllCase.corners,
  };
}

export function knownPllNote() {
  return HOLD_NOTE;
}

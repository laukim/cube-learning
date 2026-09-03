/**
 * Standard F2L cases in CubeHead’s academy/video order, practised as R then L.
 * IDs: 1R, 1L, … 41L. R = green–red at front-right. L = the same case,
 * orange–green at front-left. 41 cases × 2 slots, no crossed duplicates.
 * Video: https://www.youtube.com/watch?v=3tYj-9f4dA0
 * Checklist: https://www.cube.academy/intuitive-f2l-algs
 */

import { invertAlg, mirrorLRAlg } from "./alg.js";

/** [n, group, short name, FR alg] */
const FR = [
  [1, "Easy insert", "Pair on the right", "U R U' R'"],
  [2, "Easy insert", "Sledge", "F R' F' R"],
  [3, "Easy insert", "Pair on the left (from FR)", "F' U' F"],
  [4, "Easy insert", "Split insert", "R U R'"],
  [5, "Disconnected", "Same colours up", "U' R U R' U2 R U' R'"],
  [6, "Disconnected", "Same colours up (mirror shape)", "U F' U' F U2 F' U F"],
  [7, "Disconnected", "Same colours, other edge", "U' R U2 R' U' R U2 R'"],
  [8, "Disconnected", "Same colours, other edge (mirror)", "r' U2 R2 U R2 U r"],
  [9, "Disconnected", "Different colours up", "U' R U' R' U F' U' F"],
  [10, "Disconnected", "Different colours up (far)", "U' R U R' U R U R'"],
  [11, "Disconnected", "White up, edge left", "U R U2 R' U R U' R'"],
  [12, "Disconnected", "White up, edge right", "U' R U' R2 F R F' R U' R'"],
  [13, "Disconnected", "White up, edge back", "U2 R U R' U R U' R'"],
  [14, "Disconnected", "White up, edge back (mirror)", "r U' r' U2 r U r'"],
  [15, "Corner in slot", "Solved corner, edge oriented", "U' R' F R F' R U R'"],
  [16, "Corner in slot", "Solved corner, edge flipped", "U R U' R' F R' F' R"],
  [17, "Corner in slot", "White left, edge on U", "R U' R' U R U' R'"],
  [18, "Corner in slot", "White right, edge on U", "R U R' U' F R' F' R"],
  [19, "Corner in slot", "White front, edge on U", "R' F R F' U R U' R'"],
  [20, "Corner in slot", "White right, sexy insert", "R U R' U' R U R'"],
  [21, "Edge in slot", "Solved edge, white up", "U R U' R' U R U' R' U R U' R'"],
  [22, "Edge in slot", "Flipped edge, white up", "U' R' F R F' R U' R'"],
  [23, "Edge in slot", "Solved edge, white left", "U' R U' R' U2 R U' R'"],
  [24, "Edge in slot", "Solved edge, white right", "U R U R' U2 R U R'"],
  [25, "Edge in slot", "Flipped edge, white left", "U2 R U R' F R' F' R"],
  [26, "Edge in slot", "Flipped edge, white right", "U2 F' U' F U R U' R'"],
  [27, "Connected", "White up, edge flipped", "R U' R' U R U' R' U2 R U' R'"],
  [28, "Connected", "White right, edge front", "U' R U' R' U R U R'"],
  [29, "Connected", "White up, matching", "R U R' U2 R U' R' U R U' R'"],
  [30, "Connected", "White right, edge back", "R U2 R' U' R U R'"],
  [31, "Connected", "White up, edge right", "U R U' R' U' R U' R' U R U' R'"],
  [32, "Connected", "Flipped edge pair", "U' R U2 R' U F' U' F"],
  [33, "Connected", "White front, edge left", "R U' R' U R' F R F' R U' R'"],
  [34, "Connected", "White up, matching (other)", "R U' R' U2 F' U' F"],
  [35, "Connected", "White front, edge back", "F' U2 F U F' U' F"],
  [36, "Connected", "White up, edge left", "F U R U' R' F' R U' R'"],
  [37, "Both in slot", "Good edge, white front", "R U' R' U' R U R' U2 R U' R'"],
  [38, "Both in slot", "Good edge, white right", "R U' R' U R U2 R' U R U' R'"],
  [39, "Both in slot", "Flipped edge, white front", "r U' r' U2 r U r' R U R'"],
  [40, "Both in slot", "Flipped edge, white right", "R U' R' r U' r' U2 r U r'"],
  [41, "Both in slot", "Solved corner, flipped edge", "R2 U2 F R2 F' U2 R' U R'"],
];

/**
 * Naive LR-mirror of wide r breaks the white cross. These keep the same
 * case as nR, in the FL slot (orange–green), without dumping other pairs.
 */
const L_OVERRIDE = {
  8: "l U2 L2 U' L2 U' l'",
  14: "l' U l U2 l' U' l",
  39: "l' U l U2 l' U' l L' U' L",
  40: "L' U L l' U l U2 l' U' l",
};

function makeDrill(n, group, name, hand, alg) {
  const id = `${n}${hand}`;
  const slot = hand === "R" ? "FR" : "FL";
  const useAlg = hand === "L" && L_OVERRIDE[n] ? L_OVERRIDE[n] : alg;
  return {
    id,
    n,
    hand,
    slot,
    group,
    name: `${id} · ${name}`,
    alg: useAlg,
    setup: invertAlg(useAlg),
    copy:
      hand === "R"
        ? "Slot is front-right (green–red). Use R and U (F if the alg has it). Don’t turn L or B — other pairs stay in."
        : "Same case, front-left (orange–green). Use L and U. Don’t turn R or B.",
    note: "White on bottom · green = F. One pair only. Stay on this ID until you tap Next or Prev.",
  };
}

export const F2L_DRILL_CASES = FR.flatMap(([n, group, name, alg]) => [
  makeDrill(n, group, name, "R", alg),
  makeDrill(n, group, name, "L", mirrorLRAlg(alg)),
]);

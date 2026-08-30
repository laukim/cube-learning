/**
 * Standard F2L cases (SpeedCubeDB / CubeHead 41), practised as R then L.
 * IDs: 1R, 1L, 2R, 2L, … 41L. R = front-right slot (R/U). L = front-left (L/U).
 * https://www.youtube.com/watch?v=3tYj-9f4dA0
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
  [7, "Disconnected", "White up, edge at back", "U' R U2 R' U' R U2 R'"],
  [8, "Disconnected", "White up, edge at left", "r' U2 R2 U R2 U r"],
  [9, "Disconnected", "Different colours up", "U' R U' R' U F' U' F"],
  [10, "Disconnected", "Different colours up (far)", "U' R U R' U R U R'"],
  [11, "Connected", "Flipped edge pair", "U' R U2 R' U F' U' F"],
  [12, "Connected", "White up, edge flipped", "R U' R' U R U' R' U2 R U' R'"],
  [13, "Connected", "White front, edge left", "R U' R' U R' F R F' R U' R'"],
  [14, "Connected", "White right, edge front", "U' R U' R' U R U R'"],
  [15, "Connected", "White up, matching", "R U R' U2 R U' R' U R U' R'"],
  [16, "Connected", "White up, matching (other)", "R U' R' U2 F' U' F"],
  [17, "Connected", "White right, edge back", "R U2 R' U' R U R'"],
  [18, "Connected", "White front, edge back", "F' U2 F U F' U' F"],
  [19, "Disconnected", "White right, edge left", "U R U2 R' U R U' R'"],
  [20, "Disconnected", "White front, edge right", "U' R U' R2 F R F' R U' R'"],
  [21, "Disconnected", "White right, edge back", "U2 R U R' U R U' R'"],
  [22, "Disconnected", "White front, edge back", "r U' r' U2 r U r'"],
  [23, "Connected", "White up, edge right", "U R U' R' U' R U' R' U R U' R'"],
  [24, "Connected", "White up, edge left", "F U R U' R' F' R U' R'"],
  [25, "Corner in slot", "Solved corner, edge oriented", "U' R' F R F' R U R'"],
  [26, "Corner in slot", "Solved corner, edge flipped", "U R U' R' F R' F' R"],
  [27, "Corner in slot", "White left, edge on U", "R U' R' U R U' R'"],
  [28, "Corner in slot", "White right, edge on U", "R U R' U' F R' F' R"],
  [29, "Corner in slot", "White front, edge on U", "R' F R F' U R U' R'"],
  [30, "Corner in slot", "White right, sexy insert", "R U R' U' R U R'"],
  [31, "Edge in slot", "Solved edge, white up", "U' R' F R F' R U' R'"],
  [32, "Edge in slot", "Flipped edge, white up", "U R U' R' U R U' R' U R U' R'"],
  [33, "Edge in slot", "Solved edge, white left", "U' R U' R' U2 R U' R'"],
  [34, "Edge in slot", "Solved edge, white right", "U R U R' U2 R U R'"],
  [35, "Edge in slot", "Flipped edge, white left", "U' R U R' U F' U' F"],
  [36, "Edge in slot", "Flipped edge, white right", "U F' U' F U' R U R'"],
  [37, "Both in slot", "Good edge, white left", "R2 U2 F R2 F' U2 R' U R'"],
  [38, "Both in slot", "Good edge, white right", "R U' R' U' R U R' U2 R U' R'"],
  [39, "Both in slot", "Flipped edge, white left", "R U' R' U R U2 R' U R U' R'"],
  [40, "Both in slot", "Flipped edge, white right", "r U' r' U2 r U r' R U R'"],
  [41, "Both in slot", "Solved corner, flipped edge", "R U' R' r U' r' U2 r U r'"],
];

function makeDrill(n, group, name, hand, alg) {
  const id = `${n}${hand}`;
  const slot = hand === "R" ? "FR" : "FL";
  const slotName = hand === "R" ? "front-right" : "front-left";
  const L_OVERRIDE = {
    6: "U L' U' L U2 L' U L",
    8: "U L' U2 L U L' U2 L",
    22: "L' U L U2 L' U' L",
    40: "L' U L l' U l U2 l' U' l",
    41: "l' U l U2 l' U' l L' U' L",
  };
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
        ? `Slot is ${slotName}. Use R and U (F if the alg has it). Don’t turn L or B — other pairs stay in.`
        : `Same case on the left. Slot is ${slotName}. Use L and U. Don’t turn R or B.`,
    note: "White on bottom · green = F. One pair only. Stay on this ID until you tap Next or Prev.",
  };
}

export const F2L_DRILL_CASES = FR.flatMap(([n, group, name, alg]) => [
  makeDrill(n, group, name, "R", alg),
  makeDrill(n, group, name, "L", mirrorLRAlg(alg)),
]);

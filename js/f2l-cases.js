/**
 * CubeHead’s 41 filmed cases (academy order). Twins share a number:
 * nR = red–blue front-right, nL = blue–orange front-left. If he only
 * filmed the right slot, the ID is just n. Sledge is an extra alg on 1R,
 * not its own ID.
 * Video: https://www.youtube.com/watch?v=3tYj-9f4dA0
 * List: https://www.cube.academy/intuitive-f2l-algs
 */

import { invertAlg } from "./alg.js";

/** [n, hand, group, short name, alg] — 41 rows, CubeHead 1–41. */
const ROWS = [
  [1, "R", "Easy insert", "Pair on the right", "U R U' R'"],
  [1, "L", "Easy insert", "Pair on the left", "U' L' U L"],
  [2, "R", "Easy insert", "Split insert", "R U R'"],
  [2, "L", "Easy insert", "Split insert", "L' U' L"],
  [3, "R", "Disconnected", "Same colours up", "U' R U R' U2 R U' R'"],
  [3, "L", "Disconnected", "Same colours up", "U L' U' L U2 L' U L"],
  [4, "R", "Disconnected", "Same colours, other edge", "U' R U2 R' U2 R U' R'"],
  [4, "L", "Disconnected", "Same colours, other edge", "U L' U2 L U2 L' U L"],
  [5, "R", "Disconnected", "Different colours up", "U' R U R' U R U R'"],
  [5, "L", "Disconnected", "Different colours up", "U L' U' L U' L' U' L"],
  [6, "R", "Disconnected", "White up, edge left", "U R U2 R' U R U' R'"],
  [6, "L", "Disconnected", "White up, edge left", "U' L' U2 L U' L' U L"],
  [7, "R", "Disconnected", "White up, edge back", "U2 R U R' U R U' R'"],
  [7, "L", "Disconnected", "White up, edge back", "U2 L' U' L U' L' U L"],
  [8, "R", "Corner in slot", "Solved corner, edge oriented", "U' R' F R F' R U R'"],
  [8, "L", "Corner in slot", "Solved corner, edge oriented", "U L F' L' F L' U' L"],
  [9, "R", "Corner in slot", "White left, edge on U", "R U' R' U R U' R'"],
  [9, "L", "Corner in slot", "White left, edge on U", "L' U L U' L' U L"],
  [10, "R", "Corner in slot", "White right, sexy insert", "R U R' U' R U R'"],
  [10, "L", "Corner in slot", "White right, sexy insert", "L' U' L U L' U' L"],
  [11, "R", "Edge in slot", "Solved edge, white up", "U R U' R' U R U' R' U R U' R'"],
  [12, "R", "Edge in slot", "Flipped edge, white up", "U' R' F R F' R U' R'"],
  [13, "R", "Edge in slot", "Solved edge, white left", "U' R U' R' U2 R U' R'"],
  [14, "R", "Edge in slot", "Solved edge, white right", "U R U R' U2 R U R'"],
  [15, "R", "Edge in slot", "Flipped edge, white left", "U2 R U R' F R' F' R"],
  [16, "R", "Edge in slot", "Flipped edge, white right", "U2 F' U' F U R U' R'"],
  [17, "R", "Connected", "White up, edge flipped", "R U' R' U R U' R' U2 R U' R'"],
  [17, "L", "Connected", "White up, edge flipped", "L' U L U' L' U L U2 L' U L"],
  [18, "R", "Connected", "White right, edge front", "U' R U' R' U R U R'"],
  [18, "L", "Connected", "White right, edge front", "U L' U L U' L' U' L"],
  [19, "R", "Connected", "White up, matching", "R U R' U2 R U' R' U R U' R'"],
  [19, "L", "Connected", "White up, matching", "L' U' L U2 L' U L U' L' U L"],
  [20, "R", "Connected", "White right, edge back", "R U2 R' U' R U R'"],
  [20, "L", "Connected", "White right, edge back", "L' U2 L U L' U' L"],
  [21, "R", "Connected", "White up, edge right", "U R U' R' U' R U' R' U R U' R'"],
  [21, "L", "Connected", "White up, edge right", "U' L' U L U L' U L U' L' U L"],
  [22, "R", "Both in slot", "Good edge, white front", "R U' R' U' R U R' U2 R U' R'"],
  [23, "R", "Both in slot", "Good edge, white right", "R U' R' U R U2 R' U R U' R'"],
  [24, "R", "Both in slot", "Flipped edge, white front", "r U' r' U2 r U r' R U R'"],
  [25, "R", "Both in slot", "Flipped edge, white right", "R U' R' r U' r' U2 r U r'"],
  [26, "R", "Both in slot", "Solved corner, flipped edge", "R2 U2 F R2 F' U2 R' U R'"],
];

const HAS_L = new Set(ROWS.filter((row) => row[1] === "L").map((row) => row[0]));

function makeDrill(n, hand, group, name, alg) {
  const id = HAS_L.has(n) ? `${n}${hand}` : String(n);
  const slot = hand === "R" ? "FR" : "FL";
  let note = "White on bottom · blue = F. One pair only. Stay on this ID until you tap Next or Prev.";
  if (id === "1R") {
    note = "Sledge R' F R F' is another way for this case — not a separate exercise. " + note;
  }
  if (id === "1L") {
    note = "L F' L' F is another way for this case — not a separate exercise. " + note;
  }
  return {
    id,
    n,
    hand,
    slot,
    group,
    name: `${id} · ${name}`,
    alg,
    setup: invertAlg(alg),
    copy:
      hand === "R"
        ? "Slot is front-right (red–blue). Use R and U (F if the alg has it). Don’t turn L or B — other pairs stay in."
        : "Slot is front-left (blue–orange). Use L and U. Don’t turn R or B.",
    note,
  };
}

export const F2L_DRILL_CASES = ROWS.map((row) => makeDrill(...row));

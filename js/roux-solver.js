/**
 * Roux guide — First block → Second block → 2-look CMLL → LSE.
 * Same colour orientation as CFOP: white D, yellow U, blue F.
 */

import { isSolved } from "./cube.js";
import { analyzeFirstBlock, analyzeSecondBlock, firstBlockDone, secondBlockDone } from "./roux-blocks.js";
import { analyzeCmll, cmllCornersSolved } from "./cmll-trainer.js";
import { analyzeLse } from "./lse-trainer.js";

export const ROUX_STEPS = [
  {
    id: "first-block",
    title: "First block",
    blurb: "Left 1×2×3 — orange centre + white–orange DL + FL/BL + two D corners.",
  },
  {
    id: "second-block",
    title: "Second block",
    blurb: "Right 1×2×3 — same shape on red. Don’t break the left block.",
  },
  {
    id: "cmll-orient",
    title: "CMLL orient",
    blurb: "Yellow on all four U corners. Sune holds — same idea as 2-look OLL corners.",
  },
  {
    id: "cmll-permute",
    title: "CMLL permute",
    blurb: "Headlights at back → Niklas. No headlights → diagonal alg.",
  },
  {
    id: "lse-eo",
    title: "LSE · EO",
    blurb: "Only yellow/white on U and D for the six free edges. M and U.",
  },
  {
    id: "lse-finish",
    title: "LSE · finish",
    blurb: "Park UL & UR, then M-slice centres and edges until solved.",
  },
];

export const ROUX_SPLIT_SHORT = {
  "first-block": "FB",
  "second-block": "SB",
  "cmll-orient": "CMLL-O",
  "cmll-permute": "CMLL-P",
  "lse-eo": "EO",
  "lse-finish": "LSE",
};

export const ROUX_SPLIT_GROUPS = [
  { id: "fb", title: "First block", indices: [0] },
  { id: "sb", title: "Second block", indices: [1] },
  { id: "cmll", title: "CMLL (2-look)", indices: [2, 3] },
  { id: "lse", title: "LSE", indices: [4, 5] },
];

export const ROUX_STEP_COACHING = [
  {
    tab: "FB",
    tip: "First block: left 1×2×3. Drill the FB tab — square (DL + corners) then side edges.",
  },
  {
    tab: "SB",
    tip: "Second block mirrors FB on the right. Protect the left block; leave the M-slice free.",
  },
  {
    tab: "CMLL",
    tip: "Orient U corners with Sune holds (same as 2-look OLL corners).",
  },
  {
    tab: "CMLL",
    tip: "Permute: headlights on BACK → Niklas; no headlights → diagonal alg.",
  },
  {
    tab: "LSE",
    tip: "EO first: no blue/green on U or D. Use M' U M'-style flips.",
  },
  {
    tab: "LSE",
    tip: "Then UL/UR, then M centres and M2/U2 to finish the slice.",
  },
];

export const ROUX_ALG_LIBRARY = [
  {
    group: "CMLL",
    name: "Sune",
    when: "Orient U corners (2-look CMLL)",
    alg: "R U R' U R U2 R'",
    tip: "Same holds as CFOP 2-look OLL corners. Edges can stay messy.",
  },
  {
    group: "CMLL",
    name: "Niklas",
    when: "Permute — headlights on BACK",
    alg: "R U' L' U R' U' L",
    tip: "Swaps the two front corners. Turn U until headlights sit at back.",
  },
  {
    group: "CMLL",
    name: "Diagonal",
    when: "Permute — no headlights",
    alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    tip: "One diagonal corner swap. Then go to LSE.",
  },
  {
    group: "LSE",
    name: "EO flip",
    when: "Two bad edges in the U layer",
    alg: "M' U M'",
    tip: "Goal: only yellow/white on U and D edge spots.",
  },
  {
    group: "LSE",
    name: "M2 U2 M2 U2",
    when: "UL/UR done — finish M-slice",
    alg: "M2 U2 M2 U2",
    tip: "Centres first with M, then this (or M2 U' cycles) to place the four slice edges.",
  },
];

export function analyzeRoux(facelets) {
  if (isSolved(facelets)) {
    return {
      solved: true,
      stepIndex: 6,
      hint: null,
      stepsDone: [true, true, true, true, true, true],
    };
  }

  const s1 = firstBlockDone(facelets);
  const s2 = s1 && secondBlockDone(facelets);
  const cmll = s2 ? analyzeCmll(facelets) : null;
  const s3 = s2 && !!cmll?.oriented;
  const s4 = s2 && !!cmll?.complete;
  const lse = s4 ? analyzeLse(facelets) : null;
  const s5 = s4 && !!lse?.eo;
  const s6 = s4 && !!lse?.complete;

  const stepsDone = [s1, s2, s3, s4, s5, s6];

  let stepIndex = 0;
  let h = null;
  if (!s1) {
    stepIndex = 0;
    h = analyzeFirstBlock(facelets).hint;
  } else if (!s2) {
    stepIndex = 1;
    h = analyzeSecondBlock(facelets).hint;
  } else if (!s3) {
    stepIndex = 2;
    h = cmll.hint;
  } else if (!s4) {
    stepIndex = 3;
    h = cmll.hint;
  } else if (!s5) {
    stepIndex = 4;
    h = lse.hint;
  } else {
    stepIndex = 5;
    h = lse.hint;
  }

  return { solved: false, stepIndex, hint: h, stepsDone };
}

/** Convenience for callers that only need corner-stage flag. */
export { cmllCornersSolved };

/**
 * Roux guide — First block → Second block → 2-look CMLL → LSE (EO → UL/UR → M-slice).
 * Same colour orientation as CFOP: white D, yellow U, blue F.
 */

import { isSolved } from "./cube.js";
import {
  analyzeFirstBlock,
  analyzeSecondBlock,
  firstBlockDone,
  secondBlockDone,
} from "./roux-blocks.js";
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
    blurb: "No blue/green on U or D. The guide gives one exact M/U alg for your case.",
  },
  {
    id: "lse-ulur",
    title: "LSE · UL & UR",
    blurb: "Orange–yellow at UL, red–yellow at UR. One definite M/U sequence.",
  },
  {
    id: "lse-slice",
    title: "LSE · M-slice",
    blurb: "Centres + UF/UB/DF/DB. M and U2 only — one exact finish alg.",
  },
];

export const ROUX_SPLIT_SHORT = {
  "first-block": "FB",
  "second-block": "SB",
  "cmll-orient": "CMLL-O",
  "cmll-permute": "CMLL-P",
  "lse-eo": "EO",
  "lse-ulur": "UL/UR",
  "lse-slice": "4c",
};

export const ROUX_SPLIT_GROUPS = [
  { id: "fb", title: "First block", indices: [0] },
  { id: "sb", title: "Second block", indices: [1] },
  { id: "cmll", title: "CMLL (2-look)", indices: [2, 3] },
  { id: "lse", title: "LSE", indices: [4, 5, 6] },
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
    tip: "EO: the guide names your bad-edge case and gives one M/U alg — apply it, then hint again.",
  },
  {
    tab: "LSE",
    tip: "UL/UR: one definite sequence to park orange at UL and red at UR.",
  },
  {
    tab: "LSE",
    tip: "M-slice: centres then four edges — one M/U2 alg finishes the cube.",
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
    name: "EO · UF+UR",
    when: "2 bad on UF and UR",
    alg: "M' U M'",
    tip: "Many EO cases — the guide picks the exact alg for what you have.",
  },
  {
    group: "LSE",
    name: "EO · UF+UB",
    when: "2 bad opposite on U",
    alg: "M' U2 M'",
    tip: "Opposite bad edges on U.",
  },
  {
    group: "LSE",
    name: "UL/UR · M2 insert",
    when: "Both edges in the M-slice",
    alg: "M2 U M2",
    tip: "Common insert once EO is done. Guide may add U/U'/U2 first.",
  },
  {
    group: "LSE",
    name: "4c · opposite",
    when: "UL/UR done — opposite M-slice swap",
    alg: "M2 U2 M2 U2",
    tip: "Centres must be correct first (M / M' / M2).",
  },
  {
    group: "LSE",
    name: "4c · adjacent",
    when: "UL/UR done — adjacent swap",
    alg: "M2 U' M2 U' M2 U' M2",
    tip: "Four M2 with U' between — guide confirms when this is the case.",
  },
];

export function analyzeRoux(facelets) {
  if (isSolved(facelets)) {
    return {
      solved: true,
      stepIndex: 7,
      hint: null,
      stepsDone: [true, true, true, true, true, true, true],
    };
  }

  const s1 = firstBlockDone(facelets);
  const s2 = s1 && secondBlockDone(facelets);
  const cmll = s2 ? analyzeCmll(facelets) : null;
  const s3 = s2 && !!cmll?.oriented;
  const s4 = s2 && !!cmll?.complete;
  const lse = s4 ? analyzeLse(facelets) : null;
  const s5 = s4 && !!lse?.eo;
  const s6 = s4 && !!lse?.ulur;
  const s7 = s4 && !!lse?.complete;

  const stepsDone = [s1, s2, s3, s4, s5, s6, s7];

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
  } else if (!s6) {
    stepIndex = 5;
    h = lse.hint;
  } else {
    stepIndex = 6;
    h = lse.hint;
  }

  return { solved: false, stepIndex, hint: h, stepsDone };
}

/** Convenience for callers that only need corner-stage flag. */
export { cmllCornersSolved };

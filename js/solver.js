import {
  COLORS,
  getFace,
  isSolved,
  sticker,
} from "./cube.js";
import { analyzeF2L, f2lComplete } from "./f2l-trainer.js?v=conn1";
import { analyzeOll, OLL_CROSS_ALG, OLL_FINISH_ALGS } from "./oll-trainer.js";
import { analyzePll, PLL_H, PLL_T, PLL_U, PLL_UB, PLL_Y, PLL_Z } from "./pll-trainer.js";

/** Cross · F2L · 2-look OLL · 2-look PLL (white on bottom → yellow on top). */
export const STEPS = [
  {
    id: "white-cross",
    title: "White cross",
    blurb: "White + on the bottom, each edge matching its side centre.",
  },
  {
    id: "f2l",
    title: "F2L pairs",
    blurb: "Each white corner goes in with its edge — four pairs. First two layers done.",
  },
  {
    id: "yellow-cross",
    title: "Yellow cross",
    blurb: "Line = F sexy F′. L = f sexy f′ (L at front-right). Dot = both. Same as the OLL tab.",
  },
  {
    id: "yellow-face",
    title: "Yellow face",
    blurb: "One of 7 CubeHead algs (Sune, Anti-Sune, H, Pi, T, Bowtie, U). Match the picture — don’t repeat Sune.",
  },
  {
    id: "headlights",
    title: "Headlights",
    blurb: "T-perm if headlights on the left. No headlights → Y-perm.",
  },
  {
    id: "yellow-edges",
    title: "Last edges",
    blurb: "Ua / Ub with the bar at back, H if no bars, Z if two opposite sides are done.",
  },
];

export const RIGHTY = "R U R' U'";
export const LEFTY = "L' U' L U";

export const ALG_LIBRARY = [
  {
    group: "OLL",
    name: "Line",
    when: "Yellow line left–right",
    alg: OLL_CROSS_ALG.alg,
    tip: "Horizontal line, then F R U R' U' F'.",
  },
  {
    group: "OLL",
    name: "L",
    when: "Yellow L at front-right",
    alg: OLL_CROSS_ALG.algL,
    tip: "L on UF + UR, then f R U R' U' f'.",
  },
  {
    group: "OLL",
    name: "Dot",
    when: "No yellow edges on top",
    alg: OLL_CROSS_ALG.algDot,
    tip: "Line alg, then L alg, from the same hold.",
  },
  ...OLL_FINISH_ALGS.map((a) => ({
    group: "OLL",
    name: a.name,
    when: "Yellow cross done — " + a.name,
    alg: a.alg,
    tip: a.how,
  })),
  {
    group: "PLL",
    name: PLL_T.name,
    when: "Corners — headlights on LEFT",
    alg: PLL_T.alg,
    tip: "Headlights LEFT, then T-perm.",
  },
  {
    group: "PLL",
    name: PLL_Y.name,
    when: "Corners — no headlights (diagonal)",
    alg: PLL_Y.alg,
    tip: "Y-perm. Finish every move.",
  },
  {
    group: "PLL",
    name: PLL_U.name,
    when: "Edges — bar at BACK; front edge goes right",
    alg: PLL_U.alg,
    tip: "Bar at back → Ua.",
  },
  {
    group: "PLL",
    name: PLL_UB.name,
    when: "Edges — bar at BACK; front edge goes left",
    alg: PLL_UB.alg,
    tip: "Bar at back → Ub.",
  },
  {
    group: "PLL",
    name: PLL_H.name,
    when: "Edges — none solved",
    alg: PLL_H.alg,
    tip: "H-perm. M follows L.",
  },
  {
    group: "PLL",
    name: PLL_Z.name,
    when: "Edges — two opposite sides solved",
    alg: PLL_Z.alg,
    tip: "Bars on LEFT and RIGHT → Z-perm.",
  },
];

function faceCenter(face) {
  return COLORS[face];
}

function whiteCrossDone(facelets) {
  const d = getFace(facelets, "D");
  if (![1, 3, 5, 7].every((i) => d[i] === "white")) return false;
  // DF, DR, DB, DL side colours match centres
  const checks = [
    ["F", 7],
    ["R", 7],
    ["B", 7],
    ["L", 7],
  ];
  return checks.every(([face, i]) => sticker(facelets, face, i) === faceCenter(face));
}

function yellowCrossDone(facelets) {
  const u = getFace(facelets, "U");
  return [1, 3, 5, 7].every((i) => u[i] === "yellow");
}

function yellowFaceOriented(facelets) {
  return getFace(facelets, "U").every((c) => c === "yellow");
}

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

function whiteCrossHint(facelets) {
  const d = getFace(facelets, "D");
  const whiteEdgesOnD = [1, 3, 5, 7].filter((i) => d[i] === "white").length;
  if (whiteEdgesOnD < 4) {
    return hint(
      "Build the white cross",
      "Put white on the bottom. Bring each white edge to D so you get a white +. Don’t worry about corners yet.",
      "U / F / R… (intuitive)",
      "Daisy tip: make a white cross on yellow first, then turn each edge 180° into the white centre — then match sides."
    );
  }
  // Cross shape but misaligned sides — suggest U turns on bottom… actually D turns, or rotate whole cube
  return hint(
    "Match the side centres",
    "White + is there, but an edge doesn’t match its centre. Turn the bottom (D) or re-insert that edge so green meets green, red meets red, etc.",
    "D / D' / D2",
    "When all four side colours line up with centres, step 1 is done."
  );
}

export function analyze(facelets) {
  if (isSolved(facelets)) {
    return {
      solved: true,
      stepIndex: 6,
      hint: null,
      stepsDone: [true, true, true, true, true, true],
    };
  }

  const s1 = whiteCrossDone(facelets);
  const s2 = s1 && f2lComplete(facelets);
  const s3 = s2 && yellowCrossDone(facelets);
  const s4 = s3 && yellowFaceOriented(facelets);
  const pll = s4 ? analyzePll(facelets) : null;
  const s5 = s4 && !!pll?.cornersDone;
  const s6 = s5 && !!pll?.complete;

  const stepsDone = [s1, s2, s3, s4, s5, s6];

  let stepIndex = 0;
  let h = null;
  if (!s1) {
    stepIndex = 0;
    h = whiteCrossHint(facelets);
  } else if (!s2) {
    stepIndex = 1;
    h = analyzeF2L(facelets).hint;
  } else if (!s3) {
    stepIndex = 2;
    h = analyzeOll(facelets).hint;
  } else if (!s4) {
    stepIndex = 3;
    h = analyzeOll(facelets).hint;
  } else if (!s5) {
    stepIndex = 4;
    h = pll.hint;
  } else {
    stepIndex = 5;
    h = pll.hint;
  }

  return { solved: false, stepIndex, hint: h, stepsDone };
}

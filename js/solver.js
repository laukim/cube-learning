import {
  COLORS,
  getFace,
  isSolved,
  sticker,
} from "./cube.js";
import { analyzeF2L, f2lComplete } from "./f2l-trainer.js?v=pop6";
import { analyzeOll } from "./oll-trainer.js";
import { analyzePll } from "./pll-trainer.js";

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
    blurb: "Each white corner goes in with its edge — four pairs, first two layers done.",
  },
  {
    id: "yellow-cross",
    title: "Yellow cross",
    blurb: "Dot / L / line → F, righty, F′ (repeat). Same as the OLL tab.",
  },
  {
    id: "yellow-face",
    title: "Yellow face",
    blurb: "Sune until every yellow faces up. Don’t worry about the sides yet.",
  },
  {
    id: "headlights",
    title: "Headlights",
    blurb: "T-perm: headlights on the left (or once from anywhere if none), until four side corners match.",
  },
  {
    id: "yellow-edges",
    title: "Orient edges",
    blurb: "U-perm: bar at the back, then the edge alg until the last layer is solved.",
  },
];

export const RIGHTY = "R U R' U'";
export const LEFTY = "L' U' L U";

export const ALG_LIBRARY = [
  {
    group: "OLL",
    name: "Sune",
    when: "Yellow cross done — finish corners (beginner OLL)",
    alg: "R U R' U R U2 R'",
    tip: "1 corner → bottom-left. 0 → no yellow on front. 2 adj → on right. 2 opp → top-left + bottom-right. Repeat with holds.",
  },
  {
    group: "PLL",
    name: "T-perm",
    when: "Corners — headlights on LEFT (or none → do once)",
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    tip: "Headlights LEFT. No headlights → same alg from any angle, then headlights appear.",
  },
  {
    group: "PLL",
    name: "Ua",
    when: "Edges — bar at BACK; front edge goes right",
    alg: "R2 U' R' U' R U R U R U' R",
    tip: "Bar at back. No bar → do once from anywhere, then bar at back again.",
  },
  {
    group: "PLL",
    name: "Ub",
    when: "Edges — bar at BACK; front edge goes left",
    alg: "R' U R' U' R' U' R' U R U R2",
    tip: "Mirror of Ua. Undo and switch if Ua made it worse.",
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

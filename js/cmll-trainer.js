/**
 * Beginner 2-look CMLL — orient corners (Sune) then permute (Niklas / diagonal).
 * Assumes both Roux blocks are done (white D, yellow U).
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  COLORS,
  getFace,
  LL,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { invertAlg } from "./alg.js";
import { blocksDone } from "./roux-blocks.js";
import { ollTopDiagram } from "./case-diagram.js";

export const CMLL_SUNE = {
  name: "Sune",
  alg: "R U R' U R U2 R'",
  howOne:
    "1) Exactly one yellow corner on top.\n2) Turn U so that corner sits at bottom-left (UFL).\n3) Do Sune. Tap CMLL hint if yellow isn’t done.",
  howNone:
    "1) No yellow corners on top.\n2) Turn U so no yellow faces you on FRONT.\n3) Sune once → you’ll get one yellow corner.",
  howAdj:
    "1) Two adjacent yellow corners on top.\n2) Turn U so both sit on the RIGHT.\n3) Sune once, then hint again.",
  howOpp:
    "1) Two opposite yellow corners on top.\n2) Hold top-left + bottom-right yellow.\n3) Sune once, then hint again.",
};

/** Adjacent corner swap — Niklas (beginner CPLL). */
export const CMLL_NIKLAS = {
  name: "Niklas",
  alg: "R U' L' U R' U' L",
  how: "1) Find headlights (matching colours on one side).\n2) Turn U until headlights sit on the BACK.\n3) Do Niklas — swaps the front two corners.",
};

/** Diagonal corner swap — E-perm shape via this short beginner alg (Y-perm style corners). */
export const CMLL_DIAG = {
  name: "Diagonal",
  alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  how: "1) No headlights — corners need a diagonal swap.\n2) Hold any way and do the diagonal alg once.\n3) Corners should be solved (edges may look messy — that’s LSE).",
};

const HOLD_NOTE = "White on bottom · blocks on L/R. Match holds with U only.";

function hint(title, copy, alg, note = "", diagram = null) {
  return { title, copy, alg, note, diagram };
}

function faceCenter(face) {
  return COLORS[face];
}

function yellowCornersCount(facelets) {
  const u = getFace(facelets, "U");
  return [0, 2, 6, 8].filter((i) => u[i] === "yellow").length;
}

function cornersOriented(facelets) {
  return getFace(facelets, "U").every((c, i) => {
    if (![0, 2, 6, 8].includes(i)) return true;
    return c === "yellow";
  });
}

function cornerSeated(facelets, cornerIndex) {
  const sideFaces = [
    ["B", "L"],
    ["B", "R"],
    ["F", "R"],
    ["F", "L"],
  ][cornerIndex];
  const target = new Set(["yellow", faceCenter(sideFaces[0]), faceCenter(sideFaces[1])]);
  const uIdx = LL.U_CORNERS[cornerIndex];
  const sides = LL.CORNER_SIDES[cornerIndex];
  const have = new Set([
    sticker(facelets, "U", uIdx),
    sticker(facelets, sides[0].face, sides[0].i),
    sticker(facelets, sides[1].face, sides[1].i),
  ]);
  return [...target].every((c) => have.has(c));
}

export function cmllCornersSolved(facelets) {
  return cornersOriented(facelets) && [0, 1, 2, 3].every((i) => cornerSeated(facelets, i));
}

function headlightsOn(facelets, face) {
  const a = sticker(facelets, face, 0);
  const b = sticker(facelets, face, 2);
  return a === b && a !== "yellow";
}

function withPrefix(prefix, alg) {
  return prefix ? `${prefix} ${alg}` : alg;
}

function orientHint(facelets) {
  const n = yellowCornersCount(facelets);

  if (n === 1) {
    for (let i = 0; i < 4; i++) {
      const tmp = cloneFacelets(facelets);
      for (let t = 0; t < i; t++) applyMove(tmp, "U");
      if (sticker(tmp, "U", 6) === "yellow") {
        const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        return hint(
          `Orient · ${CMLL_SUNE.name}`,
          CMLL_SUNE.howOne,
          withPrefix(prefix, CMLL_SUNE.alg),
          HOLD_NOTE,
          ollTopDiagram({ edges: [false, false, false, false], corners: [false, false, false, true] })
        );
      }
    }
  }

  if (n === 0) {
    for (let i = 0; i < 4; i++) {
      const tmp = cloneFacelets(facelets);
      for (let t = 0; t < i; t++) applyMove(tmp, "U");
      const frontYellow = sticker(tmp, "F", 0) === "yellow" || sticker(tmp, "F", 2) === "yellow";
      if (!frontYellow) {
        const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        return hint(
          `Orient · ${CMLL_SUNE.name}`,
          CMLL_SUNE.howNone,
          withPrefix(prefix, CMLL_SUNE.alg),
          HOLD_NOTE,
          ollTopDiagram({ edges: [false, false, false, false], corners: [false, false, false, false] })
        );
      }
    }
    return hint(`Orient · ${CMLL_SUNE.name}`, CMLL_SUNE.howNone, CMLL_SUNE.alg, HOLD_NOTE);
  }

  if (n === 2) {
    // Adjacent vs opposite
    const u = getFace(facelets, "U");
    const yellowAt = [0, 2, 8, 6].filter((i) => u[i] === "yellow");
    const opp = (yellowAt.includes(0) && yellowAt.includes(8)) || (yellowAt.includes(2) && yellowAt.includes(6));
    if (opp) {
      for (let i = 0; i < 4; i++) {
        const tmp = cloneFacelets(facelets);
        for (let t = 0; t < i; t++) applyMove(tmp, "U");
        if (sticker(tmp, "U", 0) === "yellow" && sticker(tmp, "U", 8) === "yellow") {
          const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
          return hint(
            `Orient · ${CMLL_SUNE.name}`,
            CMLL_SUNE.howOpp,
            withPrefix(prefix, CMLL_SUNE.alg),
            HOLD_NOTE,
            ollTopDiagram({ edges: [false, false, false, false], corners: [true, false, true, false] })
          );
        }
      }
      return hint(`Orient · ${CMLL_SUNE.name}`, CMLL_SUNE.howOpp, CMLL_SUNE.alg, HOLD_NOTE);
    }
    for (let i = 0; i < 4; i++) {
      const tmp = cloneFacelets(facelets);
      for (let t = 0; t < i; t++) applyMove(tmp, "U");
      if (sticker(tmp, "U", 2) === "yellow" && sticker(tmp, "U", 8) === "yellow") {
        const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        return hint(
          `Orient · ${CMLL_SUNE.name}`,
          CMLL_SUNE.howAdj,
          withPrefix(prefix, CMLL_SUNE.alg),
          HOLD_NOTE,
          ollTopDiagram({ edges: [false, false, false, false], corners: [false, true, true, false] })
        );
      }
    }
    return hint(`Orient · ${CMLL_SUNE.name}`, CMLL_SUNE.howAdj, CMLL_SUNE.alg, HOLD_NOTE);
  }

  // n === 4 but not seated — fall through to permute; n === 3 shouldn't happen on legal cube
  return hint(
    `Orient · ${CMLL_SUNE.name}`,
    "Finish corner orientation with Sune holds, then permute.",
    CMLL_SUNE.alg,
    HOLD_NOTE
  );
}

function permuteHint(facelets) {
  if (cmllCornersSolved(facelets)) {
    return hint("CMLL done", "Corners are solved. Last six edges next.", "", HOLD_NOTE);
  }

  // Headlights on back → Niklas
  for (let i = 0; i < 4; i++) {
    const tmp = cloneFacelets(facelets);
    for (let t = 0; t < i; t++) applyMove(tmp, "U");
    if (headlightsOn(tmp, "B") && !cmllCornersSolved(tmp)) {
      // Check this is adjacent swap (exactly one pair of headlights, corners not all solved)
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      return hint(
        `Permute · ${CMLL_NIKLAS.name}`,
        CMLL_NIKLAS.how,
        withPrefix(prefix, CMLL_NIKLAS.alg),
        HOLD_NOTE
      );
    }
  }

  const faces = ["L", "B", "R", "F"];
  const anyHl = faces.some((f) => headlightsOn(facelets, f));
  if (!anyHl) {
    return hint(`Permute · ${CMLL_DIAG.name}`, CMLL_DIAG.how, CMLL_DIAG.alg, HOLD_NOTE);
  }

  return hint(
    `Permute · ${CMLL_NIKLAS.name}`,
    CMLL_NIKLAS.how,
    `U …  ${CMLL_NIKLAS.alg}`,
    HOLD_NOTE
  );
}

export function analyzeCmll(facelets) {
  if (!blocksDone(facelets)) {
    return {
      oriented: false,
      complete: false,
      hint: hint(
        "Finish both blocks first",
        "CMLL is for U-layer corners after FB + SB. Build the left and right 1×2×3s first.",
        "",
        "FB → SB → CMLL → LSE."
      ),
    };
  }

  if (cmllCornersSolved(facelets)) {
    return {
      oriented: true,
      complete: true,
      hint: hint("CMLL complete", "Corners done. Open LSE for the last six edges.", "", HOLD_NOTE),
    };
  }

  if (!cornersOriented(facelets)) {
    return { oriented: false, complete: false, hint: orientHint(facelets) };
  }

  return { oriented: true, complete: false, hint: permuteHint(facelets) };
}

export const CMLL_TIPS = [
  {
    title: "2-look CMLL",
    body: "Orient with Sune (same holds as 2-look OLL corners), then permute: headlights at back → Niklas; no headlights → diagonal alg.",
  },
  {
    title: "Edges don’t matter yet",
    body: "CMLL only cares about the four U corners. Messy UL/UR and M-slice edges are normal — LSE cleans them.",
  },
  {
    title: "Full CMLL later",
    body: "Speedrovers learn 42 CMLL algs. This coach starts with 2-look so you can finish solves sooner.",
  },
];

export const CMLL_DRILL_CASES = [
  { id: "orient-1", name: "Orient · 1 corner", setup: () => invertAlg(CMLL_SUNE.alg) },
  { id: "orient-0", name: "Orient · 0 corners", setup: () => invertAlg(`${CMLL_SUNE.alg} ${CMLL_SUNE.alg}`) },
  {
    id: "orient-adj",
    name: "Orient · 2 adjacent",
    setup: () => invertAlg(`${CMLL_SUNE.alg} U ${CMLL_SUNE.alg}`),
  },
  { id: "perm-niklas", name: "Permute · Niklas", setup: () => invertAlg(CMLL_NIKLAS.alg) },
  { id: "perm-diag", name: "Permute · diagonal", setup: () => invertAlg(CMLL_DIAG.alg) },
];

let cmllDrillIndex = 0;
let cmllDrillStarted = false;

export function getCmllDrillInfo() {
  const n = CMLL_DRILL_CASES.length;
  const i = ((cmllDrillIndex % n) + n) % n;
  const c = CMLL_DRILL_CASES[i];
  return { index: i, total: n, id: c.id, name: c.name, started: cmllDrillStarted };
}

export function scrambleCmll(facelets, mode = "next") {
  const n = CMLL_DRILL_CASES.length;
  if (mode === "again" && cmllDrillStarted) {
    /* keep index */
  } else if (mode === "next" || !cmllDrillStarted) {
    if (cmllDrillStarted) cmllDrillIndex = (cmllDrillIndex + 1) % n;
    cmllDrillStarted = true;
  }
  const i = ((cmllDrillIndex % n) + n) % n;
  const setup = CMLL_DRILL_CASES[i].setup();
  const src = solvedFacelets();
  for (let j = 0; j < 54; j++) facelets[j] = src[j];
  applyAlg(facelets, setup);
  const auf = ["", "U", "U'", "U2"][Math.floor(Math.random() * 4)];
  if (auf) applyAlg(facelets, auf);
  return auf ? `${setup} ${auf}` : setup;
}

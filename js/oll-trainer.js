/**
 * 2-look OLL drill — Cube Academy algs
 * https://www.cube.academy/2-look-oll-algs
 *
 * Step 1: yellow cross (dot / L / line)
 * Step 2: finish OLL (7 OCLL cases)
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  getFace,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { f2lComplete } from "./f2l-trainer.js";

/** Expand WCA wide moves so ERNO (which uses lowercase for CCW) can animate them. */
export function expandWideAlg(alg) {
  const map = {
    r: "R M'",
    "r'": "M R'",
    r2: "R2 M2",
    "r2'": "R2 M2",
    f: "F S",
    "f'": "S' F'",
    f2: "F2 S2",
    "f2'": "F2 S2",
    l: "L M",
    "l'": "M' L'",
    l2: "L2 M2",
    b: "B S'",
    "b'": "S B'",
    b2: "B2 S2",
  };
  return String(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((tok) => {
      const key = tok.toLowerCase();
      // Only expand when token is wide-style lowercase (r, f, …), not R / F
      if (tok[0] === tok[0].toLowerCase() && map[key]) {
        return map[key].split(/\s+/);
      }
      return [tok];
    })
    .join(" ");
}

export const OLL_CROSS = {
  LINE: { name: "Line", alg: "F R U R' U' F'", hold: "Hold the yellow line left–right (horizontal)." },
  L: { name: "L shape", alg: "f R U R' U' f'", hold: "Hold the yellow L pointing back-left (9-o’clock)." },
  DOT: {
    name: "Dot",
    alg: "F R U R' U' F' f R U R' U' f'",
    hold: "No yellow edges on top. Do line alg, then L alg (or the combined sequence).",
  },
};

export const OLL_FINISH = {
  SUNE: { name: "Sune", alg: "R U R' U R U2 R'", hold: "One yellow corner on top; headlights on left." },
  ANTISUNE: { name: "Antisune", alg: "R U2 R' U' R U' R'", hold: "One yellow corner on top; headlights on right (mirror fish)." },
  H: { name: "H", alg: "R U R' U R U' R' U R U2 R'", hold: "No yellow corners on top; opposite headlights." },
  PI: { name: "Pi", alg: "R U2 R2 U' R2 U' R2 U2 R", hold: "No yellow corners on top; adjacent headlights." },
  T: { name: "T", alg: "r U R' U' r' F R F'", hold: "Two yellow corners on top (adjacent); headlights facing you." },
  BOWTIE: { name: "Bowtie", alg: "F' r U R' U' r' F R", hold: "Two yellow corners on top (adjacent); bowtie / L shape on sides." },
  HEADLIGHTS: {
    name: "Headlights",
    alg: "R2 D R' U2 R D' R' U2 R'",
    hold: "Two yellow corners on top, opposite; headlights facing you.",
  },
};

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

function yellowCrossDone(facelets) {
  const u = getFace(facelets, "U");
  return [1, 3, 5, 7].every((i) => u[i] === "yellow");
}

function yellowFaceDone(facelets) {
  return getFace(facelets, "U").every((c) => c === "yellow");
}

/** Edge yellow flags: [UB, UR, UF, UL] */
function edgeYellow(facelets) {
  return [1, 5, 7, 3].map((i) => sticker(facelets, "U", i) === "yellow");
}

/** Corner yellow on U: [UBL, UBR, UFR, UFL] */
function cornerYellowU(facelets) {
  return [0, 2, 8, 6].map((i) => sticker(facelets, "U", i) === "yellow");
}

/** Top-row side stickers yellow? [left, right] for a face. */
function faceTopYellow(facelets, face) {
  return [sticker(facelets, face, 0) === "yellow", sticker(facelets, face, 2) === "yellow"];
}

function headlightsOn(facelets, face) {
  const [a, b] = faceTopYellow(facelets, face);
  return a && b;
}

function findAuf(facelets, pred) {
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    if (pred(tmp)) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      return { prefix, state: cloneFacelets(tmp), turns: i };
    }
    applyMove(tmp, "U");
  }
  return null;
}

function withPrefix(prefix, alg) {
  return prefix ? `${prefix} ${alg}` : alg;
}

function crossShapeHint(facelets) {
  const flags = edgeYellow(facelets);
  const n = flags.filter(Boolean).length;

  if (n === 4) return null;

  if (n === 0) {
    const c = OLL_CROSS.DOT;
    return hint(`Step 1 · ${c.name}`, c.hold, c.alg, "Cube Academy · Creating Cross. After this you should get an L or line — re-hint.");
  }

  // Line: opposite edges yellow
  const lineH = flags[1] && flags[3] && !flags[0] && !flags[2]; // UR + UL
  const lineV = flags[0] && flags[2] && !flags[1] && !flags[3]; // UB + UF
  if (lineH || lineV) {
    const prefix = lineV ? "U" : "";
    const c = OLL_CROSS.LINE;
    return hint(
      `Step 1 · ${c.name}`,
      c.hold,
      withPrefix(prefix, c.alg),
      "Cube Academy · Creating Cross. Vertical line? U so it becomes horizontal first."
    );
  }

  // L shape: adjacent — hold back-left (UB + UL)
  const found = findAuf(facelets, (f) => {
    const e = edgeYellow(f);
    return e[0] && e[3] && !e[1] && !e[2];
  });
  const c = OLL_CROSS.L;
  return hint(
    `Step 1 · ${c.name}`,
    c.hold,
    withPrefix(found?.prefix || "", c.alg),
    "Cube Academy · Creating Cross. Same sexy move with wide f — or hold L at 9-o’clock and use F sexy F′ if you prefer."
  );
}

/**
 * Recognise OCLL (corners only) with yellow cross already done.
 * Returns { key, prefix } for OLL_FINISH.
 */
function recogniseOcll(facelets) {
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    const key = matchOcllAt(tmp);
    if (key) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      return { key, prefix };
    }
    applyMove(tmp, "U");
  }
  return null;
}

function matchOcllAt(f) {
  const c = cornerYellowU(f);
  const n = c.filter(Boolean).length;
  const hlF = headlightsOn(f, "F");
  const hlR = headlightsOn(f, "R");
  const hlB = headlightsOn(f, "B");
  const hlL = headlightsOn(f, "L");
  const adj =
    (c[0] && c[1] && !c[2] && !c[3]) ||
    (c[1] && c[2] && !c[0] && !c[3]) ||
    (c[2] && c[3] && !c[0] && !c[1]) ||
    (c[3] && c[0] && !c[1] && !c[2]);
  const opp = (c[0] && c[2] && !c[1] && !c[3]) || (c[1] && c[3] && !c[0] && !c[2]);

  if (n === 0) {
    if ((hlF && hlB && !hlL && !hlR) || (hlL && hlR && !hlF && !hlB)) return "H";
    if ((hlF && hlR) || (hlR && hlB) || (hlB && hlL) || (hlL && hlF)) {
      // Prefer Pi when headlights are adjacent — rotate so headlights sit F+R
      if (hlF && hlR) return "PI";
    }
    return null;
  }

  if (n === 1) {
    // Standard sune hold: oriented corner at UFR (c[2]), headlights on left? 
    // Common: fish pointing — Sune with sticker pattern headlights on L
    if (hlL) return "SUNE";
    if (hlR) return "ANTISUNE";
    // Fallback: yellow corner at UFR + any → try sune after more AUF (caller rotates)
    if (c[2]) return "SUNE";
    if (c[0]) return "ANTISUNE";
    return null;
  }

  if (n === 2) {
    if (opp && hlF) return "HEADLIGHTS";
    if (adj && hlF) return "T";
    if (adj && !hlF) return "BOWTIE";
    if (opp) return "HEADLIGHTS";
  }

  return null;
}

function finishHint(facelets) {
  const rec = recogniseOcll(facelets);
  if (!rec) {
    return hint(
      "Step 2 · Finish OLL",
      "Yellow cross is done — now twist the corners. U-spin until the case matches a Cube Academy finish alg (Sune, Antisune, H, Pi, T, Bowtie, Headlights).",
      "U / U' / U2",
      "Source: cube.academy/2-look-oll-algs"
    );
  }
  const caseInfo = OLL_FINISH[rec.key];
  return hint(
    `Step 2 · ${caseInfo.name}`,
    caseInfo.hold,
    withPrefix(rec.prefix, caseInfo.alg),
    "Cube Academy · Finish OLL. After the alg, yellow face should be complete (PLL / edges next)."
  );
}

export function analyzeOll(facelets) {
  if (!f2lComplete(facelets)) {
    return {
      f2l: false,
      crossDone: false,
      complete: false,
      stage: "need-f2l",
      steps: [
        { id: "cross", done: false },
        { id: "finish", done: false },
      ],
      hint: hint(
        "F2L first",
        "2-look OLL needs a finished first two layers (white cross + four pairs). Tap New OLL for a last-layer scramble that keeps F2L solved.",
        "",
        "Or finish F2L in the F2L tab, then come back."
      ),
    };
  }

  const crossDone = yellowCrossDone(facelets);
  const complete = yellowFaceDone(facelets);

  if (complete) {
    return {
      f2l: true,
      crossDone: true,
      complete: true,
      stage: "done",
      steps: [
        { id: "cross", done: true },
        { id: "finish", done: true },
      ],
      hint: hint(
        "OLL done",
        "Full yellow face. Open the PLL tab next — corners then edges — to finish the cube without twisting yellow again.",
        "",
        "Cube Academy 2-look OLL · then 2-look PLL"
      ),
    };
  }

  if (!crossDone) {
    return {
      f2l: true,
      crossDone: false,
      complete: false,
      stage: "cross",
      steps: [
        { id: "cross", done: false },
        { id: "finish", done: false },
      ],
      hint: crossShapeHint(facelets),
    };
  }

  return {
    f2l: true,
    crossDone: true,
    complete: false,
    stage: "finish",
    steps: [
      { id: "cross", done: true },
      { id: "finish", done: false },
    ],
    hint: finishHint(facelets),
  };
}

/** Scramble last layer only — F2L stays solved; OLL not done. */
export function scrambleOll(facelets) {
  const s = solvedFacelets();
  const pool = [
    ...Object.values(OLL_CROSS).map((c) => c.alg),
    ...Object.values(OLL_FINISH).map((c) => c.alg),
    "U",
    "U'",
    "U2",
    "R U R' U R U2 R'",
    "R U2 R' U' R U' R'",
  ];
  const parts = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    for (let i = 0; i < 54; i++) facelets[i] = s[i];
    parts.length = 0;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const expanded = expandWideAlg(pick);
      applyAlg(facelets, expanded);
      parts.push(expanded);
      const auf = ["U", "U'", "U2"][Math.floor(Math.random() * 3)];
      applyAlg(facelets, auf);
      parts.push(auf);
    }
    if (f2lComplete(facelets) && !yellowFaceDone(facelets)) {
      return parts.join(" ");
    }
  }

  for (let i = 0; i < 54; i++) facelets[i] = s[i];
  const fallback = "R U2 R' U' R U' R' U'";
  applyAlg(facelets, fallback);
  return fallback;
}

export const OLL_TIPS = [
  {
    title: "What 2-look OLL is",
    body: "After F2L, make the whole yellow face in two looks: (1) yellow cross on top, (2) twist corners so all yellow faces up. Edges/corners may still be in the wrong seats — that’s PLL next.",
  },
  {
    title: "Step 1 — Creating Cross",
    body: "Dot → L → line → cross. Cube Academy: F sexy F′ (line), f sexy f′ (L), or both for the dot. Hold line horizontal; L at 9-o’clock.",
  },
  {
    title: "Step 2 — Finish OLL",
    body: "Seven corner cases: Sune, Antisune, H, Pi, T, Bowtie, Headlights. U-spin to the hold shown in the hint, then the alg.",
  },
  {
    title: "Wide moves (f / r)",
    body: "f and r mean wide turns (two layers). The app expands them when you hit Apply. On a real cube: f = F + middle slice toward you; r = R + middle.",
  },
  {
    title: "Source",
    body: "Algs from Cube Academy 2 Look OLL — https://www.cube.academy/2-look-oll-algs",
  },
];

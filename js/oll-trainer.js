/**
 * CubeHead 2-look OLL — 10 algs (3 for the yellow cross, 7 to finish corners).
 * https://www.cube.academy/2-look-oll-algs
 *
 * Step 1: line / L / dot
 * Step 2: Sune, Anti-Sune, H, Pi, T, Bowtie, U — one alg, not repeated Sune
 */

import {
  applyAlg,
  cloneFacelets,
  getFace,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { expandWideAlg, invertAlg } from "./alg.js";
import { f2lComplete } from "./f2l-trainer.js?v=conn1";
import { ollTopDiagram } from "./case-diagram.js";

export { expandWideAlg, invertAlg };

function randomAuf() {
  return ["", "U", "U'", "U2"][Math.floor(Math.random() * 4)];
}

export const OLL_CROSS_ALG = {
  name: "Cross",
  alg: "F R U R' U' F'",
  algL: "f R U R' U' f'",
  algDot: "F R U R' U' F' f R U R' U' f'",
  howDot:
    "1) No yellow edges on top (only the centre).\n2) Do the line alg, then the L alg, from this hold.\n3) Yellow cross — then finish corners with a 2-look OLL alg.",
  howL:
    "1) Yellow L on top — turn U until the L sits front + right (see picture).\n2) Do f R U R' U' f'.\n3) Yellow cross done — then finish corners.",
  howLine:
    "1) Turn U until the yellow line is left–right (horizontal).\n2) Do F R U R' U' F'.\n3) Yellow cross done — then finish corners.",
};

export const OLL_FINISH_ALGS = [
  {
    id: "sune",
    name: "Sune",
    alg: "R U R' U R U2 R'",
    how: "One yellow corner on top, at bottom-left. Then Sune.",
  },
  {
    id: "antisune",
    name: "Anti-Sune",
    alg: "R U2 R' U' R U' R'",
    how: "One yellow corner on top, at top-right. Then Anti-Sune.",
  },
  {
    id: "h",
    name: "H",
    alg: "R U R' U R U' R' U R U2 R'",
    how: "No yellow corners on top. Yellow headlights on LEFT and RIGHT. Then H.",
  },
  {
    id: "pi",
    name: "Pi",
    alg: "R U2 R2 U' R2 U' R2 U2 R",
    how: "No yellow corners on top. Yellow headlights on the LEFT (bunny ears). Then Pi.",
  },
  {
    id: "t",
    name: "T",
    alg: "r U R' U' r' F R F'",
    how: "Two yellow corners on the RIGHT. Then T.",
  },
  {
    id: "bowtie",
    name: "Bowtie",
    alg: "F' r U R' U' r' F R",
    how: "Two yellow corners diagonal (top-right + bottom-left). Then Bowtie.",
  },
  {
    id: "u",
    name: "U",
    alg: "R2 D R' U2 R D' R' U2 R'",
    how: "Two yellow corners at the BACK. Headlights on FRONT. Then U.",
  },
];

/** @deprecated beginner alias — Sune is now one of seven finish algs */
export const OLL_SUNE = OLL_FINISH_ALGS[0];

const HOLD_NOTE =
  "White on bottom · blue = F. Match the picture with U only — don’t orbit to follow F/R.";

function hint(title, copy, alg, note = "", diagram = null) {
  return { title, copy, alg, note, diagram };
}

function yellowCrossDone(facelets) {
  const u = getFace(facelets, "U");
  return [1, 3, 5, 7].every((i) => u[i] === "yellow");
}

function yellowFaceDone(facelets) {
  return getFace(facelets, "U").every((c) => c === "yellow");
}

function edgeYellow(facelets) {
  return [1, 5, 7, 3].map((i) => sticker(facelets, "U", i) === "yellow");
}

/** [UBL, UBR, UFR, UFL] */
function cornerYellowU(facelets) {
  return [0, 2, 8, 6].map((i) => sticker(facelets, "U", i) === "yellow");
}

function withPrefix(prefix, alg) {
  return prefix ? `${prefix} ${alg}` : alg;
}

function prefixAt(i) {
  return i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
}

function applyPrefix(facelets, prefix) {
  if (prefix) applyAlg(facelets, prefix);
  return facelets;
}

function diagramOf(facelets) {
  return ollTopDiagram({ edges: edgeYellow(facelets), corners: cornerYellowU(facelets) });
}

function findHold(facelets, alg, ok) {
  for (let i = 0; i < 4; i++) {
    const prefix = prefixAt(i);
    const held = cloneFacelets(facelets);
    applyPrefix(held, prefix);
    const after = cloneFacelets(held);
    applyAlg(after, expandWideAlg(alg));
    if (ok(after)) return { prefix, held };
  }
  return null;
}

function crossShapeHint(facelets) {
  const flags = edgeYellow(facelets);
  const n = flags.filter(Boolean).length;
  const c = OLL_CROSS_ALG;

  if (n === 4) return null;

  if (n === 0) {
    const hit = findHold(facelets, c.algDot, yellowCrossDone);
    const prefix = hit?.prefix || "";
    const held = hit?.held || facelets;
    return hint(
      `Step 1 · ${c.name} · Dot`,
      c.howDot,
      withPrefix(prefix, c.algDot),
      HOLD_NOTE,
      diagramOf(held)
    );
  }

  const lineH = flags[1] && flags[3] && !flags[0] && !flags[2];
  const lineV = flags[0] && flags[2] && !flags[1] && !flags[3];
  if (lineH || lineV) {
    const hit = findHold(facelets, c.alg, yellowCrossDone);
    const prefix = hit?.prefix || (lineV ? "U" : "");
    const held = hit?.held || facelets;
    return hint(
      `Step 1 · ${c.name} · Line`,
      c.howLine,
      withPrefix(prefix, c.alg),
      HOLD_NOTE,
      diagramOf(held)
    );
  }

  const hit = findHold(facelets, c.algL, yellowCrossDone);
  const prefix = hit?.prefix || "";
  const held = hit?.held || facelets;
  return hint(
    `Step 1 · ${c.name} · L`,
    c.howL,
    withPrefix(prefix, c.algL),
    HOLD_NOTE,
    diagramOf(held)
  );
}

function finishHint(facelets) {
  for (const a of OLL_FINISH_ALGS) {
    const hit = findHold(facelets, a.alg, yellowFaceDone);
    if (!hit) continue;
    return hint(
      `Step 2 · ${a.name}`,
      a.how,
      withPrefix(hit.prefix, a.alg),
      HOLD_NOTE,
      diagramOf(hit.held)
    );
  }

  return hint(
    "Step 2 · OLL",
    "Couldn’t name this hold. Undo, turn U, and tap OLL hint again.",
    "",
    HOLD_NOTE,
    diagramOf(facelets)
  );
}

/**
 * @param {string[]} facelets
 * @param {{ look?: "cross" | "corners" }} [opts]
 *   `look` is only for the OLL drill tab. Timed Guide always uses both looks.
 */
export function analyzeOll(facelets, opts = {}) {
  const look = opts.look;
  if (!f2lComplete(facelets)) {
    return {
      f2l: false,
      crossDone: false,
      complete: false,
      stage: "need-f2l",
      hint: hint(
        "F2L first",
        "2-look OLL needs F2L done. Tap Again / Next case for a scramble that keeps F2L solved.",
        "",
        ""
      ),
    };
  }

  const crossDone = yellowCrossDone(facelets);
  const faceDone = yellowFaceDone(facelets);

  if (faceDone || (look === "cross" && crossDone)) {
    return {
      f2l: true,
      crossDone: true,
      complete: true,
      stage: "done",
      hint: hint(
        look === "cross" ? "Look 1 done" : "OLL done",
        look === "cross"
          ? "Yellow cross is there. Again / Next for another shape, or switch to Look 2 for corners."
          : "Full yellow face. Open the PLL tab — T or Y, then Ua / Ub / H / Z.",
        "",
        look === "cross" ? "2-look OLL · look 1" : "2-look OLL · look 2"
      ),
    };
  }

  if (!crossDone) {
    return {
      f2l: true,
      crossDone: false,
      complete: false,
      stage: "cross",
      hint: crossShapeHint(facelets),
    };
  }

  return {
    f2l: true,
    crossDone: true,
    complete: false,
    stage: "finish",
    hint: finishHint(facelets),
  };
}

/**
 * CubeHead 2-look OLL order: 3 cross shapes, then 7 corner cases.
 * The OLL tab drills one look at a time (default: look 2).
 */
export const OLL_DRILL_CASES = [
  { id: "line", name: "Line", setup: () => invertAlg(OLL_CROSS_ALG.alg), look: "cross" },
  { id: "l", name: "L shape", setup: () => invertAlg(OLL_CROSS_ALG.algL), look: "cross" },
  { id: "dot", name: "Dot", setup: () => invertAlg(OLL_CROSS_ALG.algDot), look: "cross" },
  ...OLL_FINISH_ALGS.map((a) => ({
    id: a.id,
    name: a.name,
    setup: () => invertAlg(a.alg),
    look: "corners",
  })),
];

export const OLL_CROSS_CASES = OLL_DRILL_CASES.filter((c) => c.look === "cross");
export const OLL_CORNER_CASES = OLL_DRILL_CASES.filter((c) => c.look === "corners");

/** Default look 2 — yellow cross is already known. */
let ollLook = "corners";
let ollDrillIndex = 0;
let ollDrillStarted = false;

function drillPool() {
  return ollLook === "cross" ? OLL_CROSS_CASES : OLL_CORNER_CASES;
}

export function getOllLook() {
  return ollLook;
}

export function setOllLook(look) {
  if (look !== "cross" && look !== "corners") return getOllDrillInfo();
  if (ollLook !== look) {
    ollLook = look;
    ollDrillIndex = 0;
    ollDrillStarted = false;
  }
  return getOllDrillInfo();
}

export function resetOllDrill() {
  ollLook = "corners";
  ollDrillIndex = 0;
  ollDrillStarted = false;
}

export function getOllDrillInfo() {
  const pool = drillPool();
  const n = pool.length;
  const i = ((ollDrillIndex % n) + n) % n;
  const c = pool[i];
  return { look: ollLook, index: i, total: n, id: c.id, name: c.name, started: ollDrillStarted };
}

/**
 * @param {string[]} facelets
 * @param {'again' | 'next'} mode
 */
export function scrambleOll(facelets, mode = "next") {
  const pool = drillPool();
  const n = pool.length;
  if (!ollDrillStarted) {
    ollDrillStarted = true;
    ollDrillIndex = 0;
  } else if (mode === "next") {
    ollDrillIndex = (ollDrillIndex + 1) % n;
  }

  const c = pool[((ollDrillIndex % n) + n) % n];
  const s = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = s[i];

  const setup = expandWideAlg(c.setup());
  applyAlg(facelets, setup);
  const auf = randomAuf();
  if (auf) applyAlg(facelets, auf);

  return (auf ? [setup, auf] : [setup]).join(" ");
}

export const OLL_TIPS = [
  {
    title: "Look 2 — Corners (this tab’s default)",
    body: "Yellow cross is already there. One of 7 algs: Sune, Anti-Sune, H, Pi, T, Bowtie, U. Match the picture with U, then that one alg — not Sune on repeat.",
  },
  {
    title: "Look 1 — Cross (if you want it)",
    body: "Switch to Look 1 for line / L / dot. Line = F R U R' U' F'. L = f R U R' U' f' (L at front-right). Dot = both.",
  },
  {
    title: "Practice order",
    body: "Look 2 walks the 7 corner cases. Look 1 walks line, L, dot. Again = same case. Next OLL = next in that look.",
  },
  {
    title: "Don’t orbit for the alg",
    body: "Dragging around only changes the camera. Flick the sticker you mean — F/R/L/B are the cube’s faces, not whatever colour is toward you.",
  },
  {
    title: "Source",
    body: "CubeHead 2-look OLL — https://www.cube.academy/2-look-oll-algs",
  },
];

/** @deprecated aliases for older imports / alg library */
export const OLL_CROSS = {
  LINE: { name: "Line", alg: OLL_CROSS_ALG.alg, how: OLL_CROSS_ALG.howLine },
  L: { name: "L shape", alg: OLL_CROSS_ALG.algL, how: OLL_CROSS_ALG.howL },
  DOT: { name: "Dot", alg: OLL_CROSS_ALG.algDot, how: OLL_CROSS_ALG.howDot },
};
export const OLL_FINISH = {
  SUNE: OLL_FINISH_ALGS[0],
  ANTISUNE: OLL_FINISH_ALGS[1],
  H: OLL_FINISH_ALGS[2],
  PI: OLL_FINISH_ALGS[3],
  T: OLL_FINISH_ALGS[4],
  BOWTIE: OLL_FINISH_ALGS[5],
  HEADLIGHTS: OLL_FINISH_ALGS[6],
};

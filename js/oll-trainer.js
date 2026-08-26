/**
 * 2-look OLL drill — Cube Academy algs
 * https://www.cube.academy/2-look-oll-algs
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
import { ollTopDiagram } from "./case-diagram.js";

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
      if (tok[0] === tok[0].toLowerCase() && map[key]) {
        return map[key].split(/\s+/);
      }
      return [tok];
    })
    .join(" ");
}

function invertMove(move) {
  const m = String(move).trim();
  if (!m) return "";
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return `${m}'`;
}

/** Reverse an alg (after expanding wide moves). */
export function invertAlg(alg) {
  return expandWideAlg(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map(invertMove)
    .join(" ");
}

function randomAuf() {
  return ["", "U", "U'", "U2"][Math.floor(Math.random() * 4)];
}

/**
 * Fixed OLL practice order — not random.
 * Cross shapes first, then finish (OCLL) cases.
 */
export const OLL_DRILL_CASES = [
  { id: "dot", name: "Dot", setup: () => invertAlg(OLL_CROSS.DOT.alg) },
  { id: "l", name: "L shape", setup: () => invertAlg(OLL_CROSS.L.alg) },
  { id: "line", name: "Line", setup: () => invertAlg(OLL_CROSS.LINE.alg) },
  { id: "sune", name: "Sune", setup: () => invertAlg(OLL_FINISH.SUNE.alg) },
  { id: "antisune", name: "Antisune", setup: () => invertAlg(OLL_FINISH.ANTISUNE.alg) },
  { id: "t", name: "T", setup: () => invertAlg(OLL_FINISH.T.alg) },
  { id: "bowtie", name: "Bowtie", setup: () => invertAlg(OLL_FINISH.BOWTIE.alg) },
  { id: "headlights", name: "Headlights", setup: () => invertAlg(OLL_FINISH.HEADLIGHTS.alg) },
  { id: "h", name: "H", setup: () => invertAlg(OLL_FINISH.H.alg) },
  { id: "pi", name: "Pi", setup: () => invertAlg(OLL_FINISH.PI.alg) },
];

let ollDrillIndex = 0;
let ollDrillStarted = false;

export function getOllDrillInfo() {
  const n = OLL_DRILL_CASES.length;
  const i = ((ollDrillIndex % n) + n) % n;
  const c = OLL_DRILL_CASES[i];
  return { index: i, total: n, id: c.id, name: c.name };
}

/**
 * @param {string[]} facelets
 * @param {'again' | 'next'} mode again = same case (new AUF); next = advance in order
 */
export function scrambleOll(facelets, mode = "next") {
  const n = OLL_DRILL_CASES.length;
  if (!ollDrillStarted) {
    ollDrillStarted = true;
    ollDrillIndex = 0;
  } else if (mode === "next") {
    ollDrillIndex = (ollDrillIndex + 1) % n;
  }

  const c = OLL_DRILL_CASES[((ollDrillIndex % n) + n) % n];
  const s = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = s[i];

  const setup = c.setup();
  applyAlg(facelets, setup);
  const auf = randomAuf();
  if (auf) applyAlg(facelets, auf);

  const parts = auf ? [setup, auf] : [setup];
  return parts.join(" ");
}

export const OLL_CROSS = {
  LINE: {
    name: "Line",
    alg: "F R U R' U' F'",
    how: "1) Turn only U until the yellow line is left–right (like the picture).\n2) Keep white on bottom, green in front.\n3) Do the alg (or Apply).",
  },
  L: {
    name: "L shape",
    alg: "f R U R' U' f'",
    how: "1) Turn only U until the yellow L matches the picture (back + left).\n2) Keep white on bottom, green in front.\n3) Do the alg (wide f).",
  },
  DOT: {
    name: "Dot",
    alg: "F R U R' U' F' f R U R' U' f'",
    how: "1) No yellow edges on top (only centre).\n2) Do the full alg once — you’ll get an L or line.\n3) Re-hint for the next picture.",
  },
};

export const OLL_FINISH = {
  SUNE: {
    name: "Sune",
    alg: "R U R' U R U2 R'",
    how: "1) Turn U until the yellow corners match the picture (fish).\n2) Headlights should sit on the LEFT.\n3) Do the alg.",
  },
  ANTISUNE: {
    name: "Antisune",
    alg: "R U2 R' U' R U' R'",
    how: "1) Turn U until the picture matches (mirror fish).\n2) Headlights on the RIGHT.\n3) Do the alg.",
  },
  H: {
    name: "H",
    alg: "R U R' U R U' R' U R U2 R'",
    how: "1) No yellow corners on top — only the cross.\n2) Turn U so opposite sides show headlights.\n3) Do the alg.",
  },
  PI: {
    name: "Pi",
    alg: "R U2 R2 U' R2 U' R2 U2 R",
    how: "1) No yellow corners on top.\n2) Turn U so headlights sit on two adjacent sides.\n3) Do the alg.",
  },
  T: {
    name: "T",
    alg: "r U R' U' r' F R F'",
    how: "1) Turn U until two adjacent yellow corners match the picture.\n2) Headlights facing you (FRONT).\n3) Do the alg (wide r).",
  },
  BOWTIE: {
    name: "Bowtie",
    alg: "F' r U R' U' r' F R",
    how: "1) Two adjacent yellow corners on top.\n2) Match the picture with U.\n3) Do the alg.",
  },
  HEADLIGHTS: {
    name: "Headlights",
    alg: "R2 D R' U2 R D' R' U2 R'",
    how: "1) Two opposite yellow corners on top.\n2) Turn U so headlights face you (FRONT).\n3) Do the alg.",
  },
};

const HOLD_NOTE =
  "White on bottom · green = F. Don’t orbit to follow the alg — only turn U to match the picture.";

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

function cornerYellowU(facelets) {
  return [0, 2, 8, 6].map((i) => sticker(facelets, "U", i) === "yellow");
}

function faceTopYellow(facelets, face) {
  return [sticker(facelets, face, 0) === "yellow", sticker(facelets, face, 2) === "yellow"];
}

function headlightsOn(facelets, face) {
  const [a, b] = faceTopYellow(facelets, face);
  return a && b;
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
    return hint(
      `Step 1 · ${c.name}`,
      c.how,
      c.alg,
      HOLD_NOTE,
      ollTopDiagram({ edges: [false, false, false, false], corners: [false, false, false, false] })
    );
  }

  const lineH = flags[1] && flags[3] && !flags[0] && !flags[2];
  const lineV = flags[0] && flags[2] && !flags[1] && !flags[3];
  if (lineH || lineV) {
    const prefix = lineV ? "U" : "";
    const c = OLL_CROSS.LINE;
    return hint(
      `Step 1 · ${c.name}`,
      c.how,
      withPrefix(prefix, c.alg),
      HOLD_NOTE,
      ollTopDiagram({ edges: [false, true, false, true], corners: [false, false, false, false] })
    );
  }

  const tmp = cloneFacelets(facelets);
  let prefix = "";
  for (let i = 0; i < 4; i++) {
    const e = edgeYellow(tmp);
    if (e[0] && e[3] && !e[1] && !e[2]) {
      prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      break;
    }
    applyMove(tmp, "U");
  }
  const c = OLL_CROSS.L;
  return hint(
    `Step 1 · ${c.name}`,
    c.how,
    withPrefix(prefix, c.alg),
    HOLD_NOTE,
    ollTopDiagram({ edges: [true, false, false, true], corners: [false, false, false, false] })
  );
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
    if (hlF && hlR) return "PI";
    return null;
  }
  if (n === 1) {
    if (hlL) return "SUNE";
    if (hlR) return "ANTISUNE";
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

function recogniseOcll(facelets) {
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    const key = matchOcllAt(tmp);
    if (key) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      return { key, prefix, corners: cornerYellowU(tmp), edges: edgeYellow(tmp) };
    }
    applyMove(tmp, "U");
  }
  return null;
}

function finishDiagram(key, corners, edges) {
  const patterns = {
    SUNE: { corners: [false, true, false, false], edges: [true, true, true, true] },
    ANTISUNE: { corners: [true, false, false, false], edges: [true, true, true, true] },
    H: { corners: [false, false, false, false], edges: [true, true, true, true] },
    PI: { corners: [false, false, false, false], edges: [true, true, true, true] },
    T: { corners: [true, true, false, false], edges: [true, true, true, true] },
    BOWTIE: { corners: [false, true, true, false], edges: [true, true, true, true] },
    HEADLIGHTS: { corners: [true, false, true, false], edges: [true, true, true, true] },
  };
  const p = patterns[key] || { corners, edges };
  return ollTopDiagram(p);
}

function finishHint(facelets) {
  const rec = recogniseOcll(facelets);
  if (!rec) {
    return hint(
      "Step 2 · Finish OLL",
      "Yellow cross is done. Turn only U and compare your top to the picture — then re-hint.",
      "U / U' / U2",
      HOLD_NOTE,
      ollTopDiagram({ edges: [true, true, true, true], corners: cornerYellowU(facelets) })
    );
  }
  const caseInfo = OLL_FINISH[rec.key];
  return hint(
    `Step 2 · ${caseInfo.name}`,
    caseInfo.how,
    withPrefix(rec.prefix, caseInfo.alg),
    HOLD_NOTE,
    finishDiagram(rec.key, rec.corners, rec.edges)
  );
}

export function analyzeOll(facelets) {
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
  const complete = yellowFaceDone(facelets);

  if (complete) {
    return {
      f2l: true,
      crossDone: true,
      complete: true,
      stage: "done",
      hint: hint(
        "OLL done",
        "Full yellow face. Open the PLL tab next — corners then edges.",
        "",
        ""
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

export const OLL_TIPS = [
  {
    title: "Practice order",
    body: "Cases go in a fixed list (Dot → L → Line → Sune…). Again = same case (new angle). Next case = move on.",
  },
  {
    title: "How to use a hint",
    body: "Match the picture with U turns only. White on bottom; green is always Front (F). Then run the alg — or tap Apply.",
  },
  {
    title: "Step 1 — Creating Cross",
    body: "Dot → L → line → cross. The picture shows which yellow edges should light up on top.",
  },
  {
    title: "Step 2 — Finish OLL",
    body: "Seven corner cases. Match yellow corners to the picture, then the alg.",
  },
  {
    title: "Don’t orbit for the alg",
    body: "Dragging around only changes the camera. F/R/L/B always mean cube faces with white on bottom.",
  },
  {
    title: "Source",
    body: "Algs from Cube Academy — https://www.cube.academy/2-look-oll-algs",
  },
];

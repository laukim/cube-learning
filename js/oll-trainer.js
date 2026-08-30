/**
 * Beginner OLL — only 2 algorithms
 * https://www.youtube.com/watch?v=x6EoaxxbImI
 *
 * Step 1: yellow cross with F R U R' U' F' (dot / L / line holds)
 * Step 2: finish corners with Sune only (repeat with correct holds)
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

/** Alg 1 — make the yellow cross */
export const OLL_CROSS_ALG = {
  name: "Cross",
  alg: "F R U R' U' F'",
  howDot:
    "1) No yellow edges on top (only centre).\n2) Do the cross alg once from any angle.\n3) Re-hint — you’ll get an L or a line.",
  howL:
    "1) Yellow L on top — turn U until the L sits back + left (see picture).\n2) Do the cross alg.\n3) You should get the yellow cross.",
  howLine:
    "1) Turn U until the yellow line is left–right (horizontal).\n2) Do the cross alg.\n3) Yellow cross done — then finish with Sune.",
};

/** Alg 2 — finish all corner cases by repeating Sune */
export const OLL_SUNE = {
  name: "Sune",
  alg: "R U R' U R U2 R'",
  howOne:
    "1) Exactly one yellow corner on top.\n2) Turn U so that corner sits at bottom-left (see picture).\n3) Do Sune. If yellow isn’t done, re-hint and Sune again.",
  howNone:
    "1) No yellow corners on top.\n2) Turn U so no yellow faces you on FRONT.\n3) Do Sune once → you’ll get one yellow corner. Re-hint.",
  howAdj:
    "1) Two adjacent yellow corners on top.\n2) Turn U so both sit on the RIGHT.\n3) Do Sune once → reduces to a 1-corner (or 0) case. Re-hint.",
  howOpp:
    "1) Two opposite yellow corners on top.\n2) Turn U so they sit top-left + bottom-right (see picture).\n3) Do Sune once → reduces. Re-hint.",
};

const HOLD_NOTE =
  "White on bottom. Match the picture with U only — looking around is not a y until you turn from that view.";

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

function faceTopYellow(facelets, face) {
  return [sticker(facelets, face, 0) === "yellow", sticker(facelets, face, 2) === "yellow"];
}

function withPrefix(prefix, alg) {
  return prefix ? `${prefix} ${alg}` : alg;
}

function crossShapeHint(facelets) {
  const flags = edgeYellow(facelets);
  const n = flags.filter(Boolean).length;
  const c = OLL_CROSS_ALG;

  if (n === 4) return null;

  if (n === 0) {
    return hint(
      `Step 1 · ${c.name} · Dot`,
      c.howDot,
      c.alg,
      HOLD_NOTE,
      ollTopDiagram({ edges: [false, false, false, false], corners: [false, false, false, false] })
    );
  }

  const lineH = flags[1] && flags[3] && !flags[0] && !flags[2];
  const lineV = flags[0] && flags[2] && !flags[1] && !flags[3];
  if (lineH || lineV) {
    const prefix = lineV ? "U" : "";
    return hint(
      `Step 1 · ${c.name} · Line`,
      c.howLine,
      withPrefix(prefix, c.alg),
      HOLD_NOTE,
      ollTopDiagram({ edges: [false, true, false, true], corners: [false, false, false, false] })
    );
  }

  // L shape — hold back + left
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
  return hint(
    `Step 1 · ${c.name} · L`,
    c.howL,
    withPrefix(prefix, c.alg),
    HOLD_NOTE,
    ollTopDiagram({ edges: [true, false, false, true], corners: [false, false, false, false] })
  );
}

/** No yellow stickers on the front face’s top row (video: “yellow not facing front”). */
function noYellowFacingFront(facelets) {
  const [a, b] = faceTopYellow(facelets, "F");
  return !a && !b;
}

/**
 * Beginner finish: only Sune, with holds from the video.
 * corners: [UBL, UBR, UFR, UFL]
 */
function finishHint(facelets) {
  const corners = cornerYellowU(facelets);
  const n = corners.filter(Boolean).length;
  const edges = [true, true, true, true];
  const s = OLL_SUNE;

  if (n === 1) {
    // Yellow corner at UFL (bottom-left of top view)
    const tmp = cloneFacelets(facelets);
    let prefix = "";
    for (let i = 0; i < 4; i++) {
      const c = cornerYellowU(tmp);
      if (c[3] && !c[0] && !c[1] && !c[2]) {
        prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        break;
      }
      applyMove(tmp, "U");
    }
    return hint(
      `Step 2 · ${s.name}`,
      s.howOne,
      withPrefix(prefix, s.alg),
      HOLD_NOTE,
      ollTopDiagram({ edges, corners: [false, false, false, true] })
    );
  }

  if (n === 0) {
    const tmp = cloneFacelets(facelets);
    let prefix = "";
    for (let i = 0; i < 4; i++) {
      if (noYellowFacingFront(tmp)) {
        prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        break;
      }
      applyMove(tmp, "U");
    }
    return hint(
      `Step 2 · ${s.name}`,
      s.howNone,
      withPrefix(prefix, s.alg),
      HOLD_NOTE,
      ollTopDiagram({ edges, corners: [false, false, false, false] })
    );
  }

  if (n === 2) {
    const opp = (corners[0] && corners[2] && !corners[1] && !corners[3]) ||
      (corners[1] && corners[3] && !corners[0] && !corners[2]);

    if (opp) {
      // Top-left + bottom-right = UBL + UFR
      const tmp = cloneFacelets(facelets);
      let prefix = "";
      for (let i = 0; i < 4; i++) {
        const c = cornerYellowU(tmp);
        if (c[0] && c[2] && !c[1] && !c[3]) {
          prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
          break;
        }
        applyMove(tmp, "U");
      }
      return hint(
        `Step 2 · ${s.name}`,
        s.howOpp,
        withPrefix(prefix, s.alg),
        HOLD_NOTE,
        ollTopDiagram({ edges, corners: [true, false, true, false] })
      );
    }

    // Adjacent — both on the RIGHT = UBR + UFR
    const tmp = cloneFacelets(facelets);
    let prefix = "";
    for (let i = 0; i < 4; i++) {
      const c = cornerYellowU(tmp);
      if (c[1] && c[2] && !c[0] && !c[3]) {
        prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        break;
      }
      applyMove(tmp, "U");
    }
    return hint(
      `Step 2 · ${s.name}`,
      s.howAdj,
      withPrefix(prefix, s.alg),
      HOLD_NOTE,
      ollTopDiagram({ edges, corners: [false, true, true, false] })
    );
  }

  // n === 3 — rare mid-path; treat like keep Suning from a 1-corner style hold
  return hint(
    `Step 2 · ${s.name}`,
    "Three yellow corners up — turn U so the unoriented corner’s tips look familiar, then Sune (or Undo and re-hint).",
    s.alg,
    HOLD_NOTE,
    ollTopDiagram({ edges, corners })
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
        "Beginner OLL needs F2L done. Tap Again / Next case for a scramble that keeps F2L solved.",
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
        "Full yellow face. Open the PLL tab — T-perm then U-perm.",
        "",
        "Beginner OLL · 2 algs"
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
 * Fixed beginner OLL practice order — not random.
 * Cross shapes, then Sune reduction holds.
 */
export const OLL_DRILL_CASES = [
  {
    id: "dot",
    name: "Dot",
    setup: () => invertAlg(`${OLL_CROSS_ALG.alg} f R U R' U' f'`),
  },
  {
    id: "l",
    name: "L shape",
    setup: () => `${invertAlg(OLL_CROSS_ALG.alg)} ${invertAlg(OLL_CROSS_ALG.alg)}`,
  },
  {
    id: "line",
    name: "Line",
    setup: () => invertAlg(OLL_CROSS_ALG.alg),
  },
  { id: "sune", name: "Sune · 1 corner", setup: () => invertAlg(OLL_SUNE.alg) },
  { id: "sune-0", name: "Sune · 0 corners", setup: () => invertAlg("R U R' U R U' R' U R U2 R'") },
  { id: "sune-adj", name: "Sune · 2 adjacent", setup: () => invertAlg("r U R' U' r' F R F'") },
  { id: "sune-opp", name: "Sune · 2 opposite", setup: () => invertAlg("R2 D R' U2 R D' R' U2 R'") },
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
 * @param {'again' | 'next'} mode
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

  const setup = expandWideAlg(c.setup());
  applyAlg(facelets, setup);
  const auf = randomAuf();
  if (auf) applyAlg(facelets, auf);

  return (auf ? [setup, auf] : [setup]).join(" ");
}

export const OLL_TIPS = [
  {
    title: "Only 2 algorithms",
    body: "Cross = F R U R' U' F'. Finish = Sune (R U R' U R U2 R'). Hold correctly and repeat — same idea as beginner PLL.",
  },
  {
    title: "Step 1 — Cross",
    body: "Dot → alg anywhere. L → L at back-left → alg. Line → horizontal → alg.",
  },
  {
    title: "Step 2 — Sune only",
    body: "1 corner → bottom-left. 0 corners → no yellow on front. 2 adjacent → on the right. 2 opposite → top-left + bottom-right. Then Sune; re-hint until done.",
  },
  {
    title: "Practice order",
    body: "Again = same case. Next OLL = next hold in the list. Later you can learn full 2-look OLL (more algs, fewer repeats).",
  },
  {
    title: "Looking around is not y",
    body: "Drag around the cube to peek. That only moves the camera. If you start turning faces while another colour is in front, that becomes a real y.",
  },
  {
    title: "Source",
    body: "Beginner OLL (2 algs) — https://www.youtube.com/watch?v=x6EoaxxbImI",
  },
];

/** @deprecated aliases for older imports / alg library */
export const OLL_CROSS = {
  LINE: { name: "Line", alg: OLL_CROSS_ALG.alg, how: OLL_CROSS_ALG.howLine },
  L: { name: "L shape", alg: OLL_CROSS_ALG.alg, how: OLL_CROSS_ALG.howL },
  DOT: { name: "Dot", alg: OLL_CROSS_ALG.alg, how: OLL_CROSS_ALG.howDot },
};
export const OLL_FINISH = {
  SUNE: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howOne },
  ANTISUNE: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howOne },
  H: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howNone },
  PI: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howNone },
  T: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howAdj },
  BOWTIE: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howAdj },
  HEADLIGHTS: { name: "Sune", alg: OLL_SUNE.alg, how: OLL_SUNE.howOpp },
};

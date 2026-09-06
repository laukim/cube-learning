/**
 * CubeHead 2-look PLL — 6 algs.
 * https://www.cube.academy/2-look-pll-algs
 *
 * Step 1: corners — T-perm (headlights on LEFT) or Y-perm (no headlights)
 * Step 2: edges — Ua, Ub, H, or Z
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  COLORS,
  getFace,
  isSolved,
  LL,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { f2lComplete } from "./f2l-trainer.js?v=conn1";
import { expandWideAlg, invertAlg } from "./alg.js";
import { pllEdgesDiagram, pllHeadlightsDiagram } from "./case-diagram.js";

export { expandWideAlg };

export const PLL_T = {
  name: "T-perm",
  alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
  howHeadlights:
    "1) Find headlights (two matching colours on one side).\n2) Turn only U until that pair sits on the LEFT (see picture).\n3) Do the full T-perm — mid-way F2L looks broken; finish every move.",
};

export const PLL_Y = {
  name: "Y-perm",
  alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  how: "1) No headlights — corners need a diagonal swap.\n2) Turn U until this hint’s alg works (U is included if needed).\n3) Do the full Y-perm. Mid-way F2L looks broken; finish every move.",
};

export const PLL_U = {
  name: "Ua-perm",
  alg: "R2 U' R' U' R U R U R U' R",
  algMirror: "R' U R' U' R' U' R' U R U R2",
  howBar:
    "1) One side already solved (full bar).\n2) Turn only U so that bar sits at the BACK.\n3) Do Ua. Front edge going left → Ub instead.",
};

export const PLL_UB = {
  name: "Ub-perm",
  alg: "R' U R' U' R' U' R' U R U R2",
  how: "Bar at BACK. Front edge goes left. Ub-perm.",
};

export const PLL_H = {
  name: "H-perm",
  alg: "M2 U' M2 U2 M2 U' M2",
  how: "Corners done, no edges solved (all four opposite). H-perm — M follows L. Use M / M' / M2 on the pad.",
};

export const PLL_Z = {
  name: "Z-perm",
  alg: "M' U' M2 U' M2 U' M' U2 M2",
  how: "Two opposite sides already solved. Hold those bars LEFT and RIGHT, then Z-perm (M moves).",
};

function randomAuf() {
  return ["", "U", "U'", "U2"][Math.floor(Math.random() * 4)];
}

/**
 * Fixed PLL practice order — not random.
 */
export const PLL_DRILL_CASES = [
  { id: "t", name: "T-perm · headlights", setup: () => invertAlg(PLL_T.alg) },
  { id: "y", name: "Y-perm · no headlights", setup: () => invertAlg(PLL_Y.alg) },
  { id: "ua", name: "Ua-perm", setup: () => invertAlg(PLL_U.alg) },
  { id: "ub", name: "Ub-perm", setup: () => invertAlg(PLL_UB.alg) },
  { id: "h", name: "H-perm", setup: () => invertAlg(PLL_H.alg) },
  { id: "z", name: "Z-perm", setup: () => invertAlg(PLL_Z.alg) },
];

let pllDrillIndex = 0;
let pllDrillStarted = false;

export function getPllDrillInfo() {
  const n = PLL_DRILL_CASES.length;
  const i = ((pllDrillIndex % n) + n) % n;
  const c = PLL_DRILL_CASES[i];
  return { index: i, total: n, id: c.id, name: c.name };
}

const HOLD_NOTE =
  "White on bottom · blue = F. Match the picture with U only — don’t orbit to follow F/R.";

function hint(title, copy, alg, note = "", diagram = null) {
  return { title, copy, alg, note, diagram };
}

function faceCenter(face) {
  return COLORS[face];
}

function yellowFaceDone(facelets) {
  return getFace(facelets, "U").every((c) => c === "yellow");
}

/** Corner seats: 0 UBL, 1 UBR, 2 UFR, 3 UFL — absolute correct colours. */
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

function cornersSolved(facelets) {
  return [0, 1, 2, 3].every((i) => cornerSeated(facelets, i));
}

/** Edge solved: 0 UB, 1 UR, 2 UF, 3 UL */
function edgeSolved(facelets, edgeIndex) {
  const sideFace = ["B", "R", "F", "L"][edgeIndex];
  const uIdx = LL.U_EDGES[edgeIndex];
  const side = LL.EDGE_SIDES[edgeIndex];
  return sticker(facelets, "U", uIdx) === "yellow" && sticker(facelets, side.face, side.i) === faceCenter(sideFace);
}

function edgesSolved(facelets) {
  return [0, 1, 2, 3].every((i) => edgeSolved(facelets, i));
}

function edgeSideColor(facelets, edgeIndex) {
  const side = LL.EDGE_SIDES[edgeIndex];
  return sticker(facelets, side.face, side.i);
}

/** Headlights: both top corner stickers on a side face are the same colour. */
function headlightsOn(facelets, face) {
  const a = sticker(facelets, face, 0);
  const b = sticker(facelets, face, 2);
  return a === b && a !== "yellow";
}

function withPrefix(prefix, alg) {
  return prefix ? `${prefix} ${alg}` : alg;
}

function prefixAt(i) {
  return i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
}

function solvedUpToAuf(facelets) {
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    if (isSolved(tmp)) return true;
    applyMove(tmp, "U");
  }
  return false;
}

function cornersSolvedUpToAuf(facelets) {
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    if (cornersSolved(tmp)) return true;
    applyMove(tmp, "U");
  }
  return false;
}

function findHold(facelets, alg, ok) {
  for (let i = 0; i < 4; i++) {
    const prefix = prefixAt(i);
    const held = cloneFacelets(facelets);
    if (prefix) applyAlg(held, prefix);
    const after = cloneFacelets(held);
    applyAlg(after, expandWideAlg(alg));
    if (ok(after)) return { prefix, held };
  }
  return null;
}

function cornersHint(facelets) {
  for (let i = 0; i < 4; i++) {
    const tmp = cloneFacelets(facelets);
    for (let t = 0; t < i; t++) applyMove(tmp, "U");
    if (headlightsOn(tmp, "L")) {
      return hint(
        `Step 1 · ${PLL_T.name}`,
        PLL_T.howHeadlights,
        withPrefix(prefixAt(i), PLL_T.alg),
        HOLD_NOTE,
        pllHeadlightsDiagram(true)
      );
    }
  }

  const anyHl = ["L", "B", "R", "F"].some((f) => headlightsOn(facelets, f));
  if (!anyHl) {
    const hit = findHold(facelets, PLL_Y.alg, cornersSolvedUpToAuf);
    return hint(
      `Step 1 · ${PLL_Y.name}`,
      PLL_Y.how,
      withPrefix(hit?.prefix || "", PLL_Y.alg),
      HOLD_NOTE,
      pllHeadlightsDiagram(false)
    );
  }

  return hint(
    `Step 1 · ${PLL_T.name}`,
    PLL_T.howHeadlights,
    `U …  ${PLL_T.alg}`,
    HOLD_NOTE,
    pllHeadlightsDiagram(true)
  );
}

/** Full bar on a side: both corners + edge same colour (beginner “solid bar”). */
function sideBarColor(facelets, face) {
  const edgeIndex = { B: 0, R: 1, F: 2, L: 3 }[face];
  if (edgeIndex == null) return null;
  const c0 = sticker(facelets, face, 0);
  const c2 = sticker(facelets, face, 2);
  const ec = edgeSideColor(facelets, edgeIndex);
  if (c0 === c2 && c0 === ec && c0 !== "yellow") return c0;
  return null;
}

function barCount(facelets) {
  return ["B", "R", "F", "L"].filter((f) => sideBarColor(facelets, f)).length;
}

/**
 * Edges: Ua / Ub (one bar at BACK), Z (two opposite bars), or H (none).
 */
function edgesHint(facelets) {
  if (edgesSolved(facelets)) {
    return hint("PLL done", "Cube solved (or AUF only).", "", "2-look PLL · 6 algs");
  }

  const nBars = barCount(facelets);

  if (nBars === 1) {
    for (let i = 0; i < 4; i++) {
      const tmp = cloneFacelets(facelets);
      for (let t = 0; t < i; t++) applyMove(tmp, "U");
      if (!sideBarColor(tmp, "B")) continue;

      const prefix = prefixAt(i);
      const frontColor = edgeSideColor(tmp, 2);
      const useMirror = frontColor === faceCenter("L");
      const alg = useMirror ? PLL_UB.alg : PLL_U.alg;
      const name = useMirror ? PLL_UB.name : PLL_U.name;
      const copy = useMirror ? PLL_UB.how : PLL_U.howBar;
      return hint(
        `Step 2 · ${name}`,
        copy,
        withPrefix(prefix, alg),
        HOLD_NOTE,
        pllEdgesDiagram(useMirror ? "UB" : "UA")
      );
    }
  }

  if (nBars >= 2) {
    const zHit = findHold(facelets, PLL_Z.alg, solvedUpToAuf);
    if (zHit) {
      return hint(
        `Step 2 · ${PLL_Z.name}`,
        PLL_Z.how,
        withPrefix(zHit.prefix, PLL_Z.alg),
        HOLD_NOTE,
        pllEdgesDiagram("Z")
      );
    }
  }

  const hHit = findHold(facelets, PLL_H.alg, solvedUpToAuf);
  if (hHit) {
    return hint(
      `Step 2 · ${PLL_H.name}`,
      PLL_H.how,
      withPrefix(hHit.prefix, PLL_H.alg),
      HOLD_NOTE,
      pllEdgesDiagram("H")
    );
  }

  const zHit = findHold(facelets, PLL_Z.alg, solvedUpToAuf);
  if (zHit) {
    return hint(
      `Step 2 · ${PLL_Z.name}`,
      PLL_Z.how,
      withPrefix(zHit.prefix, PLL_Z.alg),
      HOLD_NOTE,
      pllEdgesDiagram("Z")
    );
  }

  return hint(
    "Step 2 · PLL",
    "Couldn’t name this edge case. Undo, turn U, and tap PLL hint again.",
    "",
    HOLD_NOTE,
    pllEdgesDiagram("H")
  );
}

export function analyzePll(facelets) {
  if (!f2lComplete(facelets)) {
    return {
      f2l: false,
      oll: false,
      cornersDone: false,
      complete: false,
      stage: "need-f2l",
      hint: hint(
        "F2L first",
        "2-look PLL needs F2L done and a full yellow face (OLL). Tap Again / Next case for a scramble that keeps F2L + OLL solved.",
        "",
        ""
      ),
    };
  }

  if (!yellowFaceDone(facelets)) {
    return {
      f2l: true,
      oll: false,
      cornersDone: false,
      complete: false,
      stage: "need-oll",
      hint: hint(
        "OLL first",
        "Yellow face isn’t done yet. Finish OLL (or tap Again / Next case for an oriented last-layer scramble).",
        "",
        "PLL preserves orientation — do OLL before PLL."
      ),
    };
  }

  if (isSolved(facelets) || (cornersSolved(facelets) && edgesSolved(facelets))) {
    return {
      f2l: true,
      oll: true,
      cornersDone: true,
      complete: true,
      stage: "done",
      hint: hint(
        "PLL done",
        "Cube solved. New PLL to drill again.",
        "",
        "2-look PLL · 6 algs"
      ),
    };
  }

  const cornerTmp = cloneFacelets(facelets);
  let cornersOk = false;
  let aufCorners = "";
  for (let i = 0; i < 4; i++) {
    if (cornersSolved(cornerTmp)) {
      cornersOk = true;
      aufCorners = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      break;
    }
    applyMove(cornerTmp, "U");
  }

  if (!cornersOk) {
    return {
      f2l: true,
      oll: true,
      cornersDone: false,
      complete: false,
      stage: "corners",
      hint: cornersHint(facelets),
    };
  }

  // Corners can be AUF'd into place — edge hint from *current* hold (one U-setup only).
  if (edgesSolved(facelets)) {
    return {
      f2l: true,
      oll: true,
      cornersDone: true,
      complete: true,
      stage: "done",
      hint: hint(
        "AUF",
        aufCorners
          ? `Edges are done — turn U to finish: ${aufCorners}`
          : "Solved.",
        aufCorners,
        ""
      ),
    };
  }

  const edgeH = edgesHint(facelets);
  return {
    f2l: true,
    oll: true,
    cornersDone: true,
    complete: false,
    stage: "edges",
    hint: edgeH,
  };
}

/** Scramble PLL — fixed case order (Again / Next). */
export function scramblePll(facelets, mode = "next") {
  const n = PLL_DRILL_CASES.length;
  if (!pllDrillStarted) {
    pllDrillStarted = true;
    pllDrillIndex = 0;
  } else if (mode === "next") {
    pllDrillIndex = (pllDrillIndex + 1) % n;
  }

  const c = PLL_DRILL_CASES[((pllDrillIndex % n) + n) % n];
  const s = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = s[i];

  const setup = expandWideAlg(c.setup());
  applyAlg(facelets, setup);
  const auf = randomAuf();
  if (auf) applyAlg(facelets, auf);

  return (auf ? [setup, auf] : [setup]).join(" ");
}

export const PLL_TIPS = [
  {
    title: "Practice order",
    body: "T (headlights) → Y (no headlights) → Ua → Ub → H → Z. Again = same case. Next PLL = move on.",
  },
  {
    title: "6 algorithms",
    body: "Corners: T-perm if headlights, Y-perm if not. Edges: Ua or Ub with the bar at back; H if none solved; Z if two opposite sides are done.",
  },
  {
    title: "Step 1 — Corners",
    body: "Headlights → hold on the LEFT → T-perm. No headlights → Y-perm (the longer alg).",
  },
  {
    title: "Step 2 — Edges",
    body: "One bar → back → Ua (or Ub if the front edge goes left). Two opposite bars → Z. No bars → H. H and Z use M — tap PLL hint and the next M / M' / M2 lights up on the pad.",
  },
  {
    title: "Algs break F2L mid-way",
    body: "The first R or F messes up F2L on purpose. Finish every move — F2L comes back. Or use Apply / Undo.",
  },
  {
    title: "Don’t orbit for the alg",
    body: "Dragging around only changes the camera. Flick the sticker you mean — F/R/L/B are the cube’s faces, not whatever colour is toward you.",
  },
  {
    title: "Source",
    body: "CubeHead 2-look PLL — https://www.cube.academy/2-look-pll-algs",
  },
];

/** @deprecated aliases kept for any old imports */
export const PLL_CORNERS = {
  HEADLIGHTS: { name: PLL_T.name, alg: PLL_T.alg, how: PLL_T.howHeadlights },
  NO_HEADLIGHTS: { name: PLL_Y.name, alg: PLL_Y.alg, how: PLL_Y.how },
};
export const PLL_EDGES = {
  UA: { name: PLL_U.name, alg: PLL_U.alg, how: PLL_U.howBar },
  UB: { name: PLL_UB.name, alg: PLL_UB.alg, how: PLL_UB.how },
  H: { name: PLL_H.name, alg: PLL_H.alg, how: PLL_H.how },
  Z: { name: PLL_Z.name, alg: PLL_Z.alg, how: PLL_Z.how },
};

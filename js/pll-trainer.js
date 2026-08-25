/**
 * Beginner PLL — only 2 algorithms (T-perm + U-perm)
 * Method from: https://www.youtube.com/watch?v=RCPVu112HKg
 *
 * Step 1: corners with T-perm (headlights on LEFT)
 * Step 2: edges with U-perm (bar at BACK); no bar → U-perm once to create one
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
import { f2lComplete } from "./f2l-trainer.js";
import { expandWideAlg } from "./oll-trainer.js";
import { pllEdgesDiagram, pllHeadlightsDiagram } from "./case-diagram.js";

export { expandWideAlg };

/** The only corner alg — T-perm */
export const PLL_T = {
  name: "T-perm",
  alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
  howHeadlights:
    "1) Find headlights (two matching colours on one side).\n2) Turn only U until that pair sits on the LEFT (see picture).\n3) Do the full T-perm — mid-way F2L looks broken; finish every move.",
  howNone:
    "1) No headlights on any side.\n2) Hold any way and do T-perm once.\n3) Re-hint — you should get headlights; put them on the LEFT and T-perm again.",
};

/**
 * The only edge alg taught in the video — Ua.
 * Mirror (Ub) shown only when the bar needs the other cycle.
 */
export const PLL_U = {
  name: "U-perm",
  alg: "R2 U' R' U' R U R U R U' R",
  algMirror: "R' U R' U' R' U' R' U R U R2",
  howBar:
    "1) One side already solved (full bar).\n2) Turn only U so that bar sits at the BACK.\n3) Do U-perm. If still wrong, Undo and try the mirror (other direction).",
  howNone:
    "1) No solid bar yet.\n2) Do U-perm once from any angle.\n3) Re-hint — put the new bar at the BACK and U-perm again.",
};

const HOLD_NOTE =
  "White on bottom · green = F. Match the picture with U only — don’t orbit to follow F/R.";

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

function cornersHint(facelets) {
  // Prefer headlights on LEFT (video hold for T-perm)
  for (let i = 0; i < 4; i++) {
    const tmp = cloneFacelets(facelets);
    for (let t = 0; t < i; t++) applyMove(tmp, "U");
    if (headlightsOn(tmp, "L")) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      return hint(
        `Step 1 · ${PLL_T.name}`,
        PLL_T.howHeadlights,
        withPrefix(prefix, PLL_T.alg),
        HOLD_NOTE,
        pllHeadlightsDiagram(true)
      );
    }
  }

  const faces = ["L", "B", "R", "F"];
  const anyHl = faces.some((f) => headlightsOn(facelets, f));
  if (!anyHl) {
    return hint(
      `Step 1 · ${PLL_T.name}`,
      PLL_T.howNone,
      PLL_T.alg,
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

function anyFullBar(facelets) {
  return ["B", "R", "F", "L"].some((f) => sideBarColor(facelets, f));
}

/**
 * Edges: U-perm only. One AUF so the solid bar sits at BACK — never stack a
 * separate “align corners” U on top (that produced confusing U2 U2 … hints).
 */
function edgesHint(facelets) {
  if (edgesSolved(facelets)) {
    return hint("PLL done", "Cube solved (or AUF only).", "", "Beginner PLL · T-perm + U-perm");
  }

  // Prefer: U until a full bar is on BACK, then U-perm
  for (let i = 0; i < 4; i++) {
    const tmp = cloneFacelets(facelets);
    for (let t = 0; t < i; t++) applyMove(tmp, "U");
    if (!sideBarColor(tmp, "B")) continue;

    const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
    const frontColor = edgeSideColor(tmp, 2);
    // Mirror when front edge wants to go to L
    const useMirror = frontColor === faceCenter("L");
    const alg = useMirror ? PLL_U.algMirror : PLL_U.alg;
    const copy = useMirror
      ? `${PLL_U.howBar}\n(This case needs the mirror U-perm.)`
      : PLL_U.howBar;
    return hint(
      `Step 2 · ${PLL_U.name}`,
      copy,
      withPrefix(prefix, alg),
      HOLD_NOTE,
      pllEdgesDiagram("UA")
    );
  }

  if (!anyFullBar(facelets)) {
    return hint(
      `Step 2 · ${PLL_U.name}`,
      PLL_U.howNone,
      PLL_U.alg,
      HOLD_NOTE,
      pllEdgesDiagram("UA")
    );
  }

  // Bar exists but not yet dialed to back — tell them to U
  return hint(
    `Step 2 · ${PLL_U.name}`,
    PLL_U.howBar,
    `U …  ${PLL_U.alg}`,
    HOLD_NOTE,
    pllEdgesDiagram("UA")
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
        "Beginner PLL needs F2L done and a full yellow face (OLL). Tap New PLL for a scramble that keeps F2L + OLL solved.",
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
        "Yellow face isn’t done yet. Finish OLL (or tap New PLL for an oriented last-layer scramble).",
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
        "Beginner PLL · T-perm + U-perm"
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

/** Scramble PLL only — F2L + yellow face stay solved. */
export function scramblePll(facelets) {
  const s = solvedFacelets();
  const pool = [PLL_T.alg, PLL_U.alg, PLL_U.algMirror, "U", "U'", "U2"];
  const parts = [];
  for (let attempt = 0; attempt < 48; attempt++) {
    for (let i = 0; i < 54; i++) facelets[i] = s[i];
    parts.length = 0;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      const expanded = expandWideAlg(pick);
      applyAlg(facelets, expanded);
      parts.push(expanded);
      const auf = ["U", "U'", "U2"][Math.floor(Math.random() * 3)];
      applyAlg(facelets, auf);
      parts.push(auf);
    }
    if (f2lComplete(facelets) && yellowFaceDone(facelets) && !isSolved(facelets)) {
      const check = analyzePll(facelets);
      if (check.stage === "corners" || check.stage === "edges") {
        return parts.join(" ");
      }
    }
  }

  for (let i = 0; i < 54; i++) facelets[i] = s[i];
  const fallback = [PLL_T.alg, "U", PLL_U.alg].join(" ");
  applyAlg(facelets, fallback);
  return fallback;
}

export const PLL_TIPS = [
  {
    title: "Only 2 algorithms",
    body: "T-perm for corners, U-perm for edges. You may need each more than once — that’s the beginner method.",
  },
  {
    title: "Step 1 — Corners (T-perm)",
    body: "Headlights → hold on the LEFT → T-perm. No headlights → T-perm from anywhere, then headlights appear.",
  },
  {
    title: "Step 2 — Edges (U-perm)",
    body: "Solid bar → bar at BACK → U-perm. No bar → U-perm once, then put the new bar at back and U-perm again.",
  },
  {
    title: "Algs break F2L mid-way",
    body: "The first R or F messes up the first two layers on purpose. Finish every move — F2L comes back. Or use Apply / Undo.",
  },
  {
    title: "Don’t orbit for the alg",
    body: "Dragging around only changes the camera. F/R/L/B always mean cube faces with white on bottom.",
  },
  {
    title: "Source",
    body: "Beginner PLL (2 algs) — https://www.youtube.com/watch?v=RCPVu112HKg",
  },
];

/** @deprecated aliases kept for any old imports */
export const PLL_CORNERS = {
  HEADLIGHTS: { name: PLL_T.name, alg: PLL_T.alg, how: PLL_T.howHeadlights },
  NO_HEADLIGHTS: { name: PLL_T.name, alg: PLL_T.alg, how: PLL_T.howNone },
};
export const PLL_EDGES = {
  UA: { name: PLL_U.name, alg: PLL_U.alg, how: PLL_U.howBar },
  UB: { name: PLL_U.name, alg: PLL_U.algMirror, how: PLL_U.howBar },
};

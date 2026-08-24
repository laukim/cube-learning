/**
 * 2-look PLL drill — Cube Academy algs
 * https://www.cube.academy/2-look-pll-algs
 *
 * Step 1: solve corners (headlights / no headlights)
 * Step 2: finish edges (Ua, Ub, H, Z)
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

export { expandWideAlg };

/** Cube Academy · Solving Corners */
export const PLL_CORNERS = {
  NO_HEADLIGHTS: {
    name: "No headlights",
    alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    hold: "No matching corner pair on any side. Do this once — then you should get headlights.",
  },
  HEADLIGHTS: {
    name: "Headlights",
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    hold: "Hold the matching headlights at the back, then this alg.",
  },
};

/** Cube Academy · Finish PLL (edges) */
export const PLL_EDGES = {
  UA: {
    name: "Ua perm",
    alg: "R2 U' R' U' R U R U R U' R",
    hold: "One solved edge at the back (bar). Edges cycle one way.",
  },
  UB: {
    name: "Ub perm",
    alg: "R' U R' U' R' U' R' U R U R2",
    hold: "One solved edge at the back (bar). Edges cycle the other way — this is your fast U-perm style.",
  },
  H: {
    name: "H perm",
    alg: "M2 U' M2 U2 M2 U' M2",
    hold: "No edges solved — opposite edges need swapping.",
  },
  Z: {
    name: "Z perm",
    alg: "M' U' M2 U' M2 U' M' U2 M2",
    hold: "No edges solved — adjacent (Z) edge swaps.",
  },
};

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
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
  // Prefer headlights at back (B)
  const faces = ["B", "R", "F", "L"];
  for (let i = 0; i < 4; i++) {
    const tmp = cloneFacelets(facelets);
    for (let t = 0; t < i; t++) applyMove(tmp, "U");
    if (headlightsOn(tmp, "B")) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      const c = PLL_CORNERS.HEADLIGHTS;
      return hint(`Step 1 · ${c.name}`, c.hold, withPrefix(prefix, c.alg), "Cube Academy · Solving Corners");
    }
  }

  // Any headlights elsewhere → U until at back (already covered). None → Y-perm
  const anyHl = faces.some((f) => headlightsOn(facelets, f));
  if (!anyHl) {
    const c = PLL_CORNERS.NO_HEADLIGHTS;
    return hint(`Step 1 · ${c.name}`, c.hold, c.alg, "Cube Academy · Solving Corners. After this, look for headlights.");
  }

  // Headlights exist but AUF loop missed — generic
  const c = PLL_CORNERS.HEADLIGHTS;
  return hint(`Step 1 · ${c.name}`, "U-spin so headlights sit at the back, then the alg.", `U …  ${c.alg}`, "Cube Academy · Solving Corners");
}

/**
 * After corners solved: recognise edge PLL.
 * Hold: if one edge solved, put it at back for Ua/Ub.
 */
function edgesHint(facelets) {
  const solvedFlags = [0, 1, 2, 3].map((i) => edgeSolved(facelets, i));
  const n = solvedFlags.filter(Boolean).length;

  if (n === 4) {
    return hint("PLL done", "Cube solved (or AUF only).", "", "Cube Academy 2-look PLL complete.");
  }

  if (n === 1) {
    // Put solved edge at back (UB = index 0)
    const solvedIdx = solvedFlags.findIndex(Boolean);
    // How many U to bring solvedIdx to 0: solvedIdx steps of U' ... 
    // After U: UB←UL←UF←UR←UB, so edge at UR goes to UB with U, etc.
    // Positions after k times U: newIndex = (oldIndex - k + 4) % 4 if U cycles UB→UR→UF→UL→UB?
    // applyMove U: typically UF→UR→UB→UL. So position i goes to (i+1)%4 for [UB,UR,UF,UL]? 
    // LL.U_EDGES = [1,5,7,3] = UB, UR, UF, UL indices on U face.
    // Standard cubejs U: cycles edges. Safer: search AUF.
    let prefix = "";
    const tmp = cloneFacelets(facelets);
    for (let i = 0; i < 4; i++) {
      if (edgeSolved(tmp, 0)) {
        prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        // Decide Ua vs Ub: look at UF edge — which centre it belongs to
        const frontColor = edgeSideColor(tmp, 2); // UF
        // UF belongs on L → Ub; on R → Ua (common holds with bar at back)
        const pick = frontColor === faceCenter("L") ? "UB" : frontColor === faceCenter("R") ? "UA" : "UB";
        const caseInfo = PLL_EDGES[pick];
        return hint(
          `Step 2 · ${caseInfo.name}`,
          caseInfo.hold,
          withPrefix(prefix, caseInfo.alg),
          "Cube Academy · Finish PLL. Bar (solved edge) at back."
        );
      }
      applyMove(tmp, "U");
    }
    const e = PLL_EDGES.UB;
    return hint(`Step 2 · ${e.name}`, e.hold, e.alg, "Put the solved edge at the back, then Ub or Ua.");
  }

  // n === 0 or n === 2 (shouldn't be 2 for pure PLL edges after corners — treat as H/Z)
  // Distinguish H vs Z: after some AUF, check opposite vs adjacent mismatch pattern
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    // H: each edge's side colour is the opposite centre (F has B colour, etc.)
    const opp =
      edgeSideColor(tmp, 0) === faceCenter("F") &&
      edgeSideColor(tmp, 2) === faceCenter("B") &&
      edgeSideColor(tmp, 1) === faceCenter("L") &&
      edgeSideColor(tmp, 3) === faceCenter("R");
    // Soft H: opposites swapped
    const softH =
      (edgeSideColor(tmp, 0) === faceCenter("F") && edgeSideColor(tmp, 2) === faceCenter("B")) ||
      (edgeSideColor(tmp, 1) === faceCenter("L") && edgeSideColor(tmp, 3) === faceCenter("R"));

    if (opp || (softH && edgeSideColor(tmp, 0) === faceCenter("F"))) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      const e = PLL_EDGES.H;
      return hint(`Step 2 · ${e.name}`, e.hold, withPrefix(prefix, e.alg), "Cube Academy · Finish PLL");
    }

    // Z: adjacent swap look — F has R or L colour, and pattern is "skew"
    const zish =
      edgeSideColor(tmp, 2) === faceCenter("R") &&
      edgeSideColor(tmp, 1) === faceCenter("F") &&
      edgeSideColor(tmp, 0) === faceCenter("L") &&
      edgeSideColor(tmp, 3) === faceCenter("B");
    const zish2 =
      edgeSideColor(tmp, 2) === faceCenter("L") &&
      edgeSideColor(tmp, 3) === faceCenter("F") &&
      edgeSideColor(tmp, 0) === faceCenter("R") &&
      edgeSideColor(tmp, 1) === faceCenter("B");

    if (zish || zish2) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      const e = PLL_EDGES.Z;
      return hint(`Step 2 · ${e.name}`, e.hold, withPrefix(prefix, e.alg), "Cube Academy · Finish PLL");
    }
    applyMove(tmp, "U");
  }

  // Default: if no opposite swap signal → Z, else H
  const fHasOpp = edgeSideColor(facelets, 2) === faceCenter("B");
  const e = fHasOpp ? PLL_EDGES.H : PLL_EDGES.Z;
  return hint(
    `Step 2 · ${e.name}`,
    e.hold + " (if wrong, try the other — H vs Z).",
    e.alg,
    "Cube Academy · Finish PLL"
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
        "2-look PLL needs F2L done and a full yellow face (OLL). Tap New PLL for a scramble that keeps F2L + OLL solved.",
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
        "Yellow face isn’t done yet. Finish 2-look OLL (or tap New PLL for an oriented last-layer scramble).",
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
        "Cube Academy 2-look PLL · cube.academy/2-look-pll-algs"
      ),
    };
  }

  // Corners may be relatively solved but need AUF to match centres
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

  // Align corners to centres before edge hint
  const aligned = cloneFacelets(facelets);
  if (aufCorners) applyAlg(aligned, aufCorners);

  if (edgesSolved(aligned)) {
    return {
      f2l: true,
      oll: true,
      cornersDone: true,
      complete: true,
      stage: "done",
      hint: hint(
        "AUF",
        aufCorners
          ? `Corners and edges match — turn U to finish: ${aufCorners}`
          : "Solved.",
        aufCorners,
        ""
      ),
    };
  }

  const edgeH = edgesHint(aligned);
  return {
    f2l: true,
    oll: true,
    cornersDone: true,
    complete: false,
    stage: "edges",
    hint: aufCorners
      ? hint(edgeH.title, `First align corners: ${aufCorners}. Then: ${edgeH.copy}`, withPrefix(aufCorners, edgeH.alg), edgeH.note)
      : edgeH,
  };
}

/** Scramble PLL only — F2L + yellow face stay solved. */
export function scramblePll(facelets) {
  const s = solvedFacelets();
  const pool = [
    ...Object.values(PLL_CORNERS).map((c) => c.alg),
    ...Object.values(PLL_EDGES).map((c) => c.alg),
    "U",
    "U'",
    "U2",
  ];
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
  // Force a clear case: headlights corner alg + Ub edge alg
  const fallback = [PLL_CORNERS.NO_HEADLIGHTS.alg, "U", PLL_EDGES.UB.alg].join(" ");
  applyAlg(facelets, fallback);
  return fallback;
}

export const PLL_TIPS = [
  {
    title: "What 2-look PLL is",
    body: "After OLL (full yellow face): (1) put corners in the right seats, (2) put edges in the right seats — without flipping yellow. That finishes the cube.",
  },
  {
    title: "Step 1 — Solving Corners",
    body: "Look for headlights (two matching colours on one side). Have them → hold at back → Headlights alg. None → No-headlights alg once, then headlights appear.",
  },
  {
    title: "Step 2 — Finish PLL",
    body: "Ua / Ub when one edge is already solved (bar at back). H when opposites need swapping. Z for the skew adjacent swap. M moves = middle slice.",
  },
  {
    title: "With OLL",
    body: "OLL + PLL are a pair. Don’t use beginner Niklas / righty+D after OLL — those can twist corners again.",
  },
  {
    title: "Source",
    body: "Algs from Cube Academy 2 Look PLL — https://www.cube.academy/2-look-pll-algs",
  },
];

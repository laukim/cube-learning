import {
  applyAlg,
  applyMove,
  cloneFacelets,
  COLORS,
  FACES,
  getFace,
  isSolved,
  LL,
  sticker,
} from "./cube.js";

/** Your 7 beginner steps (white on bottom → yellow on top). */
export const STEPS = [
  {
    id: "white-cross",
    title: "White cross",
    blurb: "White + on the bottom, each edge matching its side centre.",
  },
  {
    id: "white-corners",
    title: "White corners",
    blurb: "Insert white corners with righty / lefty after matching the side colours.",
  },
  {
    id: "middle-edges",
    title: "Middle edges",
    blurb: "Insert the front-top edge into the front-right slot (U → righty → y′ → lefty).",
  },
  {
    id: "yellow-cross",
    title: "Yellow cross",
    blurb: "Dot / 9-o’clock L / line → F, righty, F′ (repeat).",
  },
  {
    id: "yellow-edges",
    title: "Place yellow edges",
    blurb: "Adjacent: good edges at left + back, then the U-perm. Opposite: same alg once → becomes adjacent.",
  },
  {
    id: "yellow-corners-place",
    title: "Place yellow corners",
    blurb: "Hold 1 correct corner (or do the alg from anywhere if zero), then Niklas.",
  },
  {
    id: "yellow-corners-orient",
    title: "Orient corners",
    blurb: "Flip white to top. Yellow on the right of a bottom corner → righty until fixed, then D (don’t turn the cube).",
  },
];

export const RIGHTY = "R U R' U'";
export const LEFTY = "L' U' L U";

export const ALG_LIBRARY = [
  {
    group: "Triggers",
    name: "Righty",
    when: "Default insert / twist trigger",
    alg: RIGHTY,
    tip: "R U R' U′ — muscle-memory #1.",
  },
  {
    group: "Triggers",
    name: "Lefty",
    when: "Mirror of righty",
    alg: LEFTY,
    tip: "L' U' L U — used after you y′ for middle-layer left inserts.",
  },
  {
    group: "1 · White cross",
    name: "Idea",
    when: "White on bottom",
    alg: "(intuitive)",
    tip: "Make a white + on D. Each white edge’s other colour must match the side centre (green edge above green centre, etc.).",
  },
  {
    group: "2 · White corners",
    name: "Righty insert",
    when: "Corner above its slot on the right",
    alg: RIGHTY,
    tip: "Match the two side colours of the white corner to the centres, park it on U above the slot, then righty (repeat until white faces down).",
  },
  {
    group: "2 · White corners",
    name: "Lefty insert",
    when: "Corner above its slot on the left",
    alg: LEFTY,
    tip: "Same idea from the left side.",
  },
  {
    group: "3 · Middle edges",
    name: "Insert to front-right",
    when: "Edge on U (no yellow) belongs in FR",
    alg: `U ${RIGHTY} y' ${LEFTY}`,
    tip: "Put the edge at front-top so it would go right. U (setup) → righty → rotate cube left (y′) → lefty. Mirror for left slots.",
  },
  {
    group: "4 · Yellow cross",
    name: "F righty F′",
    when: "Dot, 9-o’clock L, or line",
    alg: `F ${RIGHTY} F'`,
    tip: "Line: hold horizontal. L (9-o’clock): hold in back-left. Dot: do the alg → line → again → cross.",
  },
  {
    group: "5 · Yellow edges",
    name: "U-perm (your alg)",
    when: "Adjacent good edges at left + back",
    alg: "R' U R' U' R' U' R' U R U R2 U'",
    tip: "Opposite good edges: do this once from anywhere → they become adjacent, then hold left+back and repeat.",
  },
  {
    group: "6 · Place corners",
    name: "Niklas",
    when: "0 or 1 corner already in the right seat",
    alg: "R U' L' U R' U' L",
    tip: "If one corner is correct, hold it at front-left. If zero, do the alg once, then you’ll get one correct — hold it and repeat.",
  },
  {
    group: "7 · Orient corners",
    name: "Righty + D",
    when: "After flipping white to top",
    alg: `${RIGHTY} (repeat) then D`,
    tip: "x2 so white is on top. Look at a bottom corner: if yellow is on the right face of that corner, righty until yellow faces down. Then D only (don’t rotate the whole cube) and fix the next corner.",
  },
];

const SIDE_FACES = ["F", "R", "B", "L"];

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

function whiteCornersDone(facelets) {
  if (!getFace(facelets, "D").every((c) => c === "white")) return false;
  for (const face of SIDE_FACES) {
    const f = getFace(facelets, face);
    if (f[6] !== faceCenter(face) || f[8] !== faceCenter(face)) return false;
  }
  return true;
}

function middleLayerDone(facelets) {
  if (!whiteCornersDone(facelets)) return false;
  for (const face of SIDE_FACES) {
    const f = getFace(facelets, face);
    if (f[3] !== faceCenter(face) || f[5] !== faceCenter(face)) return false;
  }
  return true;
}

function yellowCrossDone(facelets) {
  const u = getFace(facelets, "U");
  return [1, 3, 5, 7].every((i) => u[i] === "yellow");
}

function yellowEdgePlaced(facelets, edgeIndex) {
  // 0 UB, 1 UR, 2 UF, 3 UL
  const sideFace = ["B", "R", "F", "L"][edgeIndex];
  const uIdx = LL.U_EDGES[edgeIndex];
  const side = LL.EDGE_SIDES[edgeIndex];
  return sticker(facelets, "U", uIdx) === "yellow" && sticker(facelets, side.face, side.i) === faceCenter(sideFace);
}

function yellowEdgesDone(facelets) {
  return [0, 1, 2, 3].every((i) => yellowEdgePlaced(facelets, i));
}

function cornerSeatColors(facelets, cornerIndex) {
  const uIdx = LL.U_CORNERS[cornerIndex];
  const sides = LL.CORNER_SIDES[cornerIndex];
  return [
    sticker(facelets, "U", uIdx),
    sticker(facelets, sides[0].face, sides[0].i),
    sticker(facelets, sides[1].face, sides[1].i),
  ];
}

function yellowCornerSeated(facelets, cornerIndex) {
  const sideFaces = [
    ["B", "L"],
    ["B", "R"],
    ["F", "R"],
    ["F", "L"],
  ][cornerIndex];
  const target = new Set(["yellow", faceCenter(sideFaces[0]), faceCenter(sideFaces[1])]);
  const have = new Set(cornerSeatColors(facelets, cornerIndex));
  return [...target].every((c) => have.has(c));
}

function yellowCornersSeated(facelets) {
  return [0, 1, 2, 3].every((i) => yellowCornerSeated(facelets, i));
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

function whiteCornersHint(facelets) {
  return hint(
    "Insert a white corner",
    "Find a white corner on the top layer. Twist U until its two side colours match the two centres below. Hold that corner above its slot, then righty (or lefty from the left).",
    RIGHTY,
    "Repeat righty until white faces down. If the corner is stuck in the bottom, righty once to pop it to U, then insert properly. Lefty: L' U' L U."
  );
}

function middleEdgesHint(facelets) {
  return hint(
    "Insert a middle edge",
    "Find an edge on U with no yellow. U-spin so it sits at front-top and belongs in the front-right slot. Then: U → righty → rotate the cube left (y′) → lefty.",
    `U ${RIGHTY} y' ${LEFTY}`,
    "For a left slot: mirror (U′ → lefty → y → righty). If the edge is already in the middle but wrong: pop it out with the same alg, then insert correctly."
  );
}

function yellowCrossHint(facelets) {
  const u = getFace(facelets, "U");
  const flags = LL.U_EDGES.map((i) => u[i] === "yellow"); // UB UR UF UL
  const n = flags.filter(Boolean).length;
  const alg = `F ${RIGHTY} F'`;

  if (n === 0) {
    return hint(
      "Dot",
      "No yellow edges on top yet. Do F, righty, F′ once → you should get a line (or L). Keep going.",
      alg,
      "After each alg, check: dot → line → L → cross."
    );
  }

  const lineH = flags[1] && flags[3] && !flags[0] && !flags[2];
  const lineV = flags[0] && flags[2] && !flags[1] && !flags[3];
  if (lineH || lineV) {
    const prefix = lineV ? "U" : "";
    return hint(
      "Line",
      "Hold the yellow line left–right (horizontal), then F, righty, F′.",
      prefix ? `${prefix} ${alg}` : alg,
      "Vertical line? U first so it becomes horizontal."
    );
  }

  // 9-o’clock L: adjacent pair — hold in back-left (UB + UL)
  const tmp = cloneFacelets(facelets);
  let prefix = "";
  for (let i = 0; i < 4; i++) {
    const f = LL.U_EDGES.map((idx) => getFace(tmp, "U")[idx] === "yellow");
    if (f[0] && f[3] && n === 2) {
      prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      break;
    }
    applyMove(tmp, "U");
  }
  return hint(
    "9-o’clock (L shape)",
    "Hold the yellow L in the back-left (like a 9 on a clock), then F, righty, F′.",
    prefix ? `${prefix} ${alg}` : alg,
    "The L should point toward back and left before you start."
  );
}

const EDGE_PERM_ALG = "R' U R' U' R' U' R' U R U R2 U'";

function yellowEdgesHint(facelets) {
  const placed = [0, 1, 2, 3].map((i) => yellowEdgePlaced(facelets, i));
  const n = placed.filter(Boolean).length;

  if (n === 4) return null;

  // Opposite solved (UB+UF or UR+UL): do alg once
  const opp = (placed[0] && placed[2] && !placed[1] && !placed[3]) || (placed[1] && placed[3] && !placed[0] && !placed[2]);
  if (opp || n === 0) {
    return hint(
      n === 0 || opp ? "Opposite (or none)" : "Start the edge alg",
      "Good edges are opposite (or you don’t have a clear pair yet). Do your edge alg once from any angle — it becomes the adjacent case.",
      EDGE_PERM_ALG,
      "Then put the two good edges at left and back, and do the same alg again."
    );
  }

  // Adjacent: rotate so solved are at UL (3) and UB (0)
  const tmp = cloneFacelets(facelets);
  for (let i = 0; i < 4; i++) {
    const p = [0, 1, 2, 3].map((e) => yellowEdgePlaced(tmp, e));
    if (p[0] && p[3]) {
      const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
      const alg = prefix ? `${prefix} ${EDGE_PERM_ALG}` : EDGE_PERM_ALG;
      return hint(
        "Adjacent — left & back",
        "Hold the two good edges at left and back, then run your U-perm.",
        alg,
        "Alg: R' U R' U' R' U' R' U R U R2 U′"
      );
    }
    applyMove(tmp, "U");
  }

  // One solved — hold in back and try alg (U-perm family)
  for (let i = 0; i < 4; i++) {
    const trial = cloneFacelets(facelets);
    const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
    if (i) applyAlg(trial, prefix);
    if (yellowEdgePlaced(trial, 0)) {
      const alg = prefix ? `${prefix} ${EDGE_PERM_ALG}` : EDGE_PERM_ALG;
      return hint(
        "One good edge in back",
        "Hold the solved edge at the back, then the same alg.",
        alg,
        "If it doesn’t finish, U-spin and try again — or do the alg once to reshape the case."
      );
    }
  }

  return hint("Place yellow edges", "U-spin to set up, then your edge alg.", EDGE_PERM_ALG, "");
}

const NIKLAS = "R U' L' U R' U' L";

function yellowCornersPlaceHint(facelets) {
  const seated = [0, 1, 2, 3].map((i) => yellowCornerSeated(facelets, i));
  const n = seated.filter(Boolean).length;

  if (n >= 1) {
    // Hold a correct corner at UFL (index 3)
    const tmp = cloneFacelets(facelets);
    for (let i = 0; i < 4; i++) {
      if (yellowCornerSeated(tmp, 3)) {
        const prefix = i === 0 ? "" : i === 1 ? "U" : i === 2 ? "U2" : "U'";
        const alg = prefix ? `${prefix} ${NIKLAS}` : NIKLAS;
        return hint(
          "One (or more) correct — hold front-left",
          "Keep a correct corner at front-left, then Niklas: R U′ L′ U R′ U′ L.",
          alg,
          "You may need the alg twice. Check seats after each time."
        );
      }
      applyMove(tmp, "U");
    }
  }

  return hint(
    "Zero correct corners",
    "Do Niklas once from any angle. Then you’ll get at least one correct corner — hold it at front-left and repeat.",
    NIKLAS,
    "Full alg (what you half-remembered): R U′ L′ U R′ U′ L"
  );
}

function yellowOrientHint(facelets) {
  // Prefer teaching their flip method; on the virtual cube we can do it with yellow still on U using R' D' R D,
  // OR apply x2 then righty+D. Their method: x2, righty, D.
  // After x2: white on U, yellow on D. Orient D corners with righty while yellow-on-right, then D.

  // Check if already all yellow on U (oriented for standard hold)
  if (yellowFaceOriented(facelets) && yellowCornersSeated(facelets)) {
    return null;
  }

  // If yellow face not all yellow, use their method via x2 path on the simulator
  const flipped = cloneFacelets(facelets);
  applyAlg(flipped, "x2");
  // Now D should be yellow face. Find a D corner that isn't yellow on D.
  // DFR is D index 2 — after x2, check D face corners
  const d = getFace(flipped, "D");
  const dCorners = [0, 2, 6, 8];
  if (dCorners.every((i) => d[i] === "yellow")) {
    // Oriented in flipped space = yellow was oriented on U... weird edge case
    return hint("Almost done", "Corners look oriented — check seats / U alignment.", "U", "");
  }

  // Bring a bad corner to DFR with D turns in flipped space = U turns before flip...
  // Simpler UX: tell them to flip, then apply righty on the virtual cube after we x2 for them.
  if (getFace(facelets, "U")[4] === "yellow" && !yellowFaceOriented(facelets)) {
    // Still yellow on top in normal hold — offer: (1) flip instruction + alg that we apply as x2 + righties + D + x2
    // Detect UFR corner (U8) orientation: if not yellow on U, twist with sexy while... 
    // Their physical method uses white on top. We'll apply x2, do righty until DFR has yellow on D, D, etc., then x2 back — as one hint chunk for the current corner.

    const work = cloneFacelets(facelets);
    applyAlg(work, "x2");
    // Position a non-yellow D corner at DFR (D2) using D
    let dPrefix = "";
    for (let i = 0; i < 4; i++) {
      if (getFace(work, "D")[2] !== "yellow") {
        dPrefix = i === 0 ? "" : i === 1 ? "D" : i === 2 ? "D2" : "D'";
        break;
      }
      applyMove(work, "D");
    }
    // Count righties needed until D2 is yellow
    let n = 0;
    const trial = cloneFacelets(work);
    for (let k = 0; k < 8; k++) {
      if (getFace(trial, "D")[2] === "yellow") break;
      applyAlg(trial, RIGHTY);
      n++;
    }
    const parts = ["x2"];
    if (dPrefix) parts.push(dPrefix);
    for (let k = 0; k < n; k++) parts.push(RIGHTY);
    // Don't auto-D-all; one corner per hint, then they continue. End with note to D next — keep white on top (stay flipped) 
    // For the simulator, flip back at end of THIS corner so the rest of the app still assumes yellow U:
    parts.push("x2");
    // Wait - if we flip back, D turns for next corner don't match their "don't rotate cube". Better stay consistent with yellow-on-U using R'D'RD equivalent.

    // Equivalent without flip: R' D' R D with yellow on U (same muscle as righty+D after x2)
    // User asked for their method — show their words but apply equivalent that's safe for our orientation model:
  }

  // Yellow-on-U method equivalent to their white-on-top righty+D:
  // Put twisted corner at UFR; repeat R' D' R D until yellow on U; then U (like their D after flip).
  const u = getFace(facelets, "U");
  if (u[8] === "yellow") {
    const tmp = cloneFacelets(facelets);
    for (let i = 1; i <= 3; i++) {
      applyMove(tmp, "U");
      if (getFace(tmp, "U")[8] !== "yellow") {
        const prefix = i === 1 ? "U" : i === 2 ? "U2" : "U'";
        return hint(
          "Next corner (U = their D)",
          "This corner is done. Turn U to bring a twisted corner to front-right — same idea as your D after flipping white up.",
          prefix,
          "Your method: flip white up, then D between corners. Here we keep yellow up and use U instead of D."
        );
      }
    }
  }

  const trial = cloneFacelets(facelets);
  let n = 0;
  for (let i = 0; i < 4; i++) {
    applyAlg(trial, "R' D' R D");
    n++;
    if (getFace(trial, "U")[8] === "yellow") break;
  }
  const alg = Array(n).fill("R' D' R D").join(" ");
  return hint(
    "Twist the front-right corner",
    "Your way: flip white to top, find yellow on the right of the bottom-front-right corner, righty until fixed, then D. Same result here with yellow still on top: R′ D′ R D until yellow faces up, then U for the next corner.",
    alg,
    "Righty after an x2 flip = this R′ D′ R D pattern. Don’t turn the whole cube between corners — only D (or U in this yellow-up hold)."
  );
}

export function analyze(facelets) {
  if (isSolved(facelets)) {
    return {
      solved: true,
      stepIndex: 7,
      hint: null,
      stepsDone: [true, true, true, true, true, true, true],
    };
  }

  const s1 = whiteCrossDone(facelets);
  const s2 = s1 && whiteCornersDone(facelets);
  const s3 = s2 && middleLayerDone(facelets);
  const s4 = s3 && yellowCrossDone(facelets);
  const s5 = s4 && yellowEdgesDone(facelets);
  const s6 = s5 && yellowCornersSeated(facelets);
  const s7 = s6 && yellowFaceOriented(facelets);

  const stepsDone = [s1, s2, s3, s4, s5, s6, s7];

  let stepIndex = 0;
  let h = null;
  if (!s1) {
    stepIndex = 0;
    h = whiteCrossHint(facelets);
  } else if (!s2) {
    stepIndex = 1;
    h = whiteCornersHint(facelets);
  } else if (!s3) {
    stepIndex = 2;
    h = middleEdgesHint(facelets);
  } else if (!s4) {
    stepIndex = 3;
    h = yellowCrossHint(facelets);
  } else if (!s5) {
    stepIndex = 4;
    h = yellowEdgesHint(facelets);
  } else if (!s6) {
    stepIndex = 5;
    h = yellowCornersPlaceHint(facelets);
  } else {
    stepIndex = 6;
    h = yellowOrientHint(facelets);
  }

  return { solved: false, stepIndex, hint: h, stepsDone };
}

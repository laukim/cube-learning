/**
 * White cross drill — white on bottom, four edges matched to centres.
 */

import { applyAlg, solvedFacelets, sticker } from "./cube.js";

export const CROSS_EDGES = [
  { id: "DF", name: "Front · green", dIdx: 1, sideFace: "F", sideIdx: 7, sideColor: "green" },
  { id: "DR", name: "Right · red", dIdx: 5, sideFace: "R", sideIdx: 7, sideColor: "red" },
  { id: "DB", name: "Back · blue", dIdx: 7, sideFace: "B", sideIdx: 7, sideColor: "blue" },
  { id: "DL", name: "Left · orange", dIdx: 3, sideFace: "L", sideIdx: 7, sideColor: "orange" },
];

const EDGE_LOCS = [
  { id: "UF", read: (f) => [sticker(f, "U", 7), sticker(f, "F", 1)] },
  { id: "UR", read: (f) => [sticker(f, "U", 5), sticker(f, "R", 1)] },
  { id: "UB", read: (f) => [sticker(f, "U", 1), sticker(f, "B", 1)] },
  { id: "UL", read: (f) => [sticker(f, "U", 3), sticker(f, "L", 1)] },
  { id: "FR", read: (f) => [sticker(f, "F", 5), sticker(f, "R", 3)] },
  { id: "FL", read: (f) => [sticker(f, "F", 3), sticker(f, "L", 5)] },
  { id: "BR", read: (f) => [sticker(f, "B", 3), sticker(f, "R", 5)] },
  { id: "BL", read: (f) => [sticker(f, "B", 5), sticker(f, "L", 3)] },
  { id: "DF", read: (f) => [sticker(f, "D", 1), sticker(f, "F", 7)] },
  { id: "DR", read: (f) => [sticker(f, "D", 5), sticker(f, "R", 7)] },
  { id: "DB", read: (f) => [sticker(f, "D", 7), sticker(f, "B", 7)] },
  { id: "DL", read: (f) => [sticker(f, "D", 3), sticker(f, "L", 7)] },
];

/** U-layer edge id that sits above a cross slot. */
const U_ABOVE = { DF: "UF", DR: "UR", DB: "UB", DL: "UL" };

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

export function crossEdgeDone(facelets, edge) {
  return (
    sticker(facelets, "D", edge.dIdx) === "white" &&
    sticker(facelets, edge.sideFace, edge.sideIdx) === edge.sideColor
  );
}

export function whiteCrossDone(facelets) {
  return CROSS_EDGES.every((e) => crossEdgeDone(facelets, e));
}

function locateEdge(facelets, edge) {
  const want = new Set(["white", edge.sideColor]);
  for (const loc of EDGE_LOCS) {
    const [a, b] = loc.read(facelets);
    if (want.has(a) && want.has(b)) {
      return { id: loc.id, whiteOnFirst: a === "white" };
    }
  }
  return null;
}

function whiteOnDCount(facelets) {
  return [1, 3, 5, 7].filter((i) => sticker(facelets, "D", i) === "white").length;
}

function edgeHint(facelets, edge) {
  const where = locateEdge(facelets, edge);
  const uAbove = U_ABOVE[edge.id];

  if (!where) {
    return hint(
      `Find the ${edge.name} edge`,
      "Look for the white edge with that side colour. It is somewhere on the cube — bring it to the top layer first.",
      "U / F / R …",
      "One edge at a time. Ignore corners."
    );
  }

  if (where.id === edge.id) {
    const whiteDown = sticker(facelets, "D", edge.dIdx) === "white";
    const sideOk = sticker(facelets, edge.sideFace, edge.sideIdx) === edge.sideColor;
    if (whiteDown && sideOk) {
      return hint(`${edge.id} · done`, "This edge is correct.", "", "");
    }
    if (whiteDown && !sideOk) {
      return hint(
        `${edge.id} · white down, fix the side`,
        "White is on the bottom but the side colour is wrong. Turn the bottom (D) until this edge lines up with its centre, or lift it out and re-insert.",
        "D / D' / D2",
        "If D spins do not fix it, do F2 (or the matching face twice) to lift the edge, then try again."
      );
    }
    if (!whiteDown && sideOk) {
      return hint(
        `${edge.id} · flip white to the bottom`,
        "Side colour matches the centre but white is not on the bottom yet. A double turn of that face often fixes it.",
        `${edge.sideFace}2`,
        "Goal: white sticker on D, side colour matching the centre."
      );
    }
    return hint(
      `${edge.id} · almost there`,
      "This edge is in the right slot but not finished. Small D turns or one F2-style lift and re-insert.",
      "D / D'  or  F2",
      ""
    );
  }

  if (["DF", "DR", "DB", "DL"].includes(where.id)) {
    return hint(
      `${edge.id} · wrong bottom slot`,
      `That white edge is sitting in ${where.id}, not ${edge.id}. Lift it out (F2 / R2 / …), put it on U, then insert into the correct slot.`,
      `${edge.sideFace}2  or  U … ${edge.sideFace}2`,
      "Do not leave edges in the wrong cross hole."
    );
  }

  if (where.id === uAbove) {
    if (where.whiteOnFirst) {
      return hint(
        `${edge.id} · edge above its slot`,
        "Good — the edge sits on top, above the right centre. Turn that face twice (180°) to drop white into the cross.",
        `${edge.sideFace}2`,
        "Daisy method: build all four on top first, then double-turn each down."
      );
    }
    return hint(
      `${edge.id} · edge above, white on the side`,
      "The edge is above the right slot but white is on the side. U-spin so white faces up, then double-turn that face to insert.",
      `U …  then  ${edge.sideFace}2`,
      "Or line the side colour with its centre on U, then insert."
    );
  }

  if (["UF", "UR", "UB", "UL"].includes(where.id)) {
    return hint(
      `${edge.id} · edge on top (wrong spot)`,
      `This edge is on U at ${where.id}. U-spin until it sits above its slot (${uAbove}), then ${edge.sideFace}2 to insert.`,
      "U  …  then  F2 / R2 / B2 / L2",
      "Match the side colour to the centre below before you double-turn down."
    );
  }

  // Middle layer
  return hint(
    `${edge.id} · edge in the middle`,
    "Middle-layer edges block the cross. Bring it to the top with a righty-style move from the front, then place it.",
    "U  R  U'  R'  (or mirror from the left)",
    "Pop it out, U to a clear spot, then daisy or direct insert."
  );
}

export function analyzeCross(facelets) {
  const edges = CROSS_EDGES.map((e) => ({
    ...e,
    done: crossEdgeDone(facelets, e),
  }));
  const solvedCount = edges.filter((e) => e.done).length;

  if (solvedCount === 4) {
    return {
      edges,
      solvedCount: 4,
      complete: true,
      hint: hint(
        "Cross done",
        "White + on the bottom, all four sides match. New case to drill again, or switch to F2L.",
        "",
        ""
      ),
    };
  }

  const target = edges.find((e) => !e.done);
  const onD = whiteOnDCount(facelets);

  if (onD === 4 && solvedCount < 4) {
    return {
      edges,
      solvedCount,
      complete: false,
      hint: hint(
        "Match the side colours",
        "White + shape is on the bottom — nice. Now turn D until each edge’s side colour lines up with its centre (green↔green, red↔red, …).",
        "D / D' / D2",
        `${solvedCount}/4 edges fully correct.`
      ),
    };
  }

  return {
    edges,
    solvedCount,
    complete: false,
    target,
    hint: edgeHint(facelets, target),
  };
}

/** Scramble while keeping white centre on D; cross starts unsolved. */
export function scrambleCross(facelets, count = 16) {
  const s = solvedFacelets();
  const pool = [
    "R",
    "R'",
    "L",
    "L'",
    "F",
    "F'",
    "B",
    "B'",
    "U",
    "U'",
    "U2",
    "D",
    "D'",
    "D2",
    "R U R'",
    "R U' R'",
    "R U2 R'",
    "L' U' L",
    "F R U R' U' F'",
    "R U R' U'",
    "U R U' R'",
    "y",
    "y'",
  ];

  for (let attempt = 0; attempt < 40; attempt++) {
    for (let i = 0; i < 54; i++) facelets[i] = s[i];
    const parts = [];
    const n = count + Math.floor(Math.random() * 8);
    let last = "";
    for (let i = 0; i < n; i++) {
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick === last) pick = pool[(pool.indexOf(pick) + 3) % pool.length];
      applyAlg(facelets, pick);
      parts.push(pick);
      last = pick;
    }
    if (!whiteCrossDone(facelets)) {
      return parts.join(" ");
    }
  }

  for (let i = 0; i < 54; i++) facelets[i] = s[i];
  const fallback = "R U R' U R U2 R' U' L' U L";
  applyAlg(facelets, fallback);
  return fallback;
}

export const CROSS_TIPS = [
  {
    title: "What you’re building",
    body: "White on the bottom. Four edges form a + — each white edge’s other colour must match the side centre (green by green, red by red, …). Corners do not matter in this drill.",
  },
  {
    title: "One edge at a time",
    body: "Pick one unsolved edge (the app tracks F · R · B · L). Find that white edge piece, get it to the top above its slot, then double-turn that face to drop it in.",
  },
  {
    title: "Daisy shortcut",
    body: "You can build a white cross on the yellow face first — all four white edges on top with white facing up — then turn each face 180° to send them to the bottom. Same result, different path.",
  },
  {
    title: "When white + is there but wrong",
    body: "All four whites on D but colours off? Only turn D. If one edge is flipped wrong, lift it with F2 (or R2, …), fix on U, insert again.",
  },
  {
    title: "Speed tip",
    body: "Look for the next white edge before you finish the current one. Cross under ~40s is a good target before worrying about full solve time.",
  },
];

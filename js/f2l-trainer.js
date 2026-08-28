/**
 * Intuitive F2L trainer — white cross stays solved; practice pairing + inserting.
 * Always coach relative to the FR slot; use y / y' to bring the next pair to front-right.
 */

import {
  applyAlg,
  cloneFacelets,
  getFace,
  solvedFacelets,
  sticker,
} from "./cube.js";

export const RIGHTY = "R U R' U'";
export const LEFTY = "L' U' L U";

/** Four F2L slots, colours for white-on-D cube. */
export const SLOTS = [
  { id: "FR", name: "Front-right", f: "F", r: "R", fc: "green", rc: "red" },
  { id: "BR", name: "Back-right", f: "B", r: "R", fc: "blue", rc: "red" },
  { id: "BL", name: "Back-left", f: "B", r: "L", fc: "blue", rc: "orange" },
  { id: "FL", name: "Front-left", f: "F", r: "L", fc: "green", rc: "orange" },
];

function setEq(a, b) {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function colorsAtCornerUFR(facelets) {
  return new Set([sticker(facelets, "U", 8), sticker(facelets, "R", 0), sticker(facelets, "F", 2)]);
}
function colorsAtCornerUFL(facelets) {
  return new Set([sticker(facelets, "U", 6), sticker(facelets, "F", 0), sticker(facelets, "L", 2)]);
}
function colorsAtCornerUBR(facelets) {
  return new Set([sticker(facelets, "U", 2), sticker(facelets, "B", 0), sticker(facelets, "R", 2)]);
}
function colorsAtCornerUBL(facelets) {
  return new Set([sticker(facelets, "U", 0), sticker(facelets, "L", 0), sticker(facelets, "B", 2)]);
}
function colorsAtCornerDFR(facelets) {
  return new Set([sticker(facelets, "D", 2), sticker(facelets, "F", 8), sticker(facelets, "R", 6)]);
}

function edgeColorsUF(facelets) {
  return new Set([sticker(facelets, "U", 7), sticker(facelets, "F", 1)]);
}
function edgeColorsUR(facelets) {
  return new Set([sticker(facelets, "U", 5), sticker(facelets, "R", 1)]);
}
function edgeColorsUB(facelets) {
  return new Set([sticker(facelets, "U", 1), sticker(facelets, "B", 1)]);
}
function edgeColorsUL(facelets) {
  return new Set([sticker(facelets, "U", 3), sticker(facelets, "L", 1)]);
}
function edgeColorsFR(facelets) {
  return new Set([sticker(facelets, "F", 5), sticker(facelets, "R", 3)]);
}

export function whiteCrossIntact(facelets) {
  const d = getFace(facelets, "D");
  if (![1, 3, 5, 7].every((i) => d[i] === "white")) return false;
  return (
    sticker(facelets, "F", 7) === "green" &&
    sticker(facelets, "R", 7) === "red" &&
    sticker(facelets, "B", 7) === "blue" &&
    sticker(facelets, "L", 7) === "orange"
  );
}

export function slotSolved(facelets, slot) {
  // Corner in DFR seat for FR-relative — rotate view conceptually per slot
  // Check absolute: corner colours match white+fc+rc and edge fc+rc in place with correct orientation
  const { f, r, fc, rc } = slot;
  const cornerTarget = new Set(["white", fc, rc]);
  const edgeTarget = new Set([fc, rc]);

  // Map slot to absolute corner/edge sticker positions
  const cornerMap = {
    FR: () => colorsAtCornerDFR(facelets),
    FL: () => new Set([sticker(facelets, "D", 0), sticker(facelets, "F", 6), sticker(facelets, "L", 8)]),
    BR: () => new Set([sticker(facelets, "D", 8), sticker(facelets, "B", 6), sticker(facelets, "R", 8)]),
    BL: () => new Set([sticker(facelets, "D", 6), sticker(facelets, "B", 8), sticker(facelets, "L", 6)]),
  };
  const edgeMap = {
    FR: () => edgeColorsFR(facelets),
    FL: () => new Set([sticker(facelets, "F", 3), sticker(facelets, "L", 5)]),
    BR: () => new Set([sticker(facelets, "B", 3), sticker(facelets, "R", 5)]),
    BL: () => new Set([sticker(facelets, "B", 5), sticker(facelets, "L", 3)]),
  };

  if (!setEq(cornerMap[slot.id](), cornerTarget)) return false;
  if (!setEq(edgeMap[slot.id](), edgeTarget)) return false;

  // Orientation: white on D for corner; side colours match centres for edge
  const whiteOnD = {
    FR: () => sticker(facelets, "D", 2) === "white",
    FL: () => sticker(facelets, "D", 0) === "white",
    BR: () => sticker(facelets, "D", 8) === "white",
    BL: () => sticker(facelets, "D", 6) === "white",
  };
  if (!whiteOnD[slot.id]()) return false;

  const edgeOri = {
    FR: () => sticker(facelets, "F", 5) === fc && sticker(facelets, "R", 3) === rc,
    FL: () => sticker(facelets, "F", 3) === fc && sticker(facelets, "L", 5) === rc,
    BR: () => sticker(facelets, "B", 3) === fc && sticker(facelets, "R", 5) === rc,
    BL: () => sticker(facelets, "B", 5) === fc && sticker(facelets, "L", 3) === rc,
  };
  return edgeOri[slot.id]();
}

export function countSlotsSolved(facelets) {
  return SLOTS.filter((s) => slotSolved(facelets, s)).length;
}

export function f2lComplete(facelets) {
  return whiteCrossIntact(facelets) && countSlotsSolved(facelets) === 4;
}

/** How many y turns bring this slot to front-right. */
const Y_TO_FR = { FR: 0, BR: 1, BL: 2, FL: 3 };

function yAlg(turns) {
  const t = ((turns % 4) + 4) % 4;
  if (t === 0) return "";
  if (t === 1) return "y";
  if (t === 2) return "y2";
  return "y'";
}

/**
 * Eject a solved slot’s pair without breaking the white cross.
 * Bring slot to FR → R U' R' → restore facing.
 */
function ejectSlotAlg(slotId) {
  const n = Y_TO_FR[slotId] || 0;
  const pre = yAlg(n);
  const post = yAlg(-n);
  return [pre, "R U' R'", post].filter(Boolean).join(" ");
}

/** Scramble F2L while keeping white cross; all 4 slots start unsolved. Returns alg string. */
export function scrambleF2L(facelets, count = 20) {
  const s = solvedFacelets();
  const pool = [
    "R U R' U'",
    "U R U' R'",
    "R U' R'",
    "U' R U R'",
    "R U2 R'",
    "L' U' L U",
    "U' L' U L",
    "L' U L",
    "U L' U' L",
    "R U R' U R U2 R'",
    "U",
    "U'",
    "U2",
    "y",
    "y'",
    "y2",
    "y R U R' U' y'",
    "y' L' U' L U y",
    "y2 R U' R' y2",
    "R U R' U' R U R' U'",
    "U R U' R' U R U' R'",
    "L' U' L U L' U' L",
  ];

  for (let attempt = 0; attempt < 36; attempt++) {
    for (let i = 0; i < 54; i++) facelets[i] = s[i];
    const parts = [];
    const n = count + Math.floor(Math.random() * 10);
    let last = "";
    for (let i = 0; i < n; i++) {
      let pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick === last) pick = pool[(pool.indexOf(pick) + 5) % pool.length];
      applyAlg(facelets, pick);
      parts.push(pick);
      last = pick;
    }

    if (!whiteCrossIntact(facelets)) continue;

    // Force-break any slot that is still solved
    let guard = 0;
    while (countSlotsSolved(facelets) > 0 && guard++ < 16) {
      for (const slot of SLOTS) {
        if (!slotSolved(facelets, slot)) continue;
        const seq = ejectSlotAlg(slot.id);
        applyAlg(facelets, seq);
        parts.push(seq);
      }
      const u = ["U", "U'", "U2"][Math.floor(Math.random() * 3)];
      applyAlg(facelets, u);
      parts.push(u);
      if (!whiteCrossIntact(facelets)) break;
    }

    if (whiteCrossIntact(facelets) && countSlotsSolved(facelets) === 0) {
      return parts.join(" ");
    }
  }

  // Deterministic fallback: eject all four slots from solved
  for (let i = 0; i < 54; i++) facelets[i] = s[i];
  const fallback = [];
  for (const slot of SLOTS) {
    const seq = ejectSlotAlg(slot.id);
    applyAlg(facelets, seq);
    fallback.push(seq);
  }
  applyAlg(facelets, "U R U' R' U2");
  fallback.push("U R U' R' U2");
  return fallback.join(" ");
}

/**
 * Find FR pair pieces (white+green+red corner, green+red edge) locations.
 */
function locateFRPair(facelets) {
  const cornerTarget = new Set(["white", "green", "red"]);
  const edgeTarget = new Set(["green", "red"]);

  const corners = [
    { id: "UFR", colors: colorsAtCornerUFR, whiteUp: () => sticker(facelets, "U", 8) === "white" },
    { id: "UFL", colors: colorsAtCornerUFL, whiteUp: () => sticker(facelets, "U", 6) === "white" },
    { id: "UBR", colors: colorsAtCornerUBR, whiteUp: () => sticker(facelets, "U", 2) === "white" },
    { id: "UBL", colors: colorsAtCornerUBL, whiteUp: () => sticker(facelets, "U", 0) === "white" },
    {
      id: "DFR",
      colors: colorsAtCornerDFR,
      whiteUp: () => false,
      whiteDown: () => sticker(facelets, "D", 2) === "white",
    },
  ];

  let corner = null;
  for (const c of corners) {
    if (setEq(c.colors(facelets), cornerTarget)) {
      corner = {
        id: c.id,
        whiteUp: c.whiteUp?.() ?? false,
        whiteDown: c.whiteDown?.() ?? false,
        whiteOnF: sticker(facelets, "F", c.id === "UFR" ? 2 : c.id === "UFL" ? 0 : c.id === "DFR" ? 8 : -1) === "white",
        whiteOnR: sticker(facelets, "R", c.id === "UFR" ? 0 : c.id === "UBR" ? 2 : c.id === "DFR" ? 6 : -1) === "white",
      };
      // refine side white for UFR
      if (c.id === "UFR") {
        corner.whiteOnF = sticker(facelets, "F", 2) === "white";
        corner.whiteOnR = sticker(facelets, "R", 0) === "white";
      }
      break;
    }
  }

  // Also check other D corners if FR corner stuck elsewhere in bottom
  if (!corner) {
    const dCorners = [
      {
        id: "DFL",
        colors: () => new Set([sticker(facelets, "D", 0), sticker(facelets, "F", 6), sticker(facelets, "L", 8)]),
      },
      {
        id: "DBR",
        colors: () => new Set([sticker(facelets, "D", 8), sticker(facelets, "B", 6), sticker(facelets, "R", 8)]),
      },
      {
        id: "DBL",
        colors: () => new Set([sticker(facelets, "D", 6), sticker(facelets, "B", 8), sticker(facelets, "L", 6)]),
      },
    ];
    for (const c of dCorners) {
      if (setEq(c.colors(), cornerTarget)) {
        corner = { id: c.id, whiteDown: sticker(facelets, "D", c.id === "DFL" ? 0 : c.id === "DBR" ? 8 : 6) === "white" };
        break;
      }
    }
  }

  const edges = [
    { id: "UF", colors: edgeColorsUF, topYellow: () => sticker(facelets, "U", 7) === "yellow" },
    { id: "UR", colors: edgeColorsUR, topYellow: () => sticker(facelets, "U", 5) === "yellow" },
    { id: "UB", colors: edgeColorsUB, topYellow: () => sticker(facelets, "U", 1) === "yellow" },
    { id: "UL", colors: edgeColorsUL, topYellow: () => sticker(facelets, "U", 3) === "yellow" },
    {
      id: "FR",
      colors: edgeColorsFR,
      oriented: () => sticker(facelets, "F", 5) === "green" && sticker(facelets, "R", 3) === "red",
    },
  ];

  let edge = null;
  for (const e of edges) {
    if (setEq(e.colors(facelets), edgeTarget)) {
      const topColor =
        e.id === "UF"
          ? sticker(facelets, "U", 7)
          : e.id === "UR"
            ? sticker(facelets, "U", 5)
            : e.id === "UB"
              ? sticker(facelets, "U", 1)
              : e.id === "UL"
                ? sticker(facelets, "U", 3)
                : null;
      edge = {
        id: e.id,
        topColor,
        topIsGreen: topColor === "green",
        oriented: e.oriented?.() ?? false,
      };
      break;
    }
  }

  // Edge might be in FL/BR/BL
  if (!edge) {
    const mid = [
      { id: "FL", colors: () => new Set([sticker(facelets, "F", 3), sticker(facelets, "L", 5)]) },
      { id: "BR", colors: () => new Set([sticker(facelets, "B", 3), sticker(facelets, "R", 5)]) },
      { id: "BL", colors: () => new Set([sticker(facelets, "B", 5), sticker(facelets, "L", 3)]) },
    ];
    for (const e of mid) {
      if (setEq(e.colors(), edgeTarget)) {
        edge = { id: e.id, stuckInSlot: true };
        break;
      }
    }
  }

  return { corner, edge };
}

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

/**
 * Coach F2L for the FR pair. User should y-rotate so the pair they want is FR colours (green-red).
 * For general slots we analyze FR after telling them which slot to bring forward.
 */
export function analyzeF2L(facelets) {
  const cross = whiteCrossIntact(facelets);
  const slots = SLOTS.map((s) => ({ ...s, done: slotSolved(facelets, s) }));
  const solvedCount = slots.filter((s) => s.done).length;

  if (!cross) {
    return {
      cross: false,
      solvedCount,
      slots,
      complete: false,
      hint: hint(
        "Cross broke",
        "F2L practice needs a solid white cross on the bottom. Hit New F2L case (or Reset) and try again.",
        "",
        ""
      ),
    };
  }

  if (solvedCount === 4) {
    return {
      cross: true,
      solvedCount: 4,
      slots,
      complete: true,
      hint: hint(
        "F2L done",
        "All four pairs are in. Nice. New case to drill again — or jump back to Guide for last layer.",
        "",
        ""
      ),
    };
  }

  // Which slots still need work
  const open = slots.filter((s) => !s.done);

  // Prefer coaching FR if unsolved; else ask for y
  const frDone = slots.find((s) => s.id === "FR").done;
  if (frDone) {
    const next = open[0];
    const yMap = { BR: "y", BL: "y2", FL: "y'" };
    return {
      cross: true,
      solvedCount,
      slots,
      complete: false,
      hint: hint(
        `FR done · bring ${next.id} to front-right`,
        `Turn the cube (y) so the ${next.name} slot sits at front-right. Then solve that pair the same way.`,
        yMap[next.id] || "y",
        "Always solve “as if” it’s the FR pair — same triggers every time."
      ),
    };
  }

  // FR unsolved — locate pieces and give intuitive case advice
  const { corner, edge } = locateFRPair(facelets);
  const caseHint = frCaseHint(facelets, corner, edge);
  return {
    cross: true,
    solvedCount,
    slots,
    complete: false,
    pair: { corner, edge },
    hint: caseHint,
  };
}

function frCaseHint(facelets, corner, edge) {
  // Both solved incorrectly shouldn't happen if slot not solved

  // Edge stuck in wrong middle slot — eject
  if (edge?.stuckInSlot || (edge?.id && ["FL", "BR", "BL"].includes(edge.id))) {
    return hint(
      "Edge stuck in the middle",
      "Your green-red edge is in another slot. Put that slot at front-right with y, do a righty to pop the pair out, then rebuild.",
      `y ${RIGHTY}`,
      "After they’re on top, come back to FR and pair normally."
    );
  }

  // Corner stuck in wrong D slot
  if (corner && ["DFL", "DBR", "DBL"].includes(corner.id)) {
    return hint(
      "Corner stuck in the bottom",
      "The white-green-red corner is in the wrong slot. Bring that slot to FR (y), righty to eject, then pair on top.",
      RIGHTY,
      "Don’t force it from the wrong seat — pop out, then insert cleanly."
    );
  }

  // Corner in DFR but wrong ori / edge wrong
  if (corner?.id === "DFR" && edge?.id === "FR") {
    return hint(
      "Pair in the slot but wrong",
      "Both pieces are in FR but twisted or flipped. Righty once to take them out, then re-pair on U.",
      RIGHTY,
      "Same as beginner: if it’s wrong in the slot, eject first."
    );
  }

  if (corner?.id === "DFR" && edge && edge.id !== "FR") {
    return hint(
      "Corner in slot, edge on top",
      "Eject the corner with a righty, then pair it with the edge on U and insert.",
      RIGHTY,
      "After eject, hide the corner / match the edge — see “basic insert” tips below."
    );
  }

  if (edge?.id === "FR" && corner && corner.id !== "DFR") {
    return hint(
      "Edge in slot, corner on top",
      "Pop the edge out (righty), then pair with the corner on U.",
      RIGHTY,
      "Then use a standard connected or separated insert."
    );
  }

  // Both on U — classic intuitive cases
  if (corner && ["UFR", "UFL", "UBR", "UBL"].includes(corner.id) && edge && ["UF", "UR", "UB", "UL"].includes(edge.id)) {
    return bothOnUHint(facelets, corner, edge);
  }

  return hint(
    "Find the FR pair",
    "Look for the white corner with green + red, and the green-red edge (no yellow). Get both to the top layer, then pair and insert into front-right.",
    "U / R U R' U'",
    "Goal every time: pair on U → hold above the FR slot → righty (or the matching insert)."
  );
}

function bothOnUHint(facelets, corner, edge) {
  // 5 fundamental cases (ParadoxCubing / common beginner F2L):
  // hold FR slot; corner above it at UFR; edge separated on U.

  if (corner.id !== "UFR") {
    return hint(
      "Setup · corner above the slot",
      "U-spin until the white–green–red corner sits at UFR (front-right on top), right above the FR slot. Then ask for another hint — we’ll name which of the 5 cases you have.",
      "U",
      "All five fundamental cases start with the corner above FR."
    );
  }

  const touching = edge.id === "UF" || edge.id === "UR";
  if (touching) {
    return hint(
      "Setup · split the pair (hiding trick)",
      edge.id === "UF"
        ? "Corner and edge are touching. Hide the corner with R′, U-spin the edge to UL or UB (not UF/UR), then R to unhide. Now they’re separated — one of the 5 cases."
        : "Edge is at UR (touching). U′ so both are toward the back, R to hide the corner, U-spin the edge to UL or UF, then R′ to unhide.",
      edge.id === "UF" ? "R' U R" : "U' R U R'",
      "Golden rule later: when hiding, the slot you lift should be empty (unsolved)."
    );
  }

  const cornerTop = sticker(facelets, "U", 8); // UFR up sticker
  const edgeTop = edge.topColor;
  const topsMatch = edgeTop && cornerTop === edgeTop;
  const edgeBackOrLeft = edge.id === "UB" || edge.id === "UL";

  // —— Case 3: white on top ——
  if (corner.whiteUp) {
    if (!edgeBackOrLeft) {
      return hint(
        "Case 3 · White on top (fix edge first)",
        "White faces up. Put the edge at UL or UB (hiding trick if needed), then continue.",
        "R' U R",
        "White-on-top works with either edge colour up — follow the side colour of the edge."
      );
    }
    return hint(
      "Case 3 · White on top",
      "1) Look at the edge’s side colour (not the top): U-spin so that side sits above its matching centre (green↔F or red↔R). 2) Look at the edge’s top colour — U-spin the edge away from that centre (a cross edge comes up; that’s OK). 3) U the corner onto the edge to pair. 4) Fix the cross. 5) Insert: y′ · U′ · L′ · U · L · y (slot to front-left, attach to cross, put back).",
      "U  …  y' U' L' U L y",
      "Same case if the edge is “reversed” — only which centre you match changes. Re-hint after each U if you’re unsure."
    );
  }

  // —— Cases 1–2: white facing right ——
  if (corner.whiteOnR) {
    if (edge.id === "UL" && !topsMatch) {
      return hint(
        "Case 2 setup · edge to the back",
        "Non-matching needs the edge at UB (back), not UL. Hide with R′, U the edge to UB, R to unhide — then you’ll have Case 2.",
        "R' U R",
        "Case 2 then solves with R U R′."
      );
    }

    if (topsMatch && edgeBackOrLeft) {
      return hint(
        "Case 1 · Matching",
        "White faces right; top colours of corner & edge match. 1) R′ hide corner. 2) U until the edge is at UF (front). 3) R unhide → pair forms. 4) Insert: y′ · U′ · L′ · U · L · y.",
        "R' U R   then   y' U' L' U L y",
        "Matching = same colour on top of both pieces."
      );
    }

    if (!topsMatch && edge.id === "UB") {
      return hint(
        "Case 2 · Non-matching",
        "White faces right; top colours differ; edge at back. Just R U R′ — that pairs and inserts in one go.",
        "R U R'",
        "Easiest of the five. Edge must stay at UB (not UL)."
      );
    }

    return hint(
      "Case 1 / 2 · White faces right",
      "White is on the right face of the corner. If the edge’s top colour matches the corner’s top → Case 1 (matching). If not → put edge at UB for Case 2. Use the hiding trick to move the edge, then re-hint.",
      "R' U R",
      "Matching → hide, edge to front, unhide, insert. Non-matching → R U R′."
    );
  }

  // —— Cases 4–5: white facing front ——
  if (corner.whiteOnF) {
    if (topsMatch && edgeBackOrLeft) {
      return hint(
        "Case 4 · Mirrored matching",
        "White faces front; tops match. 1) U′ (corner to UBR). 2) R hide. 3) U until edge is at UB. 4) R′ unhide → pair in back. 5) Insert (white facing you): U · R · U′ · R′.",
        "U' R U R'   then   U R U' R'",
        "Mirror of Case 1 — white on front instead of right."
      );
    }

    if (!topsMatch && edgeBackOrLeft) {
      return hint(
        "Case 5 · Mirrored non-matching",
        "White faces front; tops don’t match. y′ so the slot is front-left, then L′ U′ L — pairs and inserts.",
        "y' L' U' L",
        "Mirror of Case 2. You can y back afterward if you like."
      );
    }

    return hint(
      "Case 4 / 5 · White faces front",
      "White is on the front of the corner. Matching tops → Case 4. Different tops → Case 5 (edge at UL or UB). Split with the hiding trick if the edge is touching, then re-hint.",
      "U' R U R'",
      "Case 4 insert ends with U R U′ R′. Case 5 is y′ L′ U′ L."
    );
  }

  return hint(
    "Pair on top",
    "Both pieces are on U. U-spin the corner to UFR above FR, make sure the edge isn’t touching it, then re-hint for Case 1–5.",
    "U",
    "The five cases only apply once the corner is above the slot and separated from the edge."
  );
}

export const F2L_TIPS = [
  {
    title: "What F2L is",
    body: "Each white corner goes in with its matching edge. White cross stays solved. Four pairs → first two layers done.",
  },
  {
    title: "How to practice here",
    body: "Tap New F2L case. Keep white on the bottom. Pick one unsolved corner+edge. Turn the whole cube (y) until that pair’s slot is front-right. Then follow the hint.",
  },
  {
    title: "The only goal",
    body: "Get the corner sitting above the front-right hole, and its edge nearby on top — then join them and drop them in with a righty (R U R' U').",
  },
  {
    title: "The 5 setups (same slot)",
    body: "Once the corner is above front-right: white sticker on the right side → “normal”. White sticker on the front side → “mirror” (use the left). Same colour on top of corner and edge → matching. Different tops → join with R U R' first. White on top of the corner → hide it, move the edge, bring them back.",
  },
  {
    title: "If pieces are stuck",
    body: "Pair already jammed in a slot but wrong? One righty pops them out. Corner and edge stuck together on top? Peek the corner away with R' (or R), spin the edge, then bring the corner back.",
  },
];

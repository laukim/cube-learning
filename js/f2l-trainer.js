/**
 * Standard F2L cases (CubeHead’s 41: 1R, 1L, 2R…). Cross stays; three pairs stay; one slot is the case.
 * https://www.youtube.com/watch?v=3tYj-9f4dA0
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  getFace,
  parseAlg,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { F2L_DRILL_CASES } from "./f2l-cases.js";

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

export function solvedSlotIds(facelets) {
  return SLOTS.filter((s) => slotSolved(facelets, s)).map((s) => s.id);
}

/**
 * Solved slot ids only while the white cross is intact.
 * Mid-alg turns (sledge F, sexy R, …) can make a slot look solved while the
 * cross is broken — those phantoms must not count for pop tracking.
 * @returns {string[] | null}
 */
export function stableSolvedSlotIds(facelets) {
  if (!whiteCrossIntact(facelets)) return null;
  return solvedSlotIds(facelets);
}

/**
 * Baseline for pop judgement: live ids when the cross is intact, otherwise the
 * last cross-intact snapshot so mid-alg phantoms do not close the open slot.
 */
export function popBaselineIds(facelets, lastStableIds = []) {
  return stableSolvedSlotIds(facelets) ?? lastStableIds ?? [];
}

function moveFaceKey(move) {
  const face = String(move || "")[0];
  if (!face || /^[Uxyz]/i.test(face)) return "";
  return face.toUpperCase();
}

/** True if an unsolved slot uses this face — R/F on FR, L/F on FL, etc. */
export function openSlotUsesFace(prevIds, move) {
  const faceKey = moveFaceKey(move);
  if (!faceKey) return false;
  const solved = new Set(prevIds);
  return SLOTS.some((s) => !solved.has(s.id) && (s.f === faceKey || s.r === faceKey));
}

/**
 * Solved slots that came out on a face the open pair does not need.
 * R/L'/F on the empty slot are the insert — a neighbour may leave for a
 * move and come back. That is not a pop.
 *
 * `prevIds` must be from {@link popBaselineIds} / last cross-intact state.
 * Using raw mid-alg ids (sledge after F) falsely closes the open slot, so the
 * next R' looks like a dump.
 */
export function poppedSolvedSlots(prevIds, facelets, move) {
  if (openSlotUsesFace(prevIds, move)) return [];
  const faceKey = moveFaceKey(move);
  if (!faceKey) return [];
  const now = new Set(solvedSlotIds(facelets));
  return prevIds.filter((id) => !now.has(id));
}

/** Moves after leading U setup — the real work for that pair. */
function insertRest(moves) {
  let i = 0;
  while (i < moves.length && /^U/i.test(moves[i])) i += 1;
  return moves.slice(i);
}

/**
 * CubeHead easy insert (1–4): short connected-pair insert on one side face,
 * or a 4-move sledge/hedge on two side faces. Longer buffers are setup, not
 * a clean easy insert — even if they end in U R U' R'.
 */
export function isEasyConnectedInsert(moves) {
  const rest = insertRest(moves);
  if (rest.length < 3 || rest.length > 4) return false;
  const faces = new Set();
  let sideCount = 0;
  for (const m of rest) {
    const f = String(m)[0]?.toUpperCase();
    if (!f || f === "U") continue;
    if (!/^[FRLB]$/.test(f)) return false;
    faces.add(f);
    sideCount += 1;
  }
  if (faces.size === 1) return true;
  return faces.size === 2 && sideCount === 4 && rest.length === 4;
}

function insertClosing(rest) {
  if (rest.length <= 4) return rest;
  return rest.slice(-4);
}

function insertTrigger(moves) {
  const rest = insertRest(moves);
  if (!rest.length) return moves.join(" ");
  if (isEasyConnectedInsert(moves)) return rest.join(" ");
  // Longer buffer that still finishes with an easy-looking insert — say so.
  const closing = insertClosing(rest);
  if (rest.length > 4 && isEasyConnectedInsert(closing)) {
    return `setup → ${closing.join(" ")}`;
  }
  if (rest.length <= 8) return rest.join(" ");
  return closing.join(" ");
}

function describeInsert(moves) {
  const rest = insertRest(moves);
  const easy = isEasyConnectedInsert(moves);
  const closing = insertClosing(rest);
  const closingEasy = !easy && rest.length > 4 && isEasyConnectedInsert(closing);
  return {
    trigger: insertTrigger(moves),
    easy,
    setup: !easy && rest.length > 4,
    closingEasy,
  };
}

/**
 * Replay cross + F2L flicks (cube-fixed F/R/L/B). Orbit is look-only and will
 * not appear as y — this still shows which slot went in, and when a later
 * side turn popped a pair that was already solved.
 */
export function analyzeF2lFlow(scramble, crossAlg, f2lAlg) {
  const f = solvedFacelets();
  try {
    if (scramble) applyAlg(f, scramble);
    if (crossAlg) applyAlg(f, crossAlg);
  } catch {
    return { inserts: [], pops: [] };
  }
  const moves = parseAlg(f2lAlg);
  const inserts = [];
  const pops = [];
  let buf = [];
  let lastStable = stableSolvedSlotIds(f) ?? [];
  const seen = new Set(lastStable);
  for (const m of moves) {
    const before = popBaselineIds(f, lastStable);
    applyMove(f, m);
    buf.push(m);
    for (const id of poppedSolvedSlots(before, f, m)) {
      pops.push({ slot: id, move: m });
    }
    const stable = stableSolvedSlotIds(f);
    if (!stable) continue;
    lastStable = stable;
    for (const id of stable) {
      if (seen.has(id)) continue;
      seen.add(id);
      const info = describeInsert(buf);
      inserts.push({
        slot: id,
        moves: buf.slice(),
        trigger: info.trigger,
        easy: info.easy,
        setup: info.setup,
        closingEasy: info.closingEasy,
      });
      buf = [];
    }
  }
  return { inserts, pops, leftover: buf };
}

function formatPopLine(pops) {
  if (!pops?.length) return "no pops";
  const bySlot = new Map();
  for (const p of pops) {
    const face = String(p.move)[0];
    if (!face || face === "U") continue;
    const cur = bySlot.get(p.slot) || { n: 0, faces: new Set() };
    cur.n += 1;
    cur.faces.add(face);
    bySlot.set(p.slot, cur);
  }
  const popBits = [...bySlot.entries()].map(
    ([slot, cur]) => `${slot}×${cur.n} (${[...cur.faces].join("/")})`
  );
  if (!popBits.length) return "no pops";
  return `popped ${popBits.join(" · ")} — turned a face the open pair doesn’t use`;
}

function formatInsertKindLine(flow) {
  const n = flow.inserts.length;
  const easyN = flow.inserts.filter((x) => x.easy).length;
  const setupN = flow.inserts.filter((x) => x.setup).length;
  const bits = [];
  if (easyN === n && n >= 4) {
    bits.push(`all ${n} easy inserts (connected pairs)`);
  } else if (easyN > 0) {
    bits.push(`${easyN}/${n} easy insert${easyN === 1 ? "" : "s"} (connected)`);
  }
  if (setupN > 0) {
    bits.push(`${setupN} with longer setup`);
  }
  if (!bits.length) {
    bits.push("no clean easy inserts");
  }
  bits.push(formatPopLine(flow.pops));
  return `   inserts: ${bits.join(" · ")}`;
}

export function formatF2lFlow(flow) {
  if (!flow?.inserts?.length) return [];
  const inBits = flow.inserts.map((x) => `${x.slot} (${x.trigger})`);
  return [`   first in: ${inBits.join(" · ")}`, formatInsertKindLine(flow)];
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

let f2lDrillIndex = 0;
let f2lDrillStarted = false;

/**
 * Red POP flash is for timed full-cube Guide solves only.
 * Cross / F2L / OLL / PLL drills must never trigger it.
 */
export function shouldFlashPop(appMode, { timerPhase, lastDone = 0, f2lLocked = false } = {}) {
  if (appMode !== "guide") return false;
  if (timerPhase !== "running") return false;
  if (f2lLocked || lastDone >= 2) return false;
  return true;
}

export function resetF2lDrill() {
  f2lDrillIndex = 0;
  f2lDrillStarted = false;
}

export function getF2lDrillInfo() {
  const n = F2L_DRILL_CASES.length;
  const i = ((f2lDrillIndex % n) + n) % n;
  const c = F2L_DRILL_CASES[i];
  const next = F2L_DRILL_CASES[(i + 1) % n];
  const prev = i > 0 ? F2L_DRILL_CASES[i - 1] : null;
  return {
    index: i,
    total: n,
    id: c.id,
    name: c.name,
    group: c.group,
    hand: c.hand,
    slot: c.slot,
    started: f2lDrillStarted,
    random: false,
    nextId: next.id,
    prevId: prev?.id || "",
    atStart: i === 0,
    atEnd: i === n - 1,
  };
}

/** Live hint for the F2L tab case drill (not the full-solve guide). */
export function analyzeF2lDrill(facelets) {
  const info = getF2lDrillInfo();
  const c = F2L_DRILL_CASES[info.index];
  const slot = SLOTS.find((s) => s.id === c.slot);
  const others = SLOTS.filter((s) => s.id !== c.slot);
  const targetIn = slotSolved(facelets, slot);
  const othersIn = others.every((s) => slotSolved(facelets, s));
  const cross = whiteCrossIntact(facelets);
  const popped = others.filter((s) => !slotSolved(facelets, s));
  const dumped = popped.filter((s) => s.f !== slot.f && s.f !== slot.r && s.r !== slot.f && s.r !== slot.r);

  if (!f2lDrillStarted) {
    return {
      complete: false,
      ready: true,
      case: c,
      hint: hint(
        "Standard F2L cases",
        "Prev / Again / Next F2L. Twins share a number: 1R then 1L, then 2R…. No L twin → just 11, 12…. Random jumps once — Next stays in list order. One pair only — the other three stay in.",
        "",
        "CubeHead’s 41: easy inserts → disconnected → corner in slot → edge in slot → connected → both in slot. Sledge is another way on 1R, not its own case."
      ),
    };
  }

  if (cross && targetIn && othersIn) {
    return {
      complete: true,
      case: c,
      hint: hint(
        `${c.id} in`,
        `Stay on ${c.id}, or tap Next for ${info.nextId} (Prev goes back).`,
        "",
        c.note
      ),
    };
  }

  if (cross && dumped.length && !targetIn) {
    return {
      complete: false,
      case: c,
      hint: hint(
        `${c.id} · you popped ${dumped.map((s) => s.id).join(", ")}`,
        "Undo. That pair was already solved — you turned a face the open slot doesn’t use.",
        "Undo",
        c.note
      ),
    };
  }

  return {
    complete: false,
    case: c,
    hint: hint(c.name, c.copy, c.alg, c.note),
  };
}

/** Scramble one standard F2L case (keeps cross + the other three pairs). */
export function scrambleF2L(facelets, mode = "next") {
  const n = F2L_DRILL_CASES.length;
  if (!f2lDrillStarted) {
    f2lDrillStarted = true;
    if (mode === "random") {
      f2lDrillIndex = Math.floor(Math.random() * n);
    } else {
      f2lDrillIndex = 0;
    }
  } else if (mode === "next") {
    // Always CubeHead list order. Random is a one-shot jump, never a Next mode.
    f2lDrillIndex = (f2lDrillIndex + 1) % n;
  } else if (mode === "prev") {
    // Do not wrap past 1R — that jumped to the last case and made later Next look shuffled.
    if (f2lDrillIndex > 0) f2lDrillIndex -= 1;
  } else if (mode === "random") {
    let i = f2lDrillIndex;
    if (n > 1) {
      while (i === f2lDrillIndex) i = Math.floor(Math.random() * n);
    }
    f2lDrillIndex = i;
  }

  const c = F2L_DRILL_CASES[((f2lDrillIndex % n) + n) % n];
  const s = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = s[i];
  applyAlg(facelets, c.setup);
  return c.setup;
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
    title: "How this drill works",
    body: "Each case is one pair. The other three stay in. When it’s in, stay on this ID until you tap Next or Prev. Again = same ID. Next F2L follows 1R, 1L, 2R, 2L… then 11, 12… when there is no left twin. Random jumps once; Next stays in order after that.",
  },
  {
    title: "IDs: R and L share a number",
    body: "R is red–green (front-right). L is green–orange (front-left). Same case → 1R and 1L. No left version → just 11. Sledge is another way for 1R, not a second exercise.",
  },
  {
    title: "Don’t pop a solved pair",
    body: "If a pair is already in, don’t turn the two faces it sits on. That’s the whole F2L leak from your timed solves.",
  },
  {
    title: "Source",
    body: "CubeHead — intuitive solutions for the 41 standard cases: https://www.youtube.com/watch?v=3tYj-9f4dA0 — case order from https://www.cube.academy/intuitive-f2l-algs",
  },
];

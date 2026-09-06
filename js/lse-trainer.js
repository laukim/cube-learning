/**
 * Roux LSE (last six edges) — beginner path:
 * 1) EO — no blue/green on U or D
 * 2) UL + UR
 * 3) M-slice (centres + UF/UB/DF/DB)
 */

import {
  applyAlg,
  applyMove,
  cloneFacelets,
  getFace,
  isSolved,
  solvedFacelets,
  sticker,
} from "./cube.js";
import { invertAlg } from "./alg.js";
import { blocksDone } from "./roux-blocks.js";
import { cmllCornersSolved } from "./cmll-trainer.js";

const HOLD_NOTE = "White on D · use M and U. M follows L (M' is toward you if L' feels familiar).";

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

/** EO: U/D edge stickers are only white or yellow (no F/B colours on U/D). */
export function lseEoDone(facelets) {
  const udEdges = [
    ["U", 1],
    ["U", 3],
    ["U", 5],
    ["U", 7],
    ["D", 1],
    ["D", 7],
  ];
  return udEdges.every(([face, i]) => {
    const c = sticker(facelets, face, i);
    return c === "white" || c === "yellow";
  });
}

export function ulUrDone(facelets) {
  return (
    sticker(facelets, "U", 3) === "yellow" &&
    sticker(facelets, "L", 1) === "orange" &&
    sticker(facelets, "U", 5) === "yellow" &&
    sticker(facelets, "R", 1) === "red"
  );
}

function mCentersDone(facelets) {
  return (
    getFace(facelets, "F")[4] === "blue" &&
    getFace(facelets, "B")[4] === "green" &&
    getFace(facelets, "U")[4] === "yellow" &&
    getFace(facelets, "D")[4] === "white"
  );
}

function mEdgesDone(facelets) {
  return (
    sticker(facelets, "U", 7) === "yellow" &&
    sticker(facelets, "F", 1) === "blue" &&
    sticker(facelets, "U", 1) === "yellow" &&
    sticker(facelets, "B", 1) === "green" &&
    sticker(facelets, "D", 1) === "white" &&
    sticker(facelets, "F", 7) === "blue" &&
    sticker(facelets, "D", 7) === "white" &&
    sticker(facelets, "B", 7) === "green"
  );
}

export function lseComplete(facelets) {
  return isSolved(facelets);
}

function eoHint(facelets) {
  // Count bad edges on U/D
  const bad = [];
  for (const [face, i] of [
    ["U", 1],
    ["U", 3],
    ["U", 5],
    ["U", 7],
    ["D", 1],
    ["D", 7],
  ]) {
    const c = sticker(facelets, face, i);
    if (c !== "white" && c !== "yellow") bad.push(`${face}`);
  }
  return hint(
    "LSE · Edge orientation",
    `Flip bad edges until U and D show only yellow/white on the six LSE edge spots. Common: put two bad edges in UF + UB then M' U M' (or mirror). Bad spots now: ${bad.length}.`,
    "M' U M'   or   M' U' M'",
    HOLD_NOTE + " Tap LSE hint after each attempt."
  );
}

function ulUrHint(facelets) {
  const ulOk =
    sticker(facelets, "U", 3) === "yellow" && sticker(facelets, "L", 1) === "orange";
  const urOk =
    sticker(facelets, "U", 5) === "yellow" && sticker(facelets, "R", 1) === "red";

  if (!ulOk && !urOk) {
    // Try to spot orange on U ring
    return hint(
      "LSE · Place UL & UR",
      "Find the orange–yellow edge and the red–yellow edge. Use M/M'/M2 and U to park orange at UL and red at UR (yellow on top).",
      "M2 U  /  M2 U'  /  U M2 …",
      HOLD_NOTE
    );
  }
  if (!ulOk) {
    return hint(
      "LSE · Place UL",
      "Orange–yellow edge isn’t in UL yet. Slice (M) to bring it to U, then U turns so orange sits on L, yellow on U.",
      "M / M' / U",
      HOLD_NOTE
    );
  }
  return hint(
    "LSE · Place UR",
    "Red–yellow edge isn’t in UR yet. Same idea: M to bring it to U, U to align, M to insert.",
    "M / M' / U",
    HOLD_NOTE
  );
}

function centersHint(facelets) {
  if (!mCentersDone(facelets)) {
    return hint(
      "LSE · Centres",
      "UL/UR are in. Turn M until blue is in front and yellow is on top (white on D). Then finish the four M-slice edges.",
      "M / M' / M2",
      HOLD_NOTE
    );
  }
  if (!mEdgesDone(facelets)) {
    // Check if E2L (all four oriented in slice but permuted)
    return hint(
      "LSE · M-slice edges",
      "Centres look right — cycle UF/UB/DF/DB with M2 and U2. If two edges are swapped, M2 U2 M2 U2 often finishes (or M2 U' M2 U' M2 U' M2).",
      "M2 U2 M2 U2",
      HOLD_NOTE
    );
  }
  // Maybe just U/D misaligned — shouldn't happen if pieces checked
  return hint("LSE · Finish", "One more M or U2 should solve it.", "M / M' / U2", HOLD_NOTE);
}

export function analyzeLse(facelets) {
  if (!blocksDone(facelets) || !cmllCornersSolved(facelets)) {
    return {
      eo: false,
      ulur: false,
      complete: false,
      hint: hint(
        "Finish CMLL first",
        "LSE starts when both blocks and U corners are done.",
        "",
        "FB → SB → CMLL → LSE."
      ),
    };
  }

  if (isSolved(facelets)) {
    return {
      eo: true,
      ulur: true,
      complete: true,
      hint: hint("Solved", "Last six edges done — full Roux solve.", "", ""),
    };
  }

  if (!lseEoDone(facelets)) {
    return { eo: false, ulur: false, complete: false, hint: eoHint(facelets) };
  }

  if (!ulUrDone(facelets)) {
    return { eo: true, ulur: false, complete: false, hint: ulUrHint(facelets) };
  }

  return { eo: true, ulur: true, complete: false, hint: centersHint(facelets) };
}

export const LSE_TIPS = [
  {
    title: "Three mini-steps",
    body: "EO (only yellow/white on U·D) → park UL & UR → fix centres and the four M-slice edges with M and U2.",
  },
  {
    title: "M move",
    body: "M follows the L face: M is like L' on the middle slice. Add M / M' / M2 on the move pad in Roux.",
  },
  {
    title: "Recognition",
    body: "EO is visual: blue or green on U or D means a bad edge. Flip in pairs when you can.",
  },
];

export const LSE_DRILL_CASES = [
  // M/U EO flip that keeps centres + CMLL (unlike a raw M' U M').
  { id: "eo", name: "EO practice", setup: () => "M' U' M U' M' U2 M" },
  { id: "ulur", name: "UL/UR practice", setup: () => invertAlg("M2 U M2 U'") },
  { id: "centers", name: "Centres + slice", setup: () => invertAlg("M2 U2 M2 U2") },
  { id: "full", name: "Mixed LSE", setup: () => invertAlg("M2 U2 M2 U2 M2 U M2 U'") },
];

let lseDrillIndex = 0;
let lseDrillStarted = false;

export function getLseDrillInfo() {
  const n = LSE_DRILL_CASES.length;
  const i = ((lseDrillIndex % n) + n) % n;
  const c = LSE_DRILL_CASES[i];
  return { index: i, total: n, id: c.id, name: c.name, started: lseDrillStarted };
}

export function scrambleLse(facelets, mode = "next") {
  const n = LSE_DRILL_CASES.length;
  if (mode === "again" && lseDrillStarted) {
    /* keep */
  } else if (mode === "next" || !lseDrillStarted) {
    if (lseDrillStarted) lseDrillIndex = (lseDrillIndex + 1) % n;
    lseDrillStarted = true;
  }
  const i = ((lseDrillIndex % n) + n) % n;
  const setup = LSE_DRILL_CASES[i].setup();
  const src = solvedFacelets();
  for (let j = 0; j < 54; j++) facelets[j] = src[j];
  applyAlg(facelets, setup);
  return setup;
}

/** Progress chips for the LSE panel. */
export function lseProgress(facelets) {
  const eo = lseEoDone(facelets);
  const ulur = eo && ulUrDone(facelets);
  const done = isSolved(facelets);
  return [
    { id: "eo", label: "EO", done: eo },
    { id: "ulur", label: "UL/UR", done: ulur },
    { id: "slice", label: "M-slice", done },
  ];
}

/**
 * Roux first / second block detection.
 * Convention: white on D, yellow on U, orange L / red R (Western).
 * FB = left 1×2×3 · SB = right 1×2×3.
 */

import { applyAlg, getFace, solvedFacelets, sticker } from "./cube.js";

function hint(title, copy, alg, note = "") {
  return { title, copy, alg, note };
}

/** Left block pieces in place (ignore everything else). */
export function firstBlockDone(facelets) {
  return (
    sticker(facelets, "D", 3) === "white" &&
    sticker(facelets, "L", 7) === "orange" &&
    sticker(facelets, "F", 3) === "blue" &&
    sticker(facelets, "L", 5) === "orange" &&
    sticker(facelets, "B", 5) === "green" &&
    sticker(facelets, "L", 3) === "orange" &&
    sticker(facelets, "D", 0) === "white" &&
    sticker(facelets, "F", 6) === "blue" &&
    sticker(facelets, "L", 8) === "orange" &&
    sticker(facelets, "D", 6) === "white" &&
    sticker(facelets, "B", 8) === "green" &&
    sticker(facelets, "L", 6) === "orange"
  );
}

/** Right block pieces in place. */
export function secondBlockDone(facelets) {
  return (
    sticker(facelets, "D", 5) === "white" &&
    sticker(facelets, "R", 7) === "red" &&
    sticker(facelets, "F", 5) === "blue" &&
    sticker(facelets, "R", 3) === "red" &&
    sticker(facelets, "B", 3) === "green" &&
    sticker(facelets, "R", 5) === "red" &&
    sticker(facelets, "D", 2) === "white" &&
    sticker(facelets, "F", 8) === "blue" &&
    sticker(facelets, "R", 6) === "red" &&
    sticker(facelets, "D", 8) === "white" &&
    sticker(facelets, "B", 6) === "green" &&
    sticker(facelets, "R", 8) === "red"
  );
}

export function blocksDone(facelets) {
  return firstBlockDone(facelets) && secondBlockDone(facelets);
}

const FB_CHECKS = [
  { id: "DL", label: "DL edge (white–orange)", ok: (f) => sticker(f, "D", 3) === "white" && sticker(f, "L", 7) === "orange" },
  { id: "FL", label: "FL edge (blue–orange)", ok: (f) => sticker(f, "F", 3) === "blue" && sticker(f, "L", 5) === "orange" },
  { id: "BL", label: "BL edge (green–orange)", ok: (f) => sticker(f, "B", 5) === "green" && sticker(f, "L", 3) === "orange" },
  { id: "DFL", label: "DFL corner", ok: (f) => sticker(f, "D", 0) === "white" && sticker(f, "F", 6) === "blue" && sticker(f, "L", 8) === "orange" },
  { id: "DBL", label: "DBL corner", ok: (f) => sticker(f, "D", 6) === "white" && sticker(f, "B", 8) === "green" && sticker(f, "L", 6) === "orange" },
];

const SB_CHECKS = [
  { id: "DR", label: "DR edge (white–red)", ok: (f) => sticker(f, "D", 5) === "white" && sticker(f, "R", 7) === "red" },
  { id: "FR", label: "FR edge (blue–red)", ok: (f) => sticker(f, "F", 5) === "blue" && sticker(f, "R", 3) === "red" },
  { id: "BR", label: "BR edge (green–red)", ok: (f) => sticker(f, "B", 3) === "green" && sticker(f, "R", 5) === "red" },
  { id: "DFR", label: "DFR corner", ok: (f) => sticker(f, "D", 2) === "white" && sticker(f, "F", 8) === "blue" && sticker(f, "R", 6) === "red" },
  { id: "DBR", label: "DBR corner", ok: (f) => sticker(f, "D", 8) === "white" && sticker(f, "B", 6) === "green" && sticker(f, "R", 8) === "red" },
];

export function fbProgress(facelets) {
  return FB_CHECKS.map((c) => ({ id: c.id, label: c.label, done: c.ok(facelets) }));
}

export function sbProgress(facelets) {
  return SB_CHECKS.map((c) => ({ id: c.id, label: c.label, done: c.ok(facelets) }));
}

export function analyzeFirstBlock(facelets) {
  const progress = fbProgress(facelets);
  const done = progress.every((p) => p.done);
  if (done) {
    return {
      complete: true,
      progress,
      hint: hint(
        "First block done",
        "Left 1×2×3 is solid. Build the matching right block without breaking this one.",
        "",
        "Orange L face should look solved on the bottom two rows."
      ),
    };
  }
  const next = progress.find((p) => !p.done);
  const placed = progress.filter((p) => p.done).length;
  return {
    complete: false,
    progress,
    hint: hint(
      `First block · ${next.label}`,
      placed === 0
        ? "Build a 1×2×3 on the LEFT: orange centre + white–orange DL edge + blue–orange and green–orange sides + the two white–orange corners on D."
        : `${placed}/5 pieces in. Next: get ${next.label} into the left block without popping pieces you already placed.`,
      "R U R' / L' U' L / M … (intuitive)",
      "Square first (two corners + DL), then insert the two side edges. Keep white on D."
    ),
  };
}

export function analyzeSecondBlock(facelets) {
  if (!firstBlockDone(facelets)) {
    return {
      complete: false,
      progress: sbProgress(facelets),
      hint: hint(
        "Finish first block first",
        "Second block assumes the left 1×2×3 is done. Switch to FB or keep building the left side.",
        "",
        "FB → SB → CMLL → LSE."
      ),
    };
  }
  const progress = sbProgress(facelets);
  const done = progress.every((p) => p.done);
  if (done) {
    return {
      complete: true,
      progress,
      hint: hint(
        "Second block done",
        "Both blocks are in. Corners of the U layer next — CMLL.",
        "",
        "Only U corners + six edges remain."
      ),
    };
  }
  const next = progress.find((p) => !p.done);
  const placed = progress.filter((p) => p.done).length;
  return {
    complete: false,
    progress,
    hint: hint(
      `Second block · ${next.label}`,
      placed === 0
        ? "Mirror of FB on the RIGHT: red centre + white–red DR + blue–red / green–red sides + two white–red corners. Protect the left block."
        : `${placed}/5 pieces in. Next: ${next.label}. Prefer R/U inserts that don’t destroy the left block.`,
      "R U R' / U R U' R' … (intuitive)",
      "Same idea as F2L pairing, but you are finishing a whole right 1×2×3."
    ),
  };
}

export const FB_TIPS = [
  {
    title: "What is a first block?",
    body: "A 1×2×3 on the left: orange centre, DL edge, FL + BL edges, and the two D corners that touch L. Not a white cross — only the left half of the bottom.",
  },
  {
    title: "Build order",
    body: "Many people make a 1×2×2 square (DL + two corners) then insert FL/BL. Others pair a corner+edge and attach. Either is fine — protect what you finish.",
  },
  {
    title: "Inspection",
    body: "Plan the left square in inspection when you can. Roux rewards looking ahead to the second block while you insert the last FB pieces.",
  },
];

export const SB_TIPS = [
  {
    title: "Second block = right 1×2×3",
    body: "Same shape as FB, on red. You already know pairing from CFOP F2L — here you leave the M-slice free and never break the left block.",
  },
  {
    title: "Don’t close the M-slice",
    body: "DF / DB stay free for LSE. Solve DR + the two right corners + FR/BR only.",
  },
  {
    title: "Stuck?",
    body: "Take the right pair out to U, pair with R/U, insert. If the left block pops, undo and use a different insert.",
  },
];

/** Scramble that leaves a mostly-broken FB. Returns the setup alg. */
export function scrambleFb(facelets) {
  const src = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = src[i];
  const alg = "R U R' U' F' U F L' U' L U M' U M U2 R U2 R'";
  applyAlg(facelets, alg);
  return alg;
}

/** FB intact, SB broken. Returns the setup alg. */
export function scrambleSb(facelets) {
  const src = solvedFacelets();
  for (let i = 0; i < 54; i++) facelets[i] = src[i];
  // Peel the right block into U while leaving the left 1×2×3 alone.
  const alg = "R U' R' U R U R' U' R' F R F'";
  applyAlg(facelets, alg);
  return alg;
}

/** True when L/R centres show on L/R (always) — helper for UI. */
export function blockCentersOk(facelets) {
  return getFace(facelets, "L")[4] === "orange" && getFace(facelets, "R")[4] === "red";
}

/**
 * Track progress through a hinted alg as the user turns faces.
 * R2 is satisfied by one R2 or by R then R (same for other doubles).
 */

function normalizeToken(tok) {
  const t = String(tok || "").trim();
  if (!t || t.includes("…")) return null;
  const face = t[0];
  if (!face || !"URFDLBurfdlbxyzXYZ".includes(face)) return null;
  let rest = t.slice(1);
  if (rest === "3") rest = "'";
  if (rest && rest !== "'" && rest !== "2") return null;
  const base = "xyzXYZ".includes(face) ? face.toLowerCase() : face.toUpperCase();
  return base + rest;
}

/** Expand alg / move into quarter turns: R2 → [R,R], R' → [R'], R → [R] */
export function toAtomics(algOrMove) {
  const parts = String(algOrMove || "")
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
  const out = [];
  for (const t of parts) {
    const face = t[0];
    const rest = t.slice(1);
    if (rest === "2") {
      out.push(face, face);
    } else {
      out.push(t);
    }
  }
  return out;
}

function invertAtomic(a) {
  if (a.endsWith("'")) return a.slice(0, -1);
  return `${a}'`;
}

/** Compress atomics back to readable alg: R R → R2, R R' cancel */
export function fromAtomics(atomics) {
  const stack = [];
  for (const a of atomics) {
    const prev = stack[stack.length - 1];
    if (!prev) {
      stack.push(a);
      continue;
    }
    const pf = prev.replace("'", "");
    const af = a.replace("'", "");
    if (pf !== af) {
      stack.push(a);
      continue;
    }
    const pPrime = prev.endsWith("'");
    const aPrime = a.endsWith("'");
    if (pPrime === aPrime) {
      // R R → R2; R' R' → R2
      stack.pop();
      stack.push(`${pf}2`);
    } else {
      // R R' cancel
      stack.pop();
    }
  }
  // Merge adjacent doubles of same face if any leftover oddities — enough for display
  return stack.join(" ");
}

/**
 * Consume a user move from the front of remaining alg.
 * @returns {{ remaining: string, matched: boolean }}
 */
export function consumeAlgMove(remainingAlg, userMove) {
  const rem = toAtomics(remainingAlg);
  const user = toAtomics(userMove);
  if (!rem.length || !user.length) {
    return { remaining: remainingAlg || "", matched: false };
  }
  if (user.length > rem.length) {
    return { remaining: fromAtomics(rem), matched: false };
  }
  for (let i = 0; i < user.length; i++) {
    if (user[i] !== rem[i]) {
      return { remaining: fromAtomics(rem), matched: false };
    }
  }
  return { remaining: fromAtomics(rem.slice(user.length)), matched: true };
}

/**
 * After undo, put the undone move back on the front of remaining.
 * `undoTwist` is the move ERNO just applied (the inverse of what the user did).
 */
export function restoreAlgMove(remainingAlg, undoTwist) {
  const inv = toAtomics(undoTwist).map(invertAtomic);
  return fromAtomics([...inv, ...toAtomics(remainingAlg)]);
}

export function initAlgProgress(alg) {
  const clean = String(alg || "")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !t.includes("…"))
    .join(" ");
  return { fullAlg: clean, remaining: clean };
}

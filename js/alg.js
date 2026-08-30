/** Shared alg helpers (no cube state). */

const WIDE = {
  r: "R M'",
  "r'": "M R'",
  r2: "R2 M2",
  "r2'": "R2 M2",
  f: "F S",
  "f'": "S' F'",
  f2: "F2 S2",
  "f2'": "F2 S2",
  l: "L M",
  "l'": "M' L'",
  l2: "L2 M2",
  b: "B S'",
  "b'": "S B'",
  b2: "B2 S2",
};

export function expandWideAlg(alg) {
  return String(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((tok) => {
      const key = tok.toLowerCase();
      if (tok[0] === tok[0].toLowerCase() && WIDE[key]) {
        return WIDE[key].split(/\s+/);
      }
      return [tok];
    })
    .join(" ");
}

function invertMove(move) {
  const m = String(move).trim();
  if (!m) return "";
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return `${m}'`;
}

export function invertAlg(alg) {
  return expandWideAlg(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map(invertMove)
    .join(" ");
}

const LR = {
  R: "L'",
  "R'": "L",
  R2: "L2",
  L: "R'",
  "L'": "R",
  L2: "R2",
  U: "U'",
  "U'": "U",
  U2: "U2",
  D: "D'",
  "D'": "D",
  D2: "D2",
  F: "F'",
  "F'": "F",
  F2: "F2",
  B: "B'",
  "B'": "B",
  B2: "B2",
  y: "y'",
  "y'": "y",
  y2: "y2",
  x: "x'",
  "x'": "x",
  x2: "x2",
  z: "z",
  "z'": "z'",
  z2: "z2",
  M: "M'",
  "M'": "M",
  M2: "M2",
  S: "S'",
  "S'": "S",
  S2: "S2",
  E: "E'",
  "E'": "E",
  E2: "E2",
};

function mirrorMove(move) {
  const m = String(move).trim();
  if (LR[m]) return LR[m];
  const low = m[0] === m[0].toLowerCase() ? m : null;
  if (low && LR[m.toUpperCase()]) {
    const mir = LR[m.toUpperCase()];
    return mir[0].toLowerCase() + mir.slice(1);
  }
  return m;
}

/** Left–right mirror: FR R/U solutions become FL L/U. */
export function mirrorLRAlg(alg) {
  return expandWideAlg(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(mirrorMove)
    .join(" ");
}

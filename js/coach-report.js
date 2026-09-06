import { toAtomics } from "./alg-progress.js?v=2look3";

/** Longest first so T-perm is not counted as a righty + leftovers. */
export const COACH_ALGS = [
  { name: "Y-perm", alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { name: "T-perm", alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { name: "Pi", alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { name: "H-OLL", alg: "R U R' U R U' R' U R U2 R'" },
  { name: "Bowtie", alg: "F' r U R' U' r' F R" },
  { name: "T-OLL", alg: "r U R' U' r' F R F'" },
  { name: "U-OLL", alg: "R2 D R' U2 R D' R' U2 R'" },
  { name: "Z-perm", alg: "M' U' M2 U' M2 U' M' U2 M2" },
  { name: "H-perm", alg: "M2 U' M2 U2 M2 U' M2" },
  { name: "Ua", alg: "R2 U' R' U' R U R U R U' R" },
  { name: "Ub", alg: "R' U R' U' R' U' R' U R U R2" },
  { name: "Sune", alg: "R U R' U R U2 R'" },
  { name: "Anti-Sune", alg: "R U2 R' U' R U' R'" },
  { name: "OLL-L", alg: "f R U R' U' f'" },
  { name: "OLL-cross", alg: "F R U R' U' F'" },
  { name: "righty", alg: "R U R' U'" },
  { name: "lefty", alg: "L' U' L U" },
];

const PREP = COACH_ALGS.map((a) => ({
  name: a.name,
  atoms: toAtomics(a.alg),
})).sort((a, b) => b.atoms.length - a.atoms.length);

function atomsMatchAt(hay, i, needle) {
  if (i + needle.length > hay.length) return false;
  for (let k = 0; k < needle.length; k++) {
    if (hay[i + k] !== needle[k]) return false;
  }
  return true;
}

/** Greedy named-alg counts in a move string (Singmaster tokens). */
export function countNamedAlgs(moveStr) {
  const hay = toAtomics(moveStr);
  const counts = {};
  let i = 0;
  while (i < hay.length) {
    let hit = null;
    for (const alg of PREP) {
      if (atomsMatchAt(hay, i, alg.atoms)) {
        hit = alg;
        break;
      }
    }
    if (hit) {
      counts[hit.name] = (counts[hit.name] || 0) + 1;
      i += hit.atoms.length;
    } else {
      i += 1;
    }
  }
  return counts;
}

export function countYTurns(moveStr) {
  return String(moveStr || "")
    .trim()
    .split(/\s+/)
    .filter((m) => /^y2?$|^y'$/i.test(m)).length;
}

export function formatAlgCounts(counts, yTurns = 0) {
  const parts = [];
  for (const a of COACH_ALGS) {
    const n = counts[a.name] || 0;
    if (n) parts.push(`${a.name}×${n}`);
  }
  if (yTurns) parts.push(`y×${yTurns}`);
  return parts.join(" ");
}

/** Facelet helpers on top of vendored cubejs (global Cube). */

export const COLORS = {
  U: "yellow",
  D: "white",
  F: "green",
  B: "blue",
  L: "orange",
  R: "red",
};

export const COLOR_HEX = {
  white: "#f7f7f7",
  yellow: "#ffd500",
  green: "#0b9e4a",
  blue: "#0b5fbf",
  orange: "#ff6a00",
  red: "#c41e3a",
};

export const FACES = ["U", "R", "F", "D", "L", "B"];

const LETTER_FROM_COLOR = {
  yellow: "U",
  white: "D",
  green: "F",
  blue: "B",
  orange: "L",
  red: "R",
};

const COLOR_FROM_LETTER = {
  U: "yellow",
  D: "white",
  F: "green",
  B: "blue",
  L: "orange",
  R: "red",
};

function getCube() {
  const C = typeof globalThis !== "undefined" ? globalThis.Cube : null;
  if (!C) throw new Error("Cubejs failed to load");
  return C;
}

export function faceletsToString(facelets) {
  return facelets.map((c) => LETTER_FROM_COLOR[c]).join("");
}

export function stringToFacelets(str) {
  return str.split("").map((ch) => COLOR_FROM_LETTER[ch]);
}

export function solvedFacelets() {
  return stringToFacelets(getCube().fromString("UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB").asString());
}

export function cloneFacelets(f) {
  return f.slice();
}

export function applyMove(facelets, move) {
  const Cube = getCube();
  const cube = Cube.fromString(faceletsToString(facelets));
  const m = normalizeCubejsMove(move.trim());
  if (!m) return facelets;
  cube.move(m);
  const next = stringToFacelets(cube.asString());
  for (let i = 0; i < 54; i++) facelets[i] = next[i];
  return facelets;
}

/** cubejs uses lowercase x/y/z; ERNO emits uppercase X/Y/Z. */
function normalizeCubejsMove(move) {
  if (!move) return "";
  const face = move[0];
  const rest = move.slice(1);
  if ("xyzXYZ".includes(face)) return face.toLowerCase() + rest;
  return move;
}

export function applyAlg(facelets, alg) {
  const Cube = getCube();
  const cube = Cube.fromString(faceletsToString(facelets));
  cube.move(alg);
  const next = stringToFacelets(cube.asString());
  for (let i = 0; i < 54; i++) facelets[i] = next[i];
  return facelets;
}

export function parseAlg(alg) {
  return String(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function scrambleLastLayer(facelets, count = 12) {
  const clean = [
    "R U R' U R U2 R'",
    "R U2 R' U' R U' R'",
    "F R U R' U' F'",
    "F U R U' R' F'",
    "R U R' U' R' F R F'",
    "R' F R' B2 R F' R' B2 R2",
    "R2 B2 R F R' B2 R F' R",
    "R2 U R U R' U' R' U' R' U R'",
    "R U' R U R U R U' R' U' R2",
    "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  ];
  const auf = ["U", "U'", "U2"];
  let last = -1;
  for (let i = 0; i < count; i++) {
    let idx = Math.floor(Math.random() * clean.length);
    if (idx === last) idx = (idx + 1) % clean.length;
    applyAlg(facelets, clean[idx]);
    applyAlg(facelets, auf[Math.floor(Math.random() * auf.length)]);
    last = idx;
  }
  return facelets;
}

/** Full-cube scramble (all layers). Returns the alg string applied. */
export function scrambleCube(facelets, moves = 25) {
  const faces = ["U", "D", "R", "L", "F", "B"];
  const suffixes = ["", "'", "2"];
  const parts = [];
  let lastFace = "";
  for (let i = 0; i < moves; i++) {
    let face = faces[Math.floor(Math.random() * faces.length)];
    while (face === lastFace) face = faces[Math.floor(Math.random() * faces.length)];
    const move = face + suffixes[Math.floor(Math.random() * suffixes.length)];
    applyMove(facelets, move);
    parts.push(move);
    lastFace = face;
  }
  return parts.join(" ");
}

export function isSolved(facelets) {
  for (let f = 0; f < 6; f++) {
    const c = facelets[f * 9 + 4];
    for (let i = 0; i < 9; i++) if (facelets[f * 9 + i] !== c) return false;
  }
  return true;
}

export function getFace(facelets, face) {
  const idx = FACES.indexOf(face);
  return facelets.slice(idx * 9, idx * 9 + 9);
}

export function setFacelet(facelets, face, i, color) {
  const idx = FACES.indexOf(face);
  facelets[idx * 9 + i] = color;
}

export function sticker(facelets, face, i) {
  return getFace(facelets, face)[i];
}

export const LL = {
  U_EDGES: [1, 5, 7, 3],
  U_CORNERS: [0, 2, 8, 6],
  EDGE_SIDES: [
    { face: "B", i: 1 },
    { face: "R", i: 1 },
    { face: "F", i: 1 },
    { face: "L", i: 1 },
  ],
  CORNER_SIDES: [
    [
      { face: "L", i: 0 },
      { face: "B", i: 2 },
    ],
    [
      { face: "B", i: 0 },
      { face: "R", i: 2 },
    ],
    [
      { face: "R", i: 0 },
      { face: "F", i: 2 },
    ],
    [
      { face: "F", i: 0 },
      { face: "L", i: 2 },
    ],
  ],
};

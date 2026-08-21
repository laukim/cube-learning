/**
 * Cubie mesh + queued turn animations.
 * Positions: x right, y up, z toward camera (F).
 * Axes: U/D → Y, R/L → X, F/B → Z.
 */

import { COLOR_HEX, FACES } from "./cube.js";

const AXIS = {
  U: "Y",
  D: "Y",
  R: "X",
  L: "X",
  F: "Z",
  B: "Z",
};

/** Degrees to rotate the layer group for one CW quarter-turn (looking at that face). */
const CW_DEG = {
  U: -90, // from above
  D: 90, // from below → opposite sign on shared Y
  R: -90, // from right
  L: 90,
  F: -90, // from front
  B: 90,
};

function parseMove(move) {
  const m = String(move).trim();
  if (!m) return null;
  // whole-cube rotations — animate separately
  if (m[0] === "x" || m[0] === "y" || m[0] === "z") {
    const face = m[0];
    const suf = m.slice(1);
    const turns = suf === "2" ? 2 : suf === "'" ? -1 : 1;
    return { type: "cube", face, turns };
  }
  const face = m[0];
  if (!"UDRLFB".includes(face)) return null;
  const suf = m.slice(1);
  const turns = suf === "2" ? 2 : suf === "'" || suf === "3" ? -1 : 1;
  return { type: "layer", face, turns };
}

function cubiesInLayer(face) {
  const list = [];
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        if (x === 0 && y === 0 && z === 0) continue;
        let ok = false;
        if (face === "U" && y === 1) ok = true;
        if (face === "D" && y === -1) ok = true;
        if (face === "R" && x === 1) ok = true;
        if (face === "L" && x === -1) ok = true;
        if (face === "F" && z === 1) ok = true;
        if (face === "B" && z === -1) ok = true;
        if (ok) list.push({ x, y, z, key: `${x},${y},${z}` });
      }
    }
  }
  return list;
}

/** Map cubie slot + local face → facelet index in URFDLB string order. */
function faceletIndex(x, y, z, stickerFace) {
  const faceStart = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 }[stickerFace];
  let row;
  let col;
  if (stickerFace === "U") {
    // F at bottom of U diagram (cubejs)
    row = z + 1;
    col = x + 1;
  } else if (stickerFace === "D") {
    // F at top of D diagram
    row = 1 - z;
    col = x + 1;
  } else if (stickerFace === "F") {
    row = 1 - y;
    col = x + 1;
  } else if (stickerFace === "B") {
    row = 1 - y;
    col = 1 - x;
  } else if (stickerFace === "R") {
    row = 1 - y;
    col = 1 - z;
  } else if (stickerFace === "L") {
    row = 1 - y;
    col = z + 1;
  }
  return faceStart + row * 3 + col;
}

function stickersForCubie(x, y, z) {
  const s = [];
  if (y === 1) s.push("U");
  if (y === -1) s.push("D");
  if (x === 1) s.push("R");
  if (x === -1) s.push("L");
  if (z === 1) s.push("F");
  if (z === -1) s.push("B");
  return s;
}

export function createCubieCube(cubeEl) {
  const state = {
    size: 110,
    cubies: new Map(), // key -> element
    busy: false,
    queue: [],
    duration: 280,
  };

  function gap() {
    return state.size * 0.72;
  }

  function rebuild(facelets) {
    cubeEl.innerHTML = "";
    state.cubies.clear();
    const g = gap();
    const cubiePx = Math.round(g * 0.88);
    const half = cubiePx / 2;
    cubeEl.style.setProperty("--cubie", `${cubiePx}px`);
    cubeEl.style.setProperty("--cubie-half", `${half}px`);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const key = `${x},${y},${z}`;
          const cubie = document.createElement("div");
          cubie.className = "cubie";
          cubie.dataset.key = key;
          cubie.dataset.x = String(x);
          cubie.dataset.y = String(y);
          cubie.dataset.z = String(z);
          cubie.style.width = `${cubiePx}px`;
          cubie.style.height = `${cubiePx}px`;
          cubie.style.left = `${-half}px`;
          cubie.style.top = `${-half}px`;
          cubie.style.transform = `translate3d(${x * g}px, ${-y * g}px, ${z * g}px)`;

          // Black plastic body so gaps read as cube plastic, not empty space
          for (const pf of ["U", "D", "F", "B", "L", "R"]) {
            const plastic = document.createElement("div");
            plastic.className = `cubie-plastic cubie-plastic-${pf}`;
            plastic.style.setProperty("--z", `${half - 0.5}px`);
            cubie.appendChild(plastic);
          }

          for (const sf of stickersForCubie(x, y, z)) {
            const sticker = document.createElement("div");
            sticker.className = `cubie-sticker cubie-sticker-${sf}`;
            sticker.dataset.face = sf;
            sticker.dataset.x = String(x);
            sticker.dataset.y = String(y);
            sticker.dataset.z = String(z);
            sticker.style.setProperty("--z", `${half + 0.5}px`);
            const idx = faceletIndex(x, y, z, sf);
            sticker.style.background = COLOR_HEX[facelets[idx]] || "#333";
            cubie.appendChild(sticker);
          }
          cubeEl.appendChild(cubie);
          state.cubies.set(key, cubie);
        }
      }
    }
  }

  function setSize(px) {
    state.size = px;
  }

  function paint(facelets) {
    for (const [key, cubie] of state.cubies) {
      const [x, y, z] = key.split(",").map(Number);
      cubie.querySelectorAll(".cubie-sticker").forEach((sticker) => {
        const sf = sticker.dataset.face;
        if (!sf) return;
        const idx = faceletIndex(x, y, z, sf);
        sticker.style.background = COLOR_HEX[facelets[idx]] || "#333";
      });
    }
  }

  function animateLayer(face, turns, onDone) {
    const abs = Math.abs(turns) || 1;
    const dir = turns < 0 ? -1 : 1;
    const degEach = CW_DEG[face] * dir;
    const totalDeg = degEach * (abs === 2 ? 2 : 1);
    const axis = AXIS[face];
    const layer = cubiesInLayer(face);
    const g = gap();

    const group = document.createElement("div");
    group.className = "turn-group";
    group.style.transformStyle = "preserve-3d";
    cubeEl.appendChild(group);

    const nodes = [];
    for (const c of layer) {
      const el = state.cubies.get(c.key);
      if (!el) continue;
      // move into group while preserving world position
      const wx = c.x * g;
      const wy = -c.y * g;
      const wz = c.z * g;
      el.style.transform = `translate3d(${wx}px, ${wy}px, ${wz}px)`;
      group.appendChild(el);
      nodes.push({ el, c });
    }

    const rot =
      axis === "X" ? `rotateX(${totalDeg}deg)` : axis === "Y" ? `rotateY(${totalDeg}deg)` : `rotateZ(${totalDeg}deg)`;

    // force layout then transition
    void group.offsetWidth;
    group.style.transition = `transform ${state.duration * (abs === 2 ? 1.35 : 1)}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    group.style.transform = rot;

    const ms = state.duration * (abs === 2 ? 1.35 : 1);
    window.setTimeout(() => {
      // cleanup — caller will rebuild from facelets
      group.remove();
      onDone?.();
    }, ms + 20);
  }

  function animateCubeRot(face, turns, onDone) {
    // Visual only: spin whole cube mesh; logical state applied by caller
    const map = { x: "X", y: "Y", z: "Z" };
    const axis = map[face];
    const dir = turns < 0 ? -1 : 1;
    const abs = Math.abs(turns) || 1;
    // Match cubejs: x is like R on whole cube
    const base = face === "x" ? -90 : face === "y" ? -90 : -90;
    const total = base * dir * (abs === 2 ? 2 : 1);
    const rot =
      axis === "X" ? `rotateX(${total}deg)` : axis === "Y" ? `rotateY(${total}deg)` : `rotateZ(${total}deg)`;

    const kids = [...cubeEl.children];
    const group = document.createElement("div");
    group.className = "turn-group";
    group.style.transformStyle = "preserve-3d";
    kids.forEach((k) => group.appendChild(k));
    cubeEl.appendChild(group);
    void group.offsetWidth;
    group.style.transition = `transform ${state.duration * (abs === 2 ? 1.35 : 1)}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
    group.style.transform = rot;
    const ms = state.duration * (abs === 2 ? 1.35 : 1);
    window.setTimeout(() => {
      group.remove();
      onDone?.();
    }, ms + 20);
  }

  /**
   * Preview a fractional layer turn while sliding (degrees, not committed).
   * face + signed degrees (CW positive looking at face, using CW_DEG sign convention).
   */
  function previewLayer(face, degrees) {
    const axis = AXIS[face];
    const g = gap();
    let group = state.previewGroup;
    if (group && group.dataset.preview === face) {
      const sign = Math.sign(CW_DEG[face]) || -1;
      const cssDeg = degrees * sign;
      const rot =
        axis === "X" ? `rotateX(${cssDeg}deg)` : axis === "Y" ? `rotateY(${cssDeg}deg)` : `rotateZ(${cssDeg}deg)`;
      group.style.transition = "none";
      group.style.transform = rot;
      return;
    }
    clearPreview();
    const layer = cubiesInLayer(face);
    group = document.createElement("div");
    group.className = "turn-group turn-preview";
    group.style.transformStyle = "preserve-3d";
    group.dataset.preview = face;
    cubeEl.appendChild(group);
    for (const c of layer) {
      const el = state.cubies.get(c.key);
      if (!el) continue;
      el.style.transform = `translate3d(${c.x * g}px, ${-c.y * g}px, ${c.z * g}px)`;
      group.appendChild(el);
    }
    const sign = Math.sign(CW_DEG[face]) || -1;
    const cssDeg = degrees * sign;
    const rot =
      axis === "X" ? `rotateX(${cssDeg}deg)` : axis === "Y" ? `rotateY(${cssDeg}deg)` : `rotateZ(${cssDeg}deg)`;
    group.style.transform = rot;
    state.previewGroup = group;
  }

  function clearPreview() {
    const g = state.previewGroup || cubeEl.querySelector(".turn-preview");
    if (!g) return;
    // put cubies back
    const gGap = gap();
    [...g.querySelectorAll(".cubie")].forEach((el) => {
      const x = Number(el.dataset.x);
      const y = Number(el.dataset.y);
      const z = Number(el.dataset.z);
      el.style.transform = `translate3d(${x * gGap}px, ${-y * gGap}px, ${z * gGap}px)`;
      cubeEl.appendChild(el);
    });
    g.remove();
    state.previewGroup = null;
  }

  return {
    state,
    rebuild,
    paint,
    setSize,
    animateLayer,
    animateCubeRot,
    previewLayer,
    clearPreview,
    parseMove,
  };
}

export { parseMove, CW_DEG };

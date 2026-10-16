import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");
globalThis.window = globalThis;

class StyleMap {
  setProperty(name, value) {
    this[name] = String(value);
  }
}

class El {
  constructor() {
    this.className = "";
    this.dataset = {};
    this.style = new StyleMap();
    this.children = [];
    this.parent = null;
  }

  get parentElement() {
    return this.parent;
  }

  appendChild(child) {
    if (child.parent) child.parent.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((node) => node !== child);
    child.parent = null;
  }

  remove() {
    this.parent?.removeChild(this);
  }

  set innerHTML(value) {
    if (value === "") {
      for (const child of this.children) child.parent = null;
      this.children = [];
    }
  }

  get offsetWidth() {
    return 12;
  }

  querySelectorAll(selector) {
    const found = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (child.className.split(/\s+/).includes(selector.slice(1))) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

globalThis.document = {
  createElement() {
    return new El();
  },
};

const { createCubeMirror } = await import("../js/cube-mirror.js?v=cube3d1");
const { faceletIndex } = await import("../js/cubie-view.js?v=cube3d1");

const SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
const HEX = {
  "#ffd500": "U",
  "#c41e3a": "R",
  "#0b9e4a": "F",
  "#f7f7f7": "D",
  "#ff6a00": "L",
  "#0b5fbf": "B",
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function applied(start, alg) {
  const cube = globalThis.Cube.fromString(start);
  if (alg) cube.move(alg);
  return cube.asString();
}

function painted(root) {
  const letters = Array(54).fill("?");
  for (const sticker of root.querySelectorAll(".cubie-sticker")) {
    const idx = faceletIndex(
      Number(sticker.dataset.x),
      Number(sticker.dataset.y),
      Number(sticker.dataset.z),
      sticker.dataset.face
    );
    letters[idx] = HEX[sticker.style.background] || "?";
  }
  return letters.join("");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const solvedRoot = new El();
const solved = createCubeMirror(solvedRoot, { reducedMotion: true });
solved.setFacelets(SOLVED);
assert(solved.facelets() === SOLVED, "a solved snapshot shows a solved cube");
assert(painted(solvedRoot) === SOLVED, "solved stickers use the coach colours");

const root = new El();
const mirror = createCubeMirror(root, { reducedMotion: true });
mirror.setFacelets(SOLVED);
mirror.turn("R");
assert(mirror.facelets() === applied(SOLVED, "R"), "R on the mirror matches cubejs");
assert(painted(root) === applied(SOLVED, "R"), "R repaints the cubie stickers");

for (const move of ["U", "D'", "R2", "L", "F'", "B"]) mirror.turn(move);
const alg = "R U D' R2 L F' B";
assert(mirror.facelets() === applied(SOLVED, alg), "a string of turns stays aligned with cubejs");
assert(painted(root) === mirror.facelets(), "the mesh matches the logical facelets");
assert(!painted(root).includes("?"), "every sticker has a coach colour");

mirror.setFacelets(SOLVED);
assert(mirror.facelets() === SOLVED && painted(root) === SOLVED, "a new snapshot replaces the turned cube");
mirror.turn("nope");
assert(mirror.facelets() === SOLVED, "a junk turn does not change the cube");

const animatedRoot = new El();
const animated = createCubeMirror(animatedRoot, { duration: 15 });
animated.setFacelets(SOLVED);
animated.turn("U");
animated.turn("R");
animated.turn("U'");
animated.turn("R'");
await wait(90);
assert(animated.facelets() === applied(SOLVED, "U R U' R'"), "queued turns catch up to the same facelets");
assert(painted(animatedRoot) === animated.facelets(), "the mesh catches up after the animation");

console.log("cube mirror ok");

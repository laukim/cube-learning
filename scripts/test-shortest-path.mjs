import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const { applyAlg, isSolved, solvedFacelets } = await import("../js/cube.js");
const { invertAlgNotation } = await import("../js/alg.js");
const {
  HTM_MOVE_NAMES,
  PATH_LENGTHS,
  positionLetters,
  randomHtmScramble,
  shortestPath,
} = await import("../js/shortest-path.js");

const { createRingModel, permForMove } = await import("../js/path-game.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOLVED_LETTERS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

function solves(scramble, moves) {
  const facelets = solvedFacelets();
  const alg = [scramble, ...moves].filter(Boolean).join(" ");
  if (alg) applyAlg(facelets, alg);
  return isSolved(facelets);
}

function cubeLetters(alg) {
  const cube = new Cube();
  if (alg) cube.move(alg);
  return cube.asString();
}

function cubeBall(scramble, radius) {
  const start = new Cube();
  if (scramble) start.move(scramble);
  const seen = new Set([start.asString()]);
  let layer = [start];
  for (let depth = 0; depth < radius; depth++) {
    const next = [];
    for (const cube of layer) {
      for (const name of HTM_MOVE_NAMES) {
        const child = cube.clone();
        child.move(name);
        const key = child.asString();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(child);
      }
    }
    layer = next;
  }
  return seen.size;
}

assert(positionLetters("") === SOLVED_LETTERS, "solved letters");
assert(positionLetters("") === cubeLetters(""), "identity matches cubejs");

const modelAlgs = ["R", "U'", "F2", "R U R' U'", "R U F D L", "B2 L' D U2 F"];
for (const alg of modelAlgs) {
  assert(positionLetters(alg) === cubeLetters(alg), `letters match cubejs for ${alg}`);
}

assert(shortestPath("").length === 0, "empty scramble is solved");
assert(shortestPath("R").moves.join(" ") === "R'", "R undoes with R'");
assert(shortestPath("U2").moves.join(" ") === "U2", "U2 undoes with U2");
assert(shortestPath("R").within === 1, "one move has a single position within 0");

const two = shortestPath("R U");
assert(two.length === 2, "R U is two moves from solved");
assert(solves("R U", two.moves), "R U solution solves");
assert(two.within === cubeBall("R U", 1), "R U ball matches cubejs");
assert(two.within === 19, "every position has 18 neighbors");

const three = shortestPath("R U F");
assert(three.length === 3, "R U F is three moves from solved");
assert(solves("R U F", three.moves), "R U F solution solves");
assert(three.within === cubeBall("R U F", 2), "R U F ball matches cubejs");

const four = shortestPath("R U F D");
assert(four.length === 4, "R U F D distance");
assert(solves("R U F D", four.moves), "R U F D solution solves");
assert(four.within === cubeBall("R U F D", 3), "radius-3 ball matches cubejs");

function sequences(depth) {
  const out = [];
  const moves = [];
  function walk(prevFace, left) {
    if (left === 0) {
      out.push(moves.join(" "));
      return;
    }
    for (let index = 0; index < HTM_MOVE_NAMES.length; index++) {
      const face = (index / 3) | 0;
      if (face === prevFace) continue;
      moves.push(HTM_MOVE_NAMES[index]);
      walk(face, left - 1);
      moves.pop();
    }
  }
  walk(-1, depth);
  return out;
}

for (const scramble of sequences(1).concat(sequences(2))) {
  const pruned = shortestPath(scramble);
  const open = shortestPath(scramble, { pruneOpposites: false });
  assert(pruned.length === open.length, `prune changed distance for ${scramble}`);
  assert(pruned.length === scramble.split(" ").length, `${scramble} should already be shortest`);
  assert(solves(scramble, pruned.moves), `${scramble} solution does not solve`);
}

const sample = mulberry32(7);
let checkedThree = 0;
while (checkedThree < 24) {
  const scramble = randomHtmScramble(3, sample);
  const pruned = shortestPath(scramble);
  const open = shortestPath(scramble, { pruneOpposites: false });
  assert(pruned.length === open.length && pruned.length <= 3, scramble);
  assert(solves(scramble, pruned.moves), scramble);
  checkedThree++;
}

const cancel = shortestPath("R L R'");
assert(cancel.length === 1, `R L R' should collapse, got ${cancel.moves.join(" ")}`);
assert(cancel.within === 1, "a 1-move position has one state within 0 moves");
assert(solves("R L R'", cancel.moves), "R L R' solution solves");

const detourCase = shortestPath("U2 D U2");
assert(detourCase.length === 1 && detourCase.moves.join(" ") === "D'", `U2 D U2 → ${detourCase.moves.join(" ")}`);
assert(detourCase.within === 1, "shortcut still counts only the shallower layer");
assert(solves("U2 D U2", detourCase.moves), "U2 D U2 solution solves");

const buried = shortestPath("R' L2 R D' L2");
assert(buried.length === 3, `buried detour distance ${buried.length}`);
assert(buried.within === 262, `within 2 moves should be 262, got ${buried.within}`);
assert(solves("R' L2 R D' L2", buried.moves), "buried detour solution solves");

let forceCalls = 0;
const forced = randomHtmScramble(4, () => {
  forceCalls += 1;
  return forceCalls === 1 ? 0 : 0.3;
});
const forcedPath = shortestPath(forced);
assert(forced.split(" ").length === 4, "forced scramble length");
assert(forcedPath.length < 4, `${forced} should be shorter than 4, got ${forcedPath.length}`);
assert(solves(forced, forcedPath.moves), "forced detour solution solves");

const random = mulberry32(1);
let reducible = null;
const started = Date.now();
for (let i = 0; i < 24; i++) {
  const scramble = randomHtmScramble(5, random);
  const tokens = scramble.split(" ");
  assert(tokens.length === 5, "length 5");
  for (let t = 1; t < tokens.length; t++) {
    assert(tokens[t][0] !== tokens[t - 1][0], `repeated face in ${scramble}`);
  }
  const result = shortestPath(scramble);
  assert(result.length <= 5, "optimal is at most the scramble");
  assert(solves(scramble, result.moves), `solution missed for ${scramble}`);
  assert(solves(scramble, invertAlgNotation(scramble).split(" ")), "inverse solves");
  if (result.length < 5 && !reducible) reducible = { scramble, length: result.length, moves: result.moves.join(" ") };
}
assert(reducible, "expected a 5-move scramble with a shorter path");
const elapsed = Date.now() - started;
console.log(
  "reducible",
  reducible.scramble,
  "→",
  reducible.moves,
  `(${reducible.length})`,
  `in ${elapsed}ms`,
);

const five = shortestPath("R U F D L");
assert(five.length === 5, "R U F D L distance");
assert(five.within === 46741, "positions within 4 moves");
assert(solves("R U F D L", five.moves), "R U F D L solution solves");

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const timerHtml = readFileSync(new URL("../timer.html", import.meta.url), "utf8");
const pathHtml = readFileSync(new URL("../path.html", import.meta.url), "utf8");
assert(indexHtml.includes('href="./timer.html"'), "coach still links to the timer");
assert(indexHtml.includes('href="./path.html"'), "coach links to the path game");
assert(timerHtml.includes('href="./"'), "timer still links home");
assert(timerHtml.includes('href="./path.html"'), "timer links to the path game");
assert(pathHtml.includes("Ring map"), "path page title");
assert(pathHtml.includes("Colored beads"), "page describes the bead map");
assert(pathHtml.includes('id="path-net"'), "ring map is on the page");
assert(!pathHtml.includes("path-graph"), "state graph is not the page");
assert(!pathHtml.includes("Cube net"), "cross net is not the page title");
assert(indexHtml.includes('title="Ring map"'), "coach names the ring page");
assert(timerHtml.includes('title="Ring map"'), "timer names the ring page");
assert(pathHtml.includes('href="./timer.html"'), "path links to the timer");
assert(pathHtml.includes("js/path-game.js"), "path page script");
assert(pathHtml.includes('data-depth="3"') && pathHtml.includes('data-depth="5"'), "difficulties");
assert(pathHtml.includes("Show optimal"), "give-up control");
for (const name of HTM_MOVE_NAMES) {
  assert(pathHtml.includes(`data-move="${name}"`), `missing move button ${name}`);
}
assert(PATH_LENGTHS.join() === "3,4,5", "selectable lengths");

const ring = createRingModel();
assert(ring.dots.length === 54, "54 beads at arc crossings");
assert(new Set(ring.slotDot).size === 54, "each bead is one sticker");
assert(ring.arcs.length === 9, "three families, three rings");
assert(ring.goodCycles >= 20, `face turns slide on rings, got ${ring.goodCycles}`);
assert(Math.hypot(ring.dots[0].x - -90.67, ring.dots[0].y - 52.35) < 0.05, "crossing geometry");
const solvedLetters = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
for (const move of HTM_MOVE_NAMES) {
  const cube = new Cube();
  cube.move(move);
  const perm = permForMove(move);
  const moved = Array.from({ length: 54 }, (_, i) => solvedLetters[perm.indexOf(i)]).join("");
  assert(moved === cube.asString(), `bead slide matches cubejs for ${move}`);
}

console.log("shortest path ok");

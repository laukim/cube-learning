import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const {
  appMoveToGan,
  cubeEventMove,
  cubeTimerDecision,
  faceletsSolved,
  ganFaceletsToApp,
  ganMoveToApp,
  normalizeMoves,
  reconstructionHooks,
} = await import("../js/move-log.js");
const { faceletsForScramble, renderReconstruction } = await import("../js/cube-reconstruction.js");
const { bluetoothBlocker, connectErrorMessage } = await import("../js/bluetooth-support.js");
const { addPracticeTime, loadPracticeTimes, memoryStore, renderTimesList } = await import("../js/practice-timer.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

function apply(facelets, alg) {
  const cube = globalThis.Cube.fromString(facelets);
  if (alg) cube.move(alg);
  return cube.asString();
}

assert(ganFaceletsToApp(SOLVED) === SOLVED, "a solved GAN cube is solved in coach colours");
assert(faceletsSolved(ganFaceletsToApp(SOLVED)), "converted solved facelets stay solved");
assert(ganMoveToApp("U") === "D" && ganMoveToApp("F'") === "B'" && ganMoveToApp("R2") === "R2", "GAN faces map onto white-bottom blue-front");
assert(appMoveToGan(ganMoveToApp("U'")) === "U'", "face relabel round-trips");
assert(cubeEventMove({ move: "U", direction: 2 }) === "U2", "a 2-bit half turn becomes U2");
assert(cubeEventMove("R'") === "R'", "a move string keeps its prime");

for (const move of ["U", "D'", "R2", "L", "F'", "B"]) {
  const viaGan = ganFaceletsToApp(apply(SOLVED, move));
  const viaApp = apply(SOLVED, ganMoveToApp(move));
  assert(viaGan === viaApp, `${move} on the GAN cube matches ${ganMoveToApp(move)} in the coach`);
}

const scramble = "R U R' U' F2 D L'";
const ganScramble = scramble.split(/\s+/).map(appMoveToGan).join(" ");
assert(
  ganFaceletsToApp(apply(SOLVED, ganScramble)) === apply(SOLVED, scramble),
  "a scramble performed on the cube matches the coach scramble"
);
assert(faceletsForScramble(scramble) === apply(SOLVED, scramble), "scramble facelets use the coach solved state");
assert(!faceletsSolved(faceletsForScramble(scramble)), "a real scramble is not solved");

const log = [
  { move: "R", t: 0, cubeT: 1000 },
  { move: "U'", t: 180 },
  { move: "nope", t: 10 },
  { move: "R2", t: 4200 },
];
const stored = normalizeMoves(log);
assert(stored.length === 3 && stored[0].cubeT === 1000 && stored[1].move === "U'", "move log drops junk and keeps timestamps");
assert(normalizeMoves(JSON.stringify(stored))[2].t === 4200, "move log JSON round-trips");
assert(normalizeMoves([]) == null && normalizeMoves("nope") == null, "empty and broken logs stay empty");
const hooks = reconstructionHooks(stored);
assert(hooks.notation === "R U' R2" && hooks.pauses.length === 1 && hooks.pauses[0].before === "R2", "hooks expose notation and a long gap");
assert(hooks.cross == null && hooks.f2lPairs == null && hooks.oll == null && hooks.pll == null, "stage analysis is left for a follow-up");
const html = renderReconstruction(stored);
assert(html.includes("R") && html.includes("U'") && html.includes("R2") && html.includes("Pause"), "reconstruction lists the moves");
const rightyHtml = renderReconstruction([
  { move: "R", t: 0 },
  { move: "U", t: 200 },
  { move: "R'", t: 400 },
  { move: "U'", t: 600 },
]);
assert(rightyHtml.includes("righty"), "reconstruction reuses coach alg names");

const target = faceletsForScramble("R U");
assert(cubeTimerDecision({ mode: "pll", move: "R", phase: "idle", armed: true }).action === "ignore", "PLL drill stays on spacebar");
assert(
  cubeTimerDecision({ mode: "single", phase: "idle", facelets: target, target, inspectionSeconds: 0 }).action === "arm",
  "matching the scramble arms the clock when inspection is off"
);
assert(
  cubeTimerDecision({ mode: "single", phase: "idle", facelets: target, target, inspectionSeconds: 15 }).action === "inspect",
  "matching the scramble starts inspection when it is on"
);
assert(
  cubeTimerDecision({ mode: "splits", phase: "idle", armed: true, move: "R" }).action === "start",
  "the first turn after the scramble starts the timer"
);
assert(cubeTimerDecision({ mode: "single", phase: "inspecting", move: "U" }).action === "start", "the first turn ends inspection");
assert(cubeTimerDecision({ mode: "single", phase: "running", move: "F" }).action === "log", "turns during the solve are logged");
assert(
  cubeTimerDecision({ mode: "single", phase: "running", solved: true, sawMove: true }).action === "stop",
  "solved stops a running solve"
);
assert(
  cubeTimerDecision({ mode: "single", phase: "running", solved: true, sawMove: false, wasUnsolved: false }).action === "ignore",
  "an already-solved cube does not instantly stop a spacebar start"
);
assert(
  cubeTimerDecision({ mode: "single", phase: "idle", armed: true, facelets: SOLVED, target }).action === "disarm",
  "leaving the scramble drops the ready state"
);
assert(cubeTimerDecision({ mode: "single", phase: "idle", move: "R", armed: false }).action === "ignore", "scrambling turns do not start the clock");
assert(
  cubeTimerDecision({ mode: "single", phase: "idle", facelets: target, target, hold: true, inspectionSeconds: 15 }).action === "ignore",
  "cancelling inspection does not immediately re-arm the same scramble"
);
assert(
  cubeTimerDecision({ mode: "single", phase: "idle", facelets: SOLVED, target, hold: true }).action === "release",
  "leaving the scramble clears the inspection hold"
);

assert(bluetoothBlocker(undefined).includes("Chrome"), "missing Web Bluetooth explains itself");
assert(bluetoothBlocker({ requestDevice() {} }) === "", "a Web Bluetooth adapter is allowed");
assert(connectErrorMessage({ name: "NotFoundError" }) === "No cube selected.", "cancelling the picker is not a failure");

const store = memoryStore();
addPracticeTime({ id: "cube-solve", ms: 12340, at: 1_700_000_010_000, scramble: "R U", moves: stored }, store);
const loaded = loadPracticeTimes(store);
assert(loaded[0].moves[1].move === "U'" && loaded[0].moves[1].t === 180, "local solves keep the move log");
assert(renderTimesList(loaded).includes("timer-reconstruction"), "the times list shows the reconstruction");
addPracticeTime({ id: "plain", ms: 8000, at: 1_700_000_011_000, scramble: "F" }, store);
assert(!loadPracticeTimes(store).find((row) => row.id === "plain").moves, "spacebar solves stay without a move log");

console.log("cube moves ok");

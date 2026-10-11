import { createRequire } from "module";

const require = createRequire(import.meta.url);
globalThis.Cube = require("cubejs");

const {
  appMoveToGan,
  cubeEventMove,
  cubeTimerDecision,
  cubeTimerGoalReached,
  faceletsSolved,
  ganFaceletsToApp,
  ganMoveToApp,
  normalizeMoves,
  reconstructionHooks,
  whiteCrossFaceletsDone,
  worstPause,
} = await import("../js/move-log.js");
const { faceletsForScramble, renderReconstruction } = await import("../js/cube-reconstruction.js");
const { applyAlg, faceletsToString, solvedFacelets, stringToFacelets } = await import("../js/cube.js");
const {
  CHROME_BLUETOOTH_MAC_FLAG,
  MAC_CONNECT_GUIDANCE,
  MAC_UNAVAILABLE_ERROR,
  bindMacPrompt,
  bluetoothBlocker,
  connectErrorMessage,
  createMacAddressProvider,
  normalizeCubeMac,
  promptForCubeMac,
  shouldApplyAdapterIdleStatus,
} = await import("../js/bluetooth-support.js");
const { whiteCrossDone } = await import("../js/cross-trainer.js");
const { randomCrossCase } = await import("../js/cross-solver.js");
const { caseSetupMoves, listPllTrainerCases, loadPllTrainerTimes } = await import("../js/pll-case-trainer.js");
const { loadCrossDrillTimes } = await import("../js/cross-drill.js");
const {
  PRACTICE_MODE_KEY,
  TIMER_MODE_CROSS,
  TIMER_MODE_PLL,
  TIMER_MODE_SINGLE,
  TIMER_MODE_SPLITS,
  addPracticeTime,
  applyCubeSplitMarks,
  initPracticeTimer,
  loadPracticeTimes,
  memoryStore,
  renderTimesList,
} = await import("../js/practice-timer.js");

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
assert(hooks.pauses[0].at === 4200 && hooks.pauses[0].after === "U'", "a pause records when the next move happens");
assert(hooks.cross == null && hooks.f2lPairs == null && hooks.oll == null && hooks.pll == null && hooks.segments == null, "stage fields stay empty until the solve has marks");
const twoPauses = [
  { move: "R", t: 0 },
  { move: "U'", t: 180 },
  { move: "R2", t: 4200 },
  { move: "F", t: 5000 },
  { move: "U", t: 12000 },
];
assert(worstPause(twoPauses).before === "U" && worstPause(twoPauses).ms === 7000, "the worst pause is the longest gap, not the first");
const html = renderReconstruction(stored);
assert(html.includes("R") && html.includes("U'") && html.includes("R2"), "reconstruction lists the moves");
assert(
  html.includes("Worst pause 4.02s at 4.20s, after U' before R2"),
  "a single long gap is the worst pause, with the time into the solve and the moves around it"
);
assert(!html.includes("timer-recon-strip"), "a log without stage marks has no phase strip");
assert(!html.includes("timer-reconstruction-algs"), "named algs stay hidden until the solve has stage marks");
assert(html.includes("<details") && !html.includes("<details open") && !html.includes(" open"), "reconstruction starts collapsed");
assert(html.includes("Reconstruction · 3 moves") && html.includes(">Show<") && !html.includes("tps"), "reconstruction summary is the expand control");
const tpsHtml = renderReconstruction(stored, null, 10000);
assert(tpsHtml.includes("3 moves · 0.30 tps"), "reconstruction summary adds tps when the solve time is known");
assert(html.indexOf("<summary>") < html.indexOf("timer-reconstruction-moves"), "the move string sits inside the expand panel");
const rightyHtml = renderReconstruction([
  { move: "R", t: 0 },
  { move: "U", t: 200 },
  { move: "R'", t: 400 },
  { move: "U'", t: 600 },
]);
assert(!rightyHtml.includes("righty") && !rightyHtml.includes("lefty"), "a righty on its own is not listed");
const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'".split(" ");
const stagedMoves = [
  { move: "R", t: 0 },
  { move: "U", t: 200 },
  { move: "R'", t: 400 },
  { move: "U'", t: 600 },
  ...tPerm.map((move, index) => ({ move, t: 13000 + index * 200 })),
  { move: "L'", t: 17000 },
  { move: "U'", t: 17200 },
  { move: "L", t: 17400 },
  { move: "U", t: 17600 },
];
const stagedSplits = { cross: 4000, f2l: 8000, final: 6000 };
const stagedHtml = renderReconstruction(stagedMoves, stagedSplits);
assert(stagedHtml.includes("T-perm×1"), "a T-perm after the F2L mark is named");
assert(!stagedHtml.includes("righty") && !stagedHtml.includes("lefty"), "righty and lefty stay hidden inside the last layer too");
const earlyPerm = renderReconstruction(
  tPerm.map((move, index) => ({ move, t: 1000 + index * 100 })),
  stagedSplits
);
assert(!earlyPerm.includes("T-perm"), "a T-perm before F2L is not counted as last layer");
const worstHtml = renderReconstruction(twoPauses, { cross: 4000, f2l: 5000, final: 4000 });
assert(
  worstHtml.includes("Worst pause 7.00s in Final at 12.00s, after F before U"),
  "the pause line names the longest gap, its stage, and the moves around it"
);
const pauseParagraph = worstHtml.slice(worstHtml.indexOf("timer-reconstruction-pause"));
assert(!pauseParagraph.includes("4.02s"), "a shorter earlier gap is not the pause line");
assert(worstHtml.includes("Pause 4.02s before R2"), "the shorter recognition gap is still a mark on the strip");
const ollPause = renderReconstruction(twoPauses, { cross: 4000, f2l: 5000, final: 4000, oll: 1000, pll: 3000 });
assert(ollPause.includes("Worst pause 7.00s in PLL"), "a pause after OLL is named PLL");
assert(stagedHtml.includes("timer-recon-strip") && stagedHtml.includes(">Cross<") && stagedHtml.includes(">F2L<") && stagedHtml.includes(">Final<"), "stage marks color Cross, F2L, and Final");
assert(!stagedHtml.includes(">OLL<") && !stagedHtml.includes(">PLL<"), "OLL and PLL stay off the strip until they were detected");
assert(stagedHtml.includes("<details") && !stagedHtml.includes("<details open"), "the full move list stays collapsed under the strip");
assert(stagedHtml.indexOf("timer-recon-strip") < stagedHtml.indexOf("timer-reconstruction-moves"), "the move string stays inside the expand panel");
assert(worstHtml.includes("timer-recon-pause"), "recognition gaps are marked on the phase strip");
assert(ollPause.includes(">OLL<") && ollPause.includes(">PLL<") && !ollPause.includes(">Final<"), "a detected last layer colors OLL and PLL instead of Final");
const pairSplits = {
  cross: 4000,
  f2l: 8000,
  final: 4000,
  pairs: [
    { id: "BR", at: 4000 },
    { id: "FR", at: 7000 },
    { id: "FL", at: 12000 },
    { id: "BL", at: 12000 },
  ],
};
const pairHtml = renderReconstruction(twoPauses, pairSplits);
assert(pairHtml.includes(">FR<") && pairHtml.includes(">BL FL<"), "F2L pair marks name the slots, and slots that finish together share a segment");
assert(!pairHtml.includes(">OLL<"), "pair marks do not invent an OLL phase");
const pairHooks = reconstructionHooks(twoPauses, pairSplits);
assert(pairHooks.cross.end === 4000 && pairHooks.f2lPairs.length === 2, "hooks expose the cross mark and the pairs that finished during F2L");
assert(pairHooks.f2lPairs[0].ids.join(" ") === "FR" && pairHooks.f2lPairs[1].ids.join(" ") === "BL FL", "a pair already in at the cross is not an F2L segment");
assert(pairHooks.oll == null && pairHooks.pll == null, "hooks leave OLL and PLL null when Final was not split");
const layerHooks = reconstructionHooks(twoPauses, { cross: 4000, f2l: 5000, final: 4000, oll: 1000, pll: 3000 });
assert(layerHooks.oll.end - layerHooks.oll.start === 1000 && layerHooks.pll.end - layerHooks.pll.start === 3000, "hooks use the stored OLL and PLL durations");
assert(layerHooks.f2lPairs == null, "F2L pair names stay null when the solve has no pair marks");

const target = faceletsForScramble("R U");
assert(
  cubeTimerDecision({ mode: "pll", phase: "idle", armed: true, move: "U" }).action === "start",
  "the first turn starts a PLL case"
);
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

assert(
  cubeTimerDecision({ mode: "pll", phase: "idle", facelets: target, target, inspectionSeconds: 0 }).action === "arm",
  "PLL arms when the cube matches the case setup"
);
assert(
  cubeTimerDecision({ mode: "pll", phase: "idle", facelets: target, target, inspectionSeconds: 15 }).action === "inspect",
  "PLL setup match starts inspection"
);
assert(cubeTimerDecision({ mode: "pll", phase: "running", move: "R" }).action === "log", "PLL turns are logged and do not stop the case");
assert(
  cubeTimerDecision({ mode: "pll", phase: "running", solved: true, sawMove: true }).action === "stop",
  "a solved cube stops a PLL case"
);
assert(
  cubeTimerDecision({ mode: "pll", phase: "running", solved: true, sawMove: false, wasUnsolved: false }).action === "ignore",
  "an already-solved cube does not instantly stop a PLL spacebar start"
);
assert(
  cubeTimerDecision({ mode: "pll", phase: "idle", move: "R", armed: false }).action === "ignore",
  "setting up a PLL does not start the clock"
);
assert(
  cubeTimerDecision({ mode: "pll", phase: "idle", armed: true, facelets: SOLVED, target }).action === "disarm",
  "leaving the PLL setup drops the ready state"
);
assert(
  cubeTimerDecision({ mode: "cross", phase: "idle", facelets: target, target, inspectionSeconds: 0 }).action === "arm",
  "Cross drill arms when the cube matches the cross scramble"
);
assert(
  cubeTimerDecision({ mode: "cross", phase: "idle", facelets: target, target, inspectionSeconds: 15 }).action === "inspect",
  "a matched cross scramble starts inspection"
);
assert(
  cubeTimerDecision({ mode: "cross", phase: "idle", armed: true, move: "R" }).action === "start",
  "the first turn starts a cross"
);
assert(cubeTimerDecision({ mode: "cross", phase: "running", move: "U" }).action === "log", "cross turns do not invent a split mark");
assert(
  cubeTimerDecision({ mode: "cross", phase: "running", solved: true, wasUnsolved: true }).action === "stop",
  "a finished white cross stops the cross drill"
);
assert(
  cubeTimerDecision({ mode: "cross", phase: "running", solved: false, wasUnsolved: true }).action === "ignore",
  "an unfinished cross keeps the clock running"
);
assert(
  cubeTimerDecision({ mode: "cross", phase: "running", solved: true, sawMove: false, wasUnsolved: false }).action === "ignore",
  "a cross that is already done does not instantly stop a spacebar start"
);
assert(
  cubeTimerDecision({ mode: "oll", phase: "idle", armed: true, move: "R" }).action === "ignore",
  "unknown modes stay off the cube clock"
);

const pllU = faceletsForScramble("U");
assert(cubeTimerGoalReached("pll", SOLVED) && !cubeTimerGoalReached("pll", pllU), "PLL stops on a solved cube, not a U turn");
assert(
  cubeTimerGoalReached("single", SOLVED) && !cubeTimerGoalReached("single", pllU),
  "single still stops only on a solved cube"
);
assert(
  cubeTimerGoalReached("cross", pllU) && !faceletsSolved(pllU),
  "Cross drill stops on a white cross even when the cube is not solved"
);
assert(!cubeTimerGoalReached("cross", faceletsForScramble("R")), "a broken cross does not stop the drill");
assert(whiteCrossFaceletsDone(pllU) === whiteCrossDone(stringToFacelets(pllU)), "letter cross check matches the trainer");
for (const alg of ["", "U2", "F2", "R U R' U'", "D"]) {
  const letters = faceletsForScramble(alg);
  assert(
    whiteCrossFaceletsDone(letters) === whiteCrossDone(stringToFacelets(letters)),
    `cross check agrees on ${alg || "solved"}`
  );
}
const drilled = randomCrossCase(() => 0.3);
assert(!cubeTimerGoalReached("cross", faceletsForScramble(drilled.scramble)), "the cross scramble is not already done");
assert(
  faceletsSolved(faceletsForScramble(`${drilled.scramble} ${drilled.solution}`)),
  "the cross solution restores the cube it was scrambled from"
);
for (const pllCase of listPllTrainerCases()) {
  const setup = caseSetupMoves(pllCase.alg);
  const setupFacelets = faceletsForScramble(setup);
  assert(setupFacelets.length === 54 && !faceletsSolved(setupFacelets), `${pllCase.id} setup is a real case`);
  assert(faceletsForScramble(`${setup} ${pllCase.alg}`) === SOLVED, `${pllCase.id} alg solves the setup`);
  assert(
    cubeTimerDecision({ mode: "pll", phase: "idle", facelets: setupFacelets, target: setupFacelets }).action === "arm",
    `${pllCase.id} setup arms the PLL clock`
  );
}
assert(
  applyCubeSplitMarks({ mode: "pll", facelets: SOLVED, elapsed: 1000 }).action === "none",
  "PLL does not record Cross or F2L marks"
);
assert(
  applyCubeSplitMarks({ mode: "cross", facelets: SOLVED, elapsed: 1000 }).action === "none",
  "Cross drill does not record solve splits"
);

assert(bluetoothBlocker(undefined).includes("Chrome"), "missing Web Bluetooth explains itself");
assert(bluetoothBlocker({ requestDevice() {} }) === "", "a Web Bluetooth adapter is allowed");
assert(connectErrorMessage({ name: "NotFoundError" }) === "No cube selected.", "cancelling the picker is not a failure");
assert(connectErrorMessage({ name: "AbortError" }) === "No cube selected.", "aborting the picker is not a failure");

const macMiss = connectErrorMessage(new Error(MAC_UNAVAILABLE_ERROR));
assert(macMiss.includes(MAC_UNAVAILABLE_ERROR), "a missing MAC keeps the library reason");
assert(macMiss.includes(CHROME_BLUETOOTH_MAC_FLAG), "a missing MAC names the Chrome permissions flag");
assert(macMiss.includes("aa:bb:cc:dd:ee:ff"), "a missing MAC shows the address shape");
assert(!macMiss.includes("Wake the cube"), "a missing MAC is not the generic wake line");

const macTimeout = connectErrorMessage(
  new Error("Timed out waiting for cube data. Check the Bluetooth MAC address and try again.")
);
assert(macTimeout.startsWith("Timed out waiting for cube data."), "a bad MAC stays a timeout");
assert(!macTimeout.includes("Wake the cube"), "a timeout is not the generic wake line");
assert(
  connectErrorMessage(new Error("Can't find target BLE services - wrong or unsupported cube device model")).includes(
    "BLE services"
  ),
  "other library errors stay visible"
);
assert(connectErrorMessage(new Error("")).includes("Wake the cube"), "an empty failure still suggests waking the cube");
assert(connectErrorMessage({}).includes("Wake the cube"), "a nameless failure still suggests waking the cube");

assert(normalizeCubeMac("AA:BB:CC:DD:EE:FF") === "aa:bb:cc:dd:ee:ff", "colon MACs normalize");
assert(normalizeCubeMac("aa-bb-cc-dd-ee-ff") === "aa:bb:cc:dd:ee:ff", "dash MACs normalize");
assert(normalizeCubeMac("aa bb cc dd ee ff") === "aa:bb:cc:dd:ee:ff", "spaced MACs normalize");
assert(normalizeCubeMac(" a:b:c:d:e:f ") === "0a:0b:0c:0d:0e:0f", "short segments are padded");
assert(normalizeCubeMac("aabbccddeeff") === "", "a MAC needs separators");
assert(normalizeCubeMac("aa:bb:cc:dd:ee") === "", "a short MAC is rejected");
assert(normalizeCubeMac("zz:bb:cc:dd:ee:ff") === "", "non-hex segments are rejected");

const cachedProvider = createMacAddressProvider({
  getCachedMac: () => "11:22:33:44:55:66",
  requestMac: async () => {
    throw new Error("cached MAC should skip the prompt");
  },
});
assert((await cachedProvider({ id: "cube" }, false)) === "11:22:33:44:55:66", "a cached MAC is reused");

let promptCalls = 0;
const askingProvider = createMacAddressProvider({
  getCachedMac: () => "",
  requestMac: async (device) => {
    promptCalls += 1;
    assert(device.name === "GAN356 i4", "the prompt receives the picked cube");
    return "aa:bb:cc:dd:ee:ff";
  },
});
assert(
  (await askingProvider({ name: "GAN356 i4" }, false)) === "aa:bb:cc:dd:ee:ff",
  "a provided MAC is what the library encrypts with"
);
assert(promptCalls === 1, "the MAC is asked for once");

let cancelled = false;
try {
  await createMacAddressProvider({
    getCachedMac() {
      throw new Error("storage blocked");
    },
    requestMac: async () => null,
  })({}, true);
} catch (error) {
  cancelled = error;
}
assert(cancelled && cancelled.message === MAC_UNAVAILABLE_ERROR, "cancelling the MAC prompt is a MAC failure");
assert(connectErrorMessage(cancelled).includes(MAC_CONNECT_GUIDANCE), "cancelling explains how to supply a MAC");

assert(promptForCubeMac(() => "AA:BB:CC:DD:EE:FF") === "aa:bb:cc:dd:ee:ff", "the fallback prompt normalizes");
assert(promptForCubeMac(() => null) === "", "dismissing the fallback prompt supplies no MAC");
assert(promptForCubeMac(null) === "", "a missing prompt supplies no MAC");

function fakeControl() {
  const listeners = new Map();
  return {
    hidden: true,
    value: "",
    focused: false,
    selected: false,
    addEventListener(type, fn) {
      listeners.set(type, [...(listeners.get(type) || []), fn]);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn));
    },
    dispatch(type, event) {
      for (const fn of listeners.get(type) || []) fn(event);
    },
    focus() {
      this.focused = true;
    },
    select() {
      this.selected = true;
    },
  };
}

const form = fakeControl();
const input = fakeControl();
const cancelButton = fakeControl();
const statuses = [];
let accepted = "";
const requestMac = bindMacPrompt({
  form,
  input,
  cancelButton,
  setStatus: (text) => statuses.push(text),
  initialValue: () => "aa:bb:cc:dd:ee:01",
  onAccept: (mac) => {
    accepted = mac;
  },
});
const pendingMac = requestMac({ name: "GAN356 i4" });
assert(form.hidden === false && input.focused && input.value === "aa:bb:cc:dd:ee:01", "the MAC form opens with the draft");
assert(statuses[0].includes("GAN356 i4"), "the prompt names the cube");
input.value = "nope";
form.dispatch("submit", { preventDefault() {} });
assert(statuses.at(-1).includes("aa:bb:cc:dd:ee:ff"), "a bad MAC stays on the form");
input.value = "AA-BB-CC-DD-EE-FF";
form.dispatch("submit", { preventDefault() {} });
assert((await pendingMac) === "aa:bb:cc:dd:ee:ff" && accepted === "aa:bb:cc:dd:ee:ff", "a valid MAC finishes the prompt");
assert(form.hidden === true, "the MAC form closes after a valid address");

const cancelForm = fakeControl();
const cancelInput = fakeControl();
const cancelBtn = fakeControl();
const cancelRequest = bindMacPrompt({
  form: cancelForm,
  input: cancelInput,
  cancelButton: cancelBtn,
  setStatus() {},
});
const cancelledMac = cancelRequest();
cancelBtn.dispatch("click", {});
assert((await cancelledMac) === null && cancelForm.hidden === true, "cancel leaves the MAC unset");

assert(shouldApplyAdapterIdleStatus({}) === true, "the idle Bluetooth note can show before a connect");
assert(
  shouldApplyAdapterIdleStatus({ settled: true }) === false,
  "a finished connect attempt keeps its own status"
);
assert(shouldApplyAdapterIdleStatus({ busy: true }) === false, "an in-progress connect keeps its status");
assert(shouldApplyAdapterIdleStatus({ connected: true }) === false, "a live cube keeps its status");

const store = memoryStore();
addPracticeTime({ id: "cube-solve", ms: 12340, at: 1_700_000_010_000, scramble: "R U", moves: stored }, store);
const loaded = loadPracticeTimes(store);
assert(loaded[0].moves[1].move === "U'" && loaded[0].moves[1].t === 180, "local solves keep the move log");
assert(renderTimesList(loaded).includes("timer-reconstruction"), "the times list shows the reconstruction");
addPracticeTime({ id: "plain", ms: 8000, at: 1_700_000_011_000, scramble: "F" }, store);
assert(!loadPracticeTimes(store).find((row) => row.id === "plain").moves, "spacebar solves stay without a move log");

function lettersAfter(alg) {
  const facelets = solvedFacelets();
  if (alg) applyAlg(facelets, alg);
  return faceletsToString(facelets);
}

function element(id) {
  const listeners = {};
  const classes = new Set();
  const node = {
    id,
    hidden: false,
    textContent: "",
    innerHTML: "",
    value: "",
    disabled: false,
    dataset: {},
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
      contains(name) {
        return classes.has(name);
      },
    },
    setAttribute() {},
    getAttribute() {
      return null;
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    click() {
      for (const fn of listeners.click || []) fn({ target: node, preventDefault() {}, stopPropagation() {} });
    },
    blur() {},
    focus() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
  };
  return node;
}

const nodes = {};
function byId(id) {
  nodes[id] = element(id);
  return nodes[id];
}
const modeButtons = ["single", "cross", "splits", "pll"].map((mode) => {
  const btn = element(`mode-${mode}`);
  btn.dataset.timerMode = mode;
  return btn;
});
for (const id of [
  "practice-clock",
  "practice-clock-value",
  "practice-status",
  "practice-splits",
  "practice-scramble",
  "pll-trainer-case",
  "timer-times",
  "timer-stats",
  "timer-split-stats",
  "timer-chart",
  "timer-clear",
]) {
  byId(id);
}
globalThis.document = {
  body: element("body"),
  activeElement: null,
  getElementById(id) {
    return nodes[id] || null;
  },
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    return selector === "[data-timer-mode]" ? modeButtons : [];
  },
  addEventListener() {},
};
globalThis.window = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  confirm: () => false,
  innerHeight: 800,
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};
globalThis.requestIdleCallback = () => 0;

let now = 1_000_000_000_000;
const realNow = Date.now;
Date.now = () => now;

const timerStore = memoryStore({ [PRACTICE_MODE_KEY]: TIMER_MODE_SPLITS });
const timer = initPracticeTimer({ store: timerStore, isActive: () => true });
const clock = nodes["practice-clock"];
const statusEl = nodes["practice-status"];
const splitsEl = nodes["practice-splits"];

function latestSolve() {
  const rows = loadPracticeTimes(timerStore);
  return rows[rows.length - 1];
}

function armScramble() {
  const target = faceletsForScramble(timer.getScramble());
  assert(target && !faceletsSolved(target), "the scramble is a real unsolved cube");
  timer.onCubeFacelets(target);
  assert(statusEl.textContent.includes("Scramble matched"), "matching the scramble arms the cube timer");
}

async function stopFromSolvedCube() {
  timer.onCubeFacelets(SOLVED);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(timer.getPhase() === "idle", "a solved cube stops the running timer");
}

await (async function verifyConnectedSplitMarks() {
  assert(timer.getMode() === TIMER_MODE_SPLITS, "the practice timer opens in splits mode");
  timer.setCubeConnected(true);
  assert(statusEl.textContent.includes("Cross and F2L mark themselves"), "splits mode tells Kim the cube will mark stages");

  armScramble();
  const autoStart = now;
  timer.onCubeMove("R");
  assert(timer.getPhase() === "running", "the first turn starts a splits solve");
  assert(statusEl.textContent.includes("Cross marks when the white cross is done"), "Cross does not ask for a tap");
  now = autoStart + 4120;
  timer.onCubeFacelets(lettersAfter("R U R' U'"));
  assert(statusEl.textContent.includes("F2L marks when the first two layers are done"), "white cross records the Cross mark");
  assert(splitsEl.innerHTML.includes("is-done") && splitsEl.innerHTML.includes("4.12"), "the live Cross split shows the auto mark");
  now = autoStart + 22460;
  timer.onCubeFacelets(lettersAfter("U"));
  assert(statusEl.textContent.includes("the cube stops when solved"), "F2L records the F2L mark");
  assert(splitsEl.innerHTML.includes("18.34"), "the live F2L split is the gap after Cross");
  now = autoStart + 30680;
  await stopFromSolvedCube();
  let row = latestSolve();
  assert(row.ms === 30680, "the solve time is kept");
  assert(row.moves && row.moves[0].move === "R" && row.moves[0].t === 0, "a smart-cube splits solve stores the move log");
  assert(
    row.splits.cross === 4120 && row.splits.f2l === 18340 && row.splits.final === 8220,
    "Cross, F2L, and Final durations are saved without taps"
  );
  assert(statusEl.textContent.includes("Cross 4.12") && statusEl.textContent.includes("F2L 18.34") && statusEl.textContent.includes("Final 8.22"), "the stopped solve reads the three stages back");

  armScramble();
  const tapStart = (now = 2_000_000_000_000);
  timer.onCubeMove("U");
  now = tapStart + 5000;
  clock.click();
  assert(statusEl.textContent.includes("F2L marks when the first two layers are done"), "a tap still records Cross when auto detection has not");
  now = tapStart + 20000;
  timer.onCubeFacelets(lettersAfter("U"));
  assert(statusEl.textContent.includes("the cube stops when solved"), "F2L still auto-marks after a manual Cross tap");
  now = tapStart + 28000;
  await stopFromSolvedCube();
  row = latestSolve();
  assert(
    row.splits.cross === 5000 && row.splits.f2l === 15000 && row.splits.final === 8000,
    "a manual Cross tap and an auto F2L mark save together"
  );

  armScramble();
  const overrideStart = (now = 3_000_000_000_000);
  timer.onCubeMove("F");
  now = overrideStart + 4000;
  timer.onCubeFacelets(lettersAfter("R U R' U'"));
  now = overrideStart + 22000;
  clock.click();
  now = overrideStart + 30000;
  clock.click();
  assert(timer.getPhase() === "idle", "a tap still stops after both stages are marked");
  row = latestSolve();
  assert(
    row.splits.cross === 4000 && row.splits.f2l === 18000 && row.splits.final === 8000,
    "a tap can mark F2L early and then stop"
  );

  timer.setCubeConnected(false);
  now = 4_000_000_000_000;
  clock.click();
  assert(timer.getPhase() === "running", "space or tap still starts with no cube");
  assert(statusEl.textContent.includes("space or tap when white cross is done"), "without a cube, Cross still needs a tap");
  now += 2000;
  timer.onCubeFacelets(lettersAfter("R U R' U'"));
  assert(statusEl.textContent.includes("space or tap when white cross is done"), "facelets do nothing while the cube is disconnected");
  now += 2000;
  clock.click();
  now += 18000;
  clock.click();
  now += 8000;
  clock.click();
  assert(timer.getPhase() === "idle", "taps still stop a splits solve with no cube");
  row = latestSolve();
  assert(
    row.splits.cross === 4000 && row.splits.f2l === 18000 && row.splits.final === 8000,
    "disconnected splits stay on taps"
  );

  timer.setCubeConnected(true);
  modeButtons.find((btn) => btn.dataset.timerMode === TIMER_MODE_SINGLE).click();
  assert(timer.getMode() === TIMER_MODE_SINGLE, "single mode is still available");
  armScramble();
  const singleStart = (now = 5_000_000_000_000);
  timer.onCubeMove("R");
  assert(statusEl.textContent.includes("the cube stops it when solved"), "single mode still stops from the cube");
  assert(!statusEl.textContent.includes("Cross marks"), "single mode does not announce stage marks");
  now = singleStart + 4000;
  timer.onCubeFacelets(lettersAfter("R U R' U'"));
  now = singleStart + 30000;
  await stopFromSolvedCube();
  row = latestSolve();
  assert(row.ms === 30000 && !row.splits, "single mode saves the solve without Cross or F2L splits");

  const practiceCount = loadPracticeTimes(timerStore).length;
  modeButtons.find((btn) => btn.dataset.timerMode === TIMER_MODE_PLL).click();
  assert(timer.getMode() === TIMER_MODE_PLL, "PLL mode is available with a cube connected");
  assert(statusEl.textContent.includes("set up this case from solved to arm"), "PLL tells Kim to set the case up");
  const pllHtml = nodes["pll-trainer-case"].innerHTML;
  const pllSetup = pllHtml.match(/pll-trainer-setup-kicker[\s\S]*?<code class="alg">([^<]*)<\/code>/)?.[1] || "";
  assert(pllSetup && !faceletsSolved(faceletsForScramble(pllSetup)), "the dealt PLL case shows an unsolved setup");
  const pllTarget = faceletsForScramble(pllSetup);
  timer.onCubeMove("R");
  assert(timer.getPhase() === "idle", "PLL setup turns do not start the clock");
  timer.onCubeFacelets(SOLVED);
  assert(timer.getPhase() === "idle" && statusEl.textContent.includes("set up this case"), "a solved cube is not a PLL case");
  timer.onCubeFacelets(pllTarget);
  assert(statusEl.textContent.includes("Case set up"), "matching the PLL setup arms the clock");
  timer.onCubeFacelets(SOLVED);
  assert(statusEl.textContent.includes("set up this case"), "leaving the PLL setup disarms");
  timer.onCubeFacelets(pllTarget);
  const pllStart = (now = 6_000_000_000_000);
  timer.onCubeMove("U");
  assert(timer.getPhase() === "running", "the first turn starts the PLL case");
  assert(
    statusEl.textContent.includes("Timing this case") && statusEl.textContent.includes("the cube stops it when solved"),
    "PLL running copy says the cube stops on solved"
  );
  timer.onCubeFacelets(faceletsForScramble("R U"));
  assert(timer.getPhase() === "running", "an unsolved PLL keeps running");
  now = pllStart + 1500;
  timer.onCubeFacelets(SOLVED);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(timer.getPhase() === "idle", "a solved cube stops the PLL case");
  const pllRows = loadPllTrainerTimes(timerStore);
  assert(pllRows.length === 1 && pllRows[0].ms === 1500 && pllRows[0].caseId, "the PLL case time is saved");
  assert(!pllRows[0].splits, "a PLL time has no Cross or F2L splits");
  assert(loadPracticeTimes(timerStore).length === practiceCount, "a PLL time stays out of solve records");
  assert(
    statusEl.textContent.includes("Next case is ready") && statusEl.textContent.includes("set it up from solved to arm"),
    "the next PLL case asks to be set up"
  );
  const pllAfterCube = pllRows.length;
  clock.click();
  assert(timer.getPhase() === "running", "space or tap still starts a PLL case");
  now += 800;
  clock.click();
  assert(timer.getPhase() === "idle", "space or tap still stops a PLL case");
  assert(loadPllTrainerTimes(timerStore).length === pllAfterCube + 1, "a tap backup still records the PLL case");

  modeButtons.find((btn) => btn.dataset.timerMode === TIMER_MODE_CROSS).click();
  assert(timer.getMode() === TIMER_MODE_CROSS, "Cross drill is available with a cube connected");
  assert(statusEl.textContent.includes("apply the cross scramble to arm"), "Cross drill tells Kim to apply the scramble");
  const crossScramble = timer.getScramble();
  const crossTarget = faceletsForScramble(crossScramble);
  assert(crossScramble && !cubeTimerGoalReached("cross", crossTarget), "the dealt cross is not already done");
  timer.onCubeMove("R");
  assert(timer.getPhase() === "idle", "applying the cross scramble does not start the clock");
  timer.onCubeFacelets(crossTarget);
  assert(statusEl.textContent.includes("Cross set up"), "matching the cross scramble arms the clock");
  const crossStart = (now = 7_000_000_000_000);
  timer.onCubeMove("F");
  assert(timer.getPhase() === "running", "the first turn starts the cross");
  assert(
    statusEl.textContent.includes("Timing the cross") && statusEl.textContent.includes("white cross is done"),
    "Cross running copy stops on the white cross"
  );
  timer.onCubeFacelets(faceletsForScramble("F2"));
  assert(timer.getPhase() === "running", "an unfinished cross keeps running");
  now = crossStart + 2200;
  timer.onCubeFacelets(faceletsForScramble("U"));
  assert(!faceletsSolved(faceletsForScramble("U")), "the stopping cross state is not a solved cube");
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert(timer.getPhase() === "idle", "a finished white cross stops the drill");
  const crossRows = loadCrossDrillTimes(timerStore);
  assert(crossRows.length === 1 && crossRows[0].ms === 2200 && crossRows[0].length > 0, "the cross time keeps its optimal length");
  assert(!crossRows[0].splits, "a cross time has no solve splits");
  assert(loadPracticeTimes(timerStore).length === practiceCount, "a cross time stays out of solve records");
  assert(loadPllTrainerTimes(timerStore).length === pllAfterCube + 1, "a cross time does not write a PLL case");
  assert(statusEl.textContent.includes("Optimal"), "stopping a cross still shows the optimal length");
  const crossAfterCube = crossRows.length;
  clock.click();
  assert(timer.getPhase() === "running", "space or tap still starts a cross");
  now += 900;
  clock.click();
  assert(timer.getPhase() === "idle", "space or tap still stops a cross");
  assert(loadCrossDrillTimes(timerStore).length === crossAfterCube + 1, "a tap backup still records the cross");

  timer.setCubeConnected(false);
  assert(statusEl.textContent.includes("Space or tap"), "disconnecting the cube returns Cross drill to space or tap");
  timer.onCubeFacelets(crossTarget);
  timer.onCubeMove("R");
  assert(timer.getPhase() === "idle", "cross facelets do nothing while the cube is disconnected");
})();

Date.now = realNow;

console.log("cube moves ok");

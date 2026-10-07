/**
 * Shortest-path puzzle page. Face turns use the shared cubejs facelets.
 * The picture is the state graph: dots are positions, lines are turns.
 */

import { invertAlgNotation } from "./alg.js";
import { applyMove, COLOR_HEX, FACES, isSolved, solvedFacelets } from "./cube.js";
import { assembleGraph, renderCubeGraph } from "./path-graph.js";
import { createShortestPathSearch, PATH_LENGTHS, randomHtmScramble } from "./shortest-path.js";

const DEPTH_KEY = "cube-coach-path-depth";

function loadDepth() {
  try {
    const depth = Number(localStorage.getItem(DEPTH_KEY));
    if (PATH_LENGTHS.includes(depth)) return depth;
  } catch {
    /* private mode */
  }
  return PATH_LENGTHS[0];
}

function saveDepth(depth) {
  try {
    localStorage.setItem(DEPTH_KEY, String(depth));
  } catch {
    /* quota / private mode */
  }
}

function proofText(result) {
  const length = result.length;
  const within = result.within;
  if (length <= 0) return "The cube was already solved.";
  if (length === 1) {
    return "Solved is one turn away. Zero moves leaves you on the scrambled node, so one is the minimum. Breadth-first search hits solved on the first step.";
  }
  const prev = length - 1;
  const unit = prev === 1 ? "move" : "moves";
  const positions = within.toLocaleString();
  return `Breadth-first search lists every position within ${prev} ${unit} of the scramble — ${positions} of them. Solved is not in that list, so it takes at least ${length} moves. The search reaches solved on the next turn, and the first time it gets there is a shortest path.`;
}

function init() {
  const play = document.getElementById("path-play");
  const net = document.getElementById("path-net");
  const pad = document.getElementById("path-pad");
  const countEl = document.getElementById("path-count");
  const scrambleEl = document.getElementById("path-scramble");
  const playerEl = document.getElementById("path-player");
  const statusEl = document.getElementById("path-status");
  const undoBtn = document.getElementById("path-undo");
  const newBtn = document.getElementById("path-new");
  const showBtn = document.getElementById("path-show");
  const resultEl = document.getElementById("path-result");
  const headlineEl = document.getElementById("path-headline");
  const kickerEl = document.getElementById("path-kicker");
  const optimalEl = document.getElementById("path-optimal");
  const graphEl = document.getElementById("path-graph");
  const proofEl = document.getElementById("path-proof");
  const detourEl = document.getElementById("path-detour");
  const legendShort = document.getElementById("path-legend-short");
  const scoreEl = countEl?.parentElement;

  const faceClass = { U: "net-U", L: "net-L", F: "net-F", R: "net-R", B: "net-B", D: "net-D" };
  for (const face of ["U", "L", "F", "R", "B", "D"]) {
    const faceEl = document.createElement("div");
    faceEl.className = `net-face ${faceClass[face]}`;
    const start = FACES.indexOf(face) * 9;
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement("div");
      cell.className = "net-cell";
      cell.dataset.i = String(start + i);
      faceEl.appendChild(cell);
    }
    net.appendChild(faceEl);
  }

  let depth = loadDepth();
  let phase = "play";
  let roundGen = 0;
  let scramble = "";
  let scrambleMoves = [];
  let facelets = solvedFacelets();
  let played = [];
  let optimal = null;
  let searchError = "";
  let revealed = false;

  function paint() {
    net.querySelectorAll("[data-i]").forEach((cell) => {
      cell.style.background = COLOR_HEX[facelets[Number(cell.dataset.i)]] || "#333";
    });
  }

  function syncDepthButtons() {
    document.querySelectorAll(".path-depth-btn").forEach((button) => {
      const on = Number(button.dataset.depth) === depth;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncControls() {
    const locked = phase !== "play";
    pad.querySelectorAll("button").forEach((button) => {
      button.disabled = locked;
    });
    undoBtn.disabled = locked || played.length === 0;
    showBtn.disabled = locked;
    play.dataset.phase = phase;
    countEl.textContent = String(played.length);
    playerEl.textContent = played.length ? played.join(" ") : "—";
    scoreEl.classList.toggle("is-short", phase === "solved" && !!optimal && played.length === optimal.length);
    scoreEl.classList.toggle("is-long", phase === "solved" && !!optimal && played.length > optimal.length);
    if (legendShort) legendShort.hidden = !(revealed && optimal);
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function rewindToScramble() {
    facelets = solvedFacelets();
    for (const move of scrambleMoves) applyMove(facelets, move);
    paint();
  }

  function drawGraph(animate) {
    const model = assembleGraph({
      scramble,
      playerMoves: played,
      optimalMoves: revealed && optimal ? optimal.moves : null,
    });
    renderCubeGraph(graphEl, model, {
      animate,
      interactive: phase === "play",
      onTurn: playMove,
    });
  }

  function renderResult() {
    const length = optimal ? optimal.length : scrambleMoves.length;
    if (phase === "solved" && optimal && played.length === length) {
      headlineEl.textContent = "You found a shortest path.";
    } else if (phase === "solved" && optimal) {
      headlineEl.textContent = `You solved it in ${played.length}. A shortest path is ${length}.`;
    } else if (optimal) {
      headlineEl.textContent = `A shortest path is ${length} ${length === 1 ? "move" : "moves"}.`;
    } else {
      headlineEl.textContent = "Here is one way back.";
    }

    if (optimal) {
      kickerEl.textContent = length === 1 ? "1 move from the scramble" : `${length} moves from the scramble`;
      optimalEl.textContent = optimal.moves.join(" ") || "—";
      proofEl.textContent = proofText(optimal);
    } else {
      kickerEl.textContent = "Scramble reversed";
      optimalEl.textContent = invertAlgNotation(scramble);
      proofEl.textContent =
        "The search did not finish, so this is the scramble played backwards. It solves the cube. It might not be the shortest route.";
    }

    const undone = invertAlgNotation(scramble);
    if (optimal && scrambleMoves.length > optimal.length) {
      detourEl.hidden = false;
      detourEl.textContent = `Reversing the scramble also solves it, in ${scrambleMoves.length} moves: ${undone}. That is a longer walk between the same start and solved positions.`;
    } else if (optimal && undone !== optimal.moves.join(" ")) {
      detourEl.hidden = false;
      detourEl.textContent = `Reversing the scramble is another shortest path: ${undone}.`;
    } else {
      detourEl.hidden = true;
      detourEl.textContent = "";
    }

    resultEl.hidden = false;
    syncControls();
    drawGraph(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    resultEl.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }

  function maybeReveal() {
    if (phase === "play" || revealed) return;
    if (!optimal && !searchError) {
      setStatus(phase === "solved" ? `Solved in ${played.length}. Searching for a shortest path…` : "Searching for a shortest path…");
      return;
    }
    revealed = true;
    if (phase === "reveal") rewindToScramble();
    renderResult();
    if (phase === "solved" && optimal && played.length === optimal.length) {
      setStatus(`Solved in ${played.length}. That is a shortest path.`);
    } else if (phase === "solved" && optimal) {
      setStatus(`Solved in ${played.length}. Shortest path is ${optimal.length}.`);
    } else if (optimal) {
      setStatus(
        played.length
          ? "Cube preview is back at the scramble. Your path stays on the graph."
          : "Shortest path is on the graph. New scramble for another one.",
      );
    } else {
      setStatus("Showing the scramble reversed.");
    }
  }

  function pump(gen, search) {
    const chunk = () => {
      if (gen !== roundGen) return;
      const t0 = performance.now();
      let result = null;
      try {
        while (!result && !search.error && performance.now() - t0 < 12) {
          result = search.step(400);
        }
      } catch (error) {
        searchError = error instanceof Error ? error.message : "Search failed";
        maybeReveal();
        return;
      }
      if (gen !== roundGen) return;
      if (search.error) {
        searchError = search.error;
        maybeReveal();
        return;
      }
      if (!result) {
        setTimeout(chunk, 0);
        return;
      }
      optimal = result;
      maybeReveal();
    };
    setTimeout(chunk, 0);
  }

  function newRound() {
    roundGen += 1;
    phase = "play";
    optimal = null;
    searchError = "";
    revealed = false;
    played = [];
    scramble = "";
    facelets = solvedFacelets();
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = randomHtmScramble(depth);
      const next = solvedFacelets();
      for (const move of candidate.split(" ")) applyMove(next, move);
      scramble = candidate;
      facelets = next;
      if (!isSolved(facelets)) break;
    }
    scrambleMoves = scramble.split(" ");
    scrambleEl.textContent = scramble;
    resultEl.hidden = true;
    paint();
    syncControls();
    drawGraph(true);
    setStatus("The center dot is the scramble. Turn a face, or tap a neighboring dot.");
    pump(roundGen, createShortestPathSearch(scramble));
  }

  function playMove(move) {
    if (phase !== "play") return;
    applyMove(facelets, move);
    played.push(move);
    paint();
    syncControls();
    drawGraph(false);
    if (isSolved(facelets)) {
      phase = "solved";
      syncControls();
      drawGraph(false);
      setStatus(`Solved in ${played.length}.`);
      maybeReveal();
    }
  }

  function undo() {
    if (phase !== "play" || played.length === 0) return;
    const move = played.pop();
    applyMove(facelets, invertAlgNotation(move));
    paint();
    syncControls();
    drawGraph(false);
  }

  pad.addEventListener("click", (event) => {
    const button = event.target.closest("[data-move]");
    if (!button || button.disabled) return;
    playMove(button.dataset.move);
  });

  undoBtn.addEventListener("click", undo);
  newBtn.addEventListener("click", newRound);
  showBtn.addEventListener("click", () => {
    if (phase !== "play") return;
    phase = "reveal";
    syncControls();
    maybeReveal();
  });

  document.querySelector(".path-depth").addEventListener("click", (event) => {
    const button = event.target.closest("[data-depth]");
    if (!button) return;
    const next = Number(button.dataset.depth);
    if (!PATH_LENGTHS.includes(next) || next === depth) return;
    depth = next;
    saveDepth(depth);
    syncDepthButtons();
    newRound();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.key === "z" || event.key === "Z") undo();
  });

  syncDepthButtons();
  newRound();
}

if (typeof document !== "undefined") init();

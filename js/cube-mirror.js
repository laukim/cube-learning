/**
 * Live 3D mirror for a connected smart cube.
 * Reuses the CSS cubie mesh in cubie-view.js. Facelets are coach letters
 * (white on the bottom, green in front). A turn animates, then the mesh is
 * rebuilt from the resulting facelets so the picture cannot drift.
 */

import { applyMove, faceletsToString, stringToFacelets } from "./cube.js?v=timer4";
import { createCubieCube, parseMove } from "./cubie-view.js?v=cube3d1";

const HOME_X = -24;
const HOME_Y = 32;

export function createCubeMirror(cubeEl, { reducedMotion = false, duration = 170 } = {}) {
  const view = createCubieCube(cubeEl);
  view.setSize(78);
  view.state.duration = duration;

  let colors = null;
  let queue = [];
  let busy = false;
  let epoch = 0;
  let replayToken = 0;
  let replayTimer = 0;
  let tiltX = HOME_X;
  let tiltY = HOME_Y;
  let unbindOrbit = () => {};
  let resizeObserver = null;

  function lettersOf(list) {
    return list ? faceletsToString(list) : "";
  }

  function applyTilt() {
    cubeEl.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  function show(next) {
    colors = next.slice();
    view.rebuild(colors);
    cubeEl.dataset.facelets = lettersOf(colors);
    applyTilt();
  }

  function fit() {
    const scene = cubeEl.parentElement;
    const width = scene?.clientWidth || 0;
    const height = scene?.clientHeight || 0;
    if (width < 40) return;
    const byWidth = Math.round(width * 0.28);
    const byHeight = height > 40 ? Math.round(height * 0.33) : byWidth;
    const size = Math.max(58, Math.min(92, byWidth, byHeight));
    if (size === view.state.size) return;
    view.setSize(size);
    if (colors && !busy) view.rebuild(colors);
    applyTilt();
  }

  function cancelReplay() {
    replayToken += 1;
    if (replayTimer) {
      clearTimeout(replayTimer);
      replayTimer = 0;
    }
  }

  function setFacelets(letters) {
    const text = String(letters || "");
    if (text.length !== 54 || /[^URFDLB]/.test(text)) return;
    cancelReplay();
    if (text === lettersOf(colors)) return;
    epoch += 1;
    queue = [];
    busy = false;
    show(stringToFacelets(text));
  }

  /**
   * Play a stored solve from the scramble state, one turn at a time.
   * A later setFacelets (the live cube) cancels it.
   */
  function replay(startLetters, moves, { gap = 280, onDone } = {}) {
    const list = (Array.isArray(moves) ? moves : [])
      .map((row) => (typeof row === "string" ? row : row?.move))
      .map((move) => String(move || "").trim())
      .filter(Boolean);
    setFacelets(startLetters);
    if (lettersOf(colors) !== String(startLetters || "")) {
      onDone?.();
      return;
    }
    const token = replayToken;
    const step = () => {
      if (token !== replayToken) return;
      if (!list.length) {
        replayTimer = 0;
        onDone?.();
        return;
      }
      turn(list.shift());
      replayTimer = setTimeout(step, gap);
    };
    replayTimer = setTimeout(step, gap);
  }

  function finishTurn(snapshot, myEpoch) {
    if (myEpoch !== epoch) return;
    show(snapshot);
    busy = false;
    pump();
  }

  function applySafe(move) {
    try {
      applyMove(colors, move);
      return true;
    } catch {
      return false;
    }
  }

  function pump() {
    if (busy || !colors || !queue.length) return;
    const myEpoch = epoch;
    if (queue.length > 2 || reducedMotion) {
      while (queue.length) applySafe(queue.shift());
      show(colors.slice());
      return;
    }
    const move = queue.shift();
    if (!applySafe(move)) {
      pump();
      return;
    }
    const snapshot = colors.slice();
    const parsed = parseMove(move);
    if (!parsed || parsed.type !== "layer") {
      show(snapshot);
      pump();
      return;
    }
    busy = true;
    view.animateLayer(parsed.face, parsed.turns, () => finishTurn(snapshot, myEpoch));
  }

  function turn(move) {
    const token = String(move || "").trim();
    if (!token || !colors) return;
    queue.push(token);
    pump();
  }

  function reset() {
    cancelReplay();
    epoch += 1;
    queue = [];
    busy = false;
    colors = null;
    delete cubeEl.dataset.facelets;
    cubeEl.innerHTML = "";
    view.state.cubies.clear();
    applyTilt();
  }

  function bindOrbit(scene) {
    unbindOrbit();
    if (!scene) return;
    let dragging = false;
    let last = null;

    const onDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      dragging = true;
      last = { x: event.clientX, y: event.clientY };
      try {
        scene.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (event) => {
      if (!dragging || !last) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      tiltY += dx * 0.5;
      tiltX = Math.max(-75, Math.min(75, tiltX + dy * 0.35));
      applyTilt();
    };
    const onUp = () => {
      dragging = false;
      last = null;
    };
    const onKey = (event) => {
      if (event.key === "ArrowLeft") tiltY -= 14;
      else if (event.key === "ArrowRight") tiltY += 14;
      else if (event.key === "ArrowUp") tiltX = Math.max(-75, tiltX - 10);
      else if (event.key === "ArrowDown") tiltX = Math.min(75, tiltX + 10);
      else return;
      event.preventDefault();
      applyTilt();
    };

    scene.addEventListener("pointerdown", onDown);
    scene.addEventListener("pointermove", onMove);
    scene.addEventListener("pointerup", onUp);
    scene.addEventListener("pointercancel", onUp);
    scene.addEventListener("keydown", onKey);
    unbindOrbit = () => {
      scene.removeEventListener("pointerdown", onDown);
      scene.removeEventListener("pointermove", onMove);
      scene.removeEventListener("pointerup", onUp);
      scene.removeEventListener("pointercancel", onUp);
      scene.removeEventListener("keydown", onKey);
      unbindOrbit = () => {};
    };
  }

  const scene = cubeEl.parentElement;
  if (typeof ResizeObserver === "function" && scene) {
    resizeObserver = new ResizeObserver(() => fit());
    resizeObserver.observe(scene);
  }
  applyTilt();
  fit();

  return {
    setFacelets,
    turn,
    replay,
    cancelReplay,
    reset,
    fit,
    bindOrbit,
    facelets() {
      return lettersOf(colors);
    },
    destroy() {
      unbindOrbit();
      resizeObserver?.disconnect();
      reset();
    },
  };
}

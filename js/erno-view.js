/**
 * Exact onlinecube.com drag behaviour via vendored ERNO / Cuber.
 * https://onlinecube.com — Chrome Cube Lab (Mark Lundin / Stewart Smith / Google Creative Lab)
 *
 * Orbit is look-only: F/R/L/B always mean fixed cube faces (green = F with white
 * on bottom). Dragging around the cube does not remap pad/keyboard notation.
 * Orbit needs a deliberate slide (~35% of the cube) before it sticks.
 */

function moveToErno(move) {
  const m = String(move).trim();
  if (!m) return "";
  const face = m[0].toUpperCase();
  const rest = m.slice(1);
  if (rest === "2") return face + face; // U2 → UU
  if (rest === "'" || rest === "3") return face.toLowerCase(); // U' → u
  return face;
}

function algToErno(alg) {
  return String(alg)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(moveToErno)
    .join("");
}

function twistToMove(twist) {
  if (!twist || !twist.command) return null;
  const raw = twist.command;
  const face = raw.toUpperCase();
  // cubejs wants lowercase x/y/z for whole-cube turns; faces stay uppercase
  const isCubeRot = face === "X" || face === "Y" || face === "Z";
  const notation = isCubeRot ? face.toLowerCase() : face;
  const deg = Math.abs(twist.degrees || 90);
  const ccw = raw === raw.toLowerCase();
  if (deg >= 170) return `${notation}2`;
  if (ccw) return `${notation}'`;
  return notation;
}

/** Side faces in y-cycle (kept for callers / debugging). */
const Y_CYCLE = ["F", "R", "B", "L"];

/**
 * @param {HTMLElement} container
 * @param {{ onTwist: (move: string) => void, onShuffleComplete?: () => void }} hooks
 */
export function createErnoCube(container, hooks) {
  if (!window.ERNO) throw new Error("ERNO library not loaded");

  container.innerHTML = "";

  const cube = new ERNO.Cube({
    // hideInvisibleFaces causes L/R stickers to flicker after whole-cube y/x turns
    hideInvisibleFaces: false,
    keyboardControlsEnabled: false,
    twistDuration: 320,
  });

  container.appendChild(cube.domElement);

  // Same default tilt as onlinecube.com
  const tilt = new THREE.Euler(0.1 * Math.PI, -0.25 * Math.PI, 0);
  function applyHomeTilt() {
    cube.object3D.lookAt(cube.camera.position);
    cube.rotation.x += tilt.x;
    cube.rotation.y += tilt.y;
    cube.rotation.z += tilt.z;
  }
  applyHomeTilt();

  // Snappier than ERNO defaults (4 / 0.25) — orbit outside pieces should feel lively
  try {
    if (cube.controls) {
      cube.controls.rotationSpeed = 7;
      cube.controls.damping = 0.2;
    }
  } catch {
    /* ignore */
  }

  /**
   * Orbit tracks freely while dragging. On release, short nudges snap back
   * so accidental taps don’t leave the view rotated.
   */
  let orbitPointerDown = false;
  let quatAtDown = null;
  let pointerStart = null;
  let orbitArmed = false;
  let faceDragPossibly = false;

  const resize = () => {
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 280;
    cube.setSize(w, h);
  };
  resize();
  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
  }

  function orbitThresholdPx() {
    const size = Math.min(container.clientWidth || 320, container.clientHeight || 280);
    return Math.max(24, size * 0.08);
  }

  function eventClient(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function revealStickers() {
    const root = cube.domElement;
    if (!root) return;
    root.querySelectorAll(".faceExtroverted").forEach((el) => {
      el.style.display = "block";
      el.style.visibility = "visible";
      el.style.opacity = "1";
    });
    root.querySelectorAll(".sticker").forEach((el) => {
      el.style.display = "block";
      el.style.visibility = "visible";
      el.style.opacity = "1";
    });
  }

  function healVisual() {
    try {
      cube.showPlastics();
      cube.showStickers();
      cube.showExtroverts();
      // Internal faces are dark plastic with no colour — hide them after a flip
      // so they cannot cover the sticker that should be showing.
      cube.hideIntroverts(null, true);
      cube.cubelets.forEach((c) => {
        if (!c.radius) return;
        c.radius = 0;
        c.isTweening = false;
        c.isEngagedX = false;
        c.isEngagedY = false;
        c.isEngagedZ = false;
        const s = c.size || cube.cubeletSize;
        c.position.set(c.addressX * s + 0.2, c.addressY * s + 0.2, c.addressZ * s + 0.2);
        c.updateMatrix();
        c.matrixSlice.copy(c.matrix);
      });
      revealStickers();
    } catch {
      /* ignore */
    }
  }

  function healVisualSoon() {
    healVisual();
    requestAnimationFrame(() => {
      healVisual();
      window.setTimeout(healVisual, 80);
      window.setTimeout(healVisual, 360);
    });
  }

  cube.addEventListener("onTwistComplete", (e) => {
    const twist = e.detail?.twist;
    if (!twist || twist.degrees === 0) return;
    const cubeMove = twistToMove(twist);
    if (!cubeMove) return;
    hooks.onTwist?.({
      cubeMove,
      viewMove: cubeMove,
      virtual: false,
    });
    healVisualSoon();
  });

  cube.addEventListener("onShuffleComplete", () => {
    healVisualSoon();
    hooks.onShuffleComplete?.();
  });

  const onPointerDown = (e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    orbitPointerDown = true;
    orbitArmed = false;
    faceDragPossibly = false;
    pointerStart = eventClient(e);
    try {
      quatAtDown = cube.object3D.quaternion.clone();
    } catch {
      quatAtDown = null;
    }
  };

  const onPointerMove = (e) => {
    if (!orbitPointerDown) return;
    if (cube.mouseInteraction?.active) faceDragPossibly = true;
    if (faceDragPossibly || orbitArmed || !pointerStart) return;
    const p = eventClient(e);
    const dx = p.x - pointerStart.x;
    const dy = p.y - pointerStart.y;
    if (Math.hypot(dx, dy) >= orbitThresholdPx()) {
      orbitArmed = true;
    }
  };

  const onPointerUp = () => {
    if (!orbitPointerDown) return;
    orbitPointerDown = false;
    const wasFace = faceDragPossibly || cube.mouseInteraction?.active;
    faceDragPossibly = false;

    // Short / unintentional orbit → restore start orientation (don’t stick)
    if (!wasFace && !orbitArmed && quatAtDown && cube.object3D?.quaternion) {
      cube.object3D.quaternion.copy(quatAtDown);
    }

    quatAtDown = null;
    pointerStart = null;
    orbitArmed = false;
  };

  container.addEventListener("mousedown", onPointerDown);
  container.addEventListener("touchstart", onPointerDown, { passive: true });
  container.addEventListener("touchmove", onPointerMove, { passive: true });
  container.addEventListener("touchend", onPointerUp);
  container.addEventListener("touchcancel", onPointerUp);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);

  return {
    cube,
    resize,
    healVisual,
    /** Always 0 — notation is cube-fixed (no orbit remap). */
    getViewYaw: () => 0,
    setViewYaw() {},
    resetViewYaw() {},
    setSuppressOrbitDetect() {},
    /** Cube-space move (F = green when white is on bottom). */
    twist(move) {
      const s = moveToErno(move);
      if (s) cube.twist(s);
    },
    /** Cube-space alg — not remapped by camera orbit. */
    twistAlg(alg) {
      const s = algToErno(alg);
      if (s) cube.twist(s);
    },
    shuffle(n = 25) {
      cube.shuffle(n);
    },
    undo() {
      if (!cube.twistQueue.history.length) return false;
      cube.undo();
      return true;
    },
    canUndo() {
      return cube.twistQueue.history.length > 0;
    },
    /** Drop twist history (e.g. after a scramble finishes animating). */
    clearHistory() {
      cube.twistQueue.empty(true);
      cube.historyQueue.empty(true);
      cube.undoing = false;
    },
    whenIdle(cb) {
      const tick = () => {
        const busy =
          cube.isTweening() !== 0 ||
          cube.twistQueue.future.length > 0 ||
          cube.historyQueue.future.length > 0;
        if (!busy) {
          healVisualSoon();
          cb?.();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    /** Hard reset: destroy and recreate (caller should replace this handle). */
    destroy() {
      container.removeEventListener("mousedown", onPointerDown);
      container.removeEventListener("touchstart", onPointerDown);
      container.removeEventListener("touchmove", onPointerMove);
      container.removeEventListener("touchend", onPointerUp);
      container.removeEventListener("touchcancel", onPointerUp);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      try {
        resizeObserver?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        cube.domElement?.remove();
      } catch {
        /* ignore */
      }
      container.innerHTML = "";
    },
  };
}

export { moveToErno, algToErno, twistToMove, Y_CYCLE };

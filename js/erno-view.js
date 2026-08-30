/**
 * Exact onlinecube.com drag behaviour via vendored ERNO / Cuber.
 * https://onlinecube.com — Chrome Cube Lab (Mark Lundin / Stewart Smith / Google Creative Lab)
 *
 * Drag around the cube is look-only (full trackball). A real y is inferred when
 * you start turning faces from a view that is already a quarter-turn around
 * yellow. Peeking at another side and looking back is not a y.
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
  let homeQuat = cube.object3D.quaternion.clone();

  try {
    cube.mouseInteraction.dragSpeed = 1.15;
  } catch {
    /* ignore */
  }

  // ERNO.Controls orbits on a miss using pageX * devicePixelRatio (broken on
  // iPhone). Look-around is ours; y is inferred from that view, not a 2nd gesture.
  cube.controls.update = () => {};

  const TAP_PX = 10;
  // Finger jitter on a sticker used to lock a slice after ~4px, then a fast
  // lift counted as a 90° flick. Require a real swipe before a face turn.
  const FLICK_MIN_PX = 28;
  const ORBIT_SPEED = 0.008;
  const Y_QUARTER = Math.PI / 2;
  let downPt = null;
  let lastPt = null;
  let quatAtDown = null;
  let orbiting = false;
  const orbitAxis = new THREE.Vector3();
  const orbitMatrix = new THREE.Matrix4();
  const yawTwist = new THREE.Quaternion();
  const yawRel = new THREE.Quaternion();
  const yawInv = new THREE.Quaternion();

  function midpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  function orbitBy(dx, dy) {
    // Camera-space trackball — same direction as the last look-around build.
    if (!dx && !dy) return;
    orbitAxis.set(dy, dx, 0);
    const len = orbitAxis.length();
    if (len < 1e-8) return;
    orbitAxis.divideScalar(len);
    cube.object3D.updateMatrixWorld(true);
    cube.camera.updateMatrixWorld(true);
    orbitMatrix.getInverse(cube.object3D.matrixWorld);
    orbitMatrix.multiply(cube.camera.matrixWorld);
    orbitAxis.transformDirection(orbitMatrix);
    cube.object3D.rotateOnAxis(orbitAxis, len * ORBIT_SPEED);
  }

  function eventClient(e) {
    if (e.touches && e.touches.length >= 2) return midpoint(e.touches);
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function hitPiece(pt) {
    const el = document.elementFromPoint(pt.x, pt.y);
    if (!el || typeof el.closest !== "function") return false;
    return !!el.closest(".sticker, .faceExtroverted, .cubelet");
  }

  function cancelFaceDrag() {
    try {
      cube.mouseInteraction.active = false;
    } catch {
      /* ignore */
    }
  }

  function extraYaw() {
    // Twist of the current view vs home, around world up (yellow).
    if (!homeQuat || !cube.object3D?.quaternion) return null;
    yawInv.copy(homeQuat).inverse();
    yawRel.copy(yawInv).multiply(cube.object3D.quaternion);
    yawTwist.set(0, yawRel.y, 0, yawRel.w);
    const len = Math.sqrt(
      yawTwist.x * yawTwist.x +
        yawTwist.y * yawTwist.y +
        yawTwist.z * yawTwist.z +
        yawTwist.w * yawTwist.w
    );
    if (len < 1e-8) return 0;
    yawTwist.x /= len;
    yawTwist.y /= len;
    yawTwist.z /= len;
    yawTwist.w /= len;
    let angle = 2 * Math.acos(Math.max(-1, Math.min(1, yawTwist.w)));
    if (yawTwist.y < 0) angle = -angle;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function absorbViewYawIntoY() {
    const d = extraYaw();
    if (d == null) return;
    const n = Math.max(-2, Math.min(2, Math.round(d / Y_QUARTER)));
    if (!n) return;
    cube.object3D.quaternion.copy(homeQuat);
    // Extra +yaw (R coming toward the camera) is cubing y′.
    const move = n === 2 || n === -2 ? "y2" : n > 0 ? "y'" : "y";
    const s = moveToErno(move);
    if (!s) return;
    const prev = cube.twistDuration;
    cube.twistDuration = 1;
    cube.twist(s);
    cube.twistDuration = prev;
  }

  function snapSlicesHome() {
    try {
      cube.slices.forEach((slice) => {
        slice.rotation = 0;
      });
    } catch {
      /* ignore */
    }
  }

  function suppressAccidentalFlick() {
    // Capture-phase pointerup runs before ERNO's mouseup/touchend. Disable
    // interaction so a twitch cannot commit a 90° twist, then snap the slice.
    try {
      cube.mouseInteraction.enabled = false;
      cube.mouseInteraction.active = false;
    } catch {
      /* ignore */
    }
    snapSlicesHome();
    requestAnimationFrame(() => {
      try {
        cube.mouseInteraction.enabled = cube.mouseControlsEnabled !== false;
      } catch {
        /* ignore */
      }
    });
  }

  const onPointerDown = (e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    hooks.onPlayStart?.();
    downPt = eventClient(e);
    lastPt = downPt;
    orbiting = false;
    try {
      quatAtDown = cube.object3D.quaternion.clone();
    } catch {
      quatAtDown = null;
    }
    if (e.touches && e.touches.length >= 2) {
      e.preventDefault();
      e.stopPropagation();
      orbiting = true;
      cancelFaceDrag();
      return;
    }
    if (downPt && !hitPiece(downPt)) {
      orbiting = true;
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    } else if (downPt) {
      absorbViewYawIntoY();
    }
  };

  const onPointerMove = (e) => {
    if (e.touches && e.touches.length >= 2) {
      e.preventDefault();
      orbiting = true;
      cancelFaceDrag();
      const p = midpoint(e.touches);
      if (lastPt) orbitBy(p.x - lastPt.x, p.y - lastPt.y);
      lastPt = p;
      return;
    }
    if (!orbiting || !lastPt) return;
    if (e.cancelable) e.preventDefault();
    const p = eventClient(e);
    orbitBy(p.x - lastPt.x, p.y - lastPt.y);
    lastPt = p;
  };

  const onPointerUp = (e) => {
    if (e.touches && e.touches.length > 0) {
      if (e.touches.length >= 2) {
        lastPt = midpoint(e.touches);
        orbiting = true;
      } else {
        lastPt = eventClient(e);
      }
      return;
    }
    if (!downPt) {
      orbiting = false;
      lastPt = null;
      return;
    }
    const p = eventClient(e);
    const dist = Math.hypot(p.x - downPt.x, p.y - downPt.y);
    if (!orbiting && dist < FLICK_MIN_PX) {
      suppressAccidentalFlick();
    }
    // Tap jitter only — never undo a real look-around drag.
    if (!orbiting && dist < TAP_PX && quatAtDown && cube.object3D?.quaternion) {
      cube.object3D.quaternion.copy(quatAtDown);
    }
    downPt = null;
    lastPt = null;
    quatAtDown = null;
    orbiting = false;
    hooks.onPlayEnd?.();
  };

  const resize = () => {
    const w = Math.max(container.clientWidth || 0, 220);
    const h = Math.max(container.clientHeight || 0, 220);
    cube.setSize(w, h);
    const compact = window.matchMedia("(max-width: 920px)").matches;
    // Phone stage is tall; keep the whole cube in the upper half so the
    // guide sheet cannot crop it into a "zoomed corner".
    cube.camera.position.z = (compact ? 5.35 : 4) * cube.size;
    cube.object3D.position.y = compact ? 0.55 * cube.size : 0;
  };
  resize();
  let resizeObserver = null;
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
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

  const mouseListen = { capture: true };
  const touchListen = { passive: false, capture: true };
  container.addEventListener("mousedown", onPointerDown, mouseListen);
  container.addEventListener("touchstart", onPointerDown, touchListen);
  container.addEventListener("touchmove", onPointerMove, touchListen);
  container.addEventListener("touchend", onPointerUp, touchListen);
  container.addEventListener("touchcancel", onPointerUp, touchListen);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp, mouseListen);

  // Play-focus is pointer-only so toolbar taps do not restore the sheet, and so
  // Chrome's pointer events still hide hints when a flick starts.
  let playPointerId = null;
  const onPlayPointerDown = (e) => {
    if (playPointerId !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    playPointerId = e.pointerId;
    hooks.onPlayStart?.();
  };
  const onPlayPointerUp = (e) => {
    if (playPointerId === null) return;
    if (e.type !== "pointercancel" && e.pointerId !== playPointerId) return;
    playPointerId = null;
    hooks.onPlayEnd?.();
  };
  container.addEventListener("pointerdown", onPlayPointerDown, { capture: true });
  window.addEventListener("pointerup", onPlayPointerUp);
  window.addEventListener("pointercancel", onPlayPointerUp);

  return {
    cube,
    resize,
    healVisual,
    /** Always 0 — notation is cube-fixed (no orbit remap). */
    getViewYaw: () => 0,
    setViewYaw() {},
    resetViewYaw() {},
    setSuppressOrbitDetect() {},
    /** Cube-space move. Look-around is not a y until you turn from that view. */
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
      container.removeEventListener("mousedown", onPointerDown, mouseListen);
      container.removeEventListener("touchstart", onPointerDown, touchListen);
      container.removeEventListener("touchmove", onPointerMove, touchListen);
      container.removeEventListener("touchend", onPointerUp, touchListen);
      container.removeEventListener("touchcancel", onPointerUp, touchListen);
      container.removeEventListener("pointerdown", onPlayPointerDown, { capture: true });
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp, mouseListen);
      window.removeEventListener("pointerup", onPlayPointerUp);
      window.removeEventListener("pointercancel", onPlayPointerUp);
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

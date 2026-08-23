/**
 * Exact onlinecube.com drag behaviour via vendored ERNO / Cuber.
 * https://onlinecube.com — Chrome Cube Lab (Mark Lundin / Stewart Smith / Google Creative Lab)
 *
 * Orbit (drag around the cube) is treated like turning the cube in your hands:
 * when a new side faces you, we record y / y' / y2 and remap F/R/L/B so F stays
 * “the face toward you”. Piece flicks are unchanged.
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

/** Side faces in y-cycle: one y sends F→R→B→L→F. */
const Y_CYCLE = ["F", "R", "B", "L"];

/**
 * viewYaw = how many y' from cube-space to viewer-space
 * (1 ⇒ cube R is what the viewer calls F).
 */
function mapSideFace(face, yaw, invert) {
  const i = Y_CYCLE.indexOf(face);
  if (i < 0) return face;
  const y = ((yaw % 4) + 4) % 4;
  const j = invert ? (i - y + 4) % 4 : (i + y) % 4;
  return Y_CYCLE[j];
}

/** Viewer notation → cube-space notation (for sending twists to ERNO). */
function viewMoveToCubeMove(move, viewYaw) {
  const m = String(move).trim();
  if (!m) return m;
  const face = m[0];
  const rest = m.slice(1);
  const upper = face.toUpperCase();
  if ("xyzXYZ".includes(face)) return face.toLowerCase() + rest;
  if (upper === "U" || upper === "D") return upper + rest;
  if (!Y_CYCLE.includes(upper)) return m;
  return mapSideFace(upper, viewYaw, false) + rest;
}

/** Cube-space notation → viewer notation (for history / facelets after orbit y). */
function cubeMoveToViewMove(move, viewYaw) {
  const m = String(move).trim();
  if (!m) return m;
  const face = m[0];
  const rest = m.slice(1);
  const upper = face.toUpperCase();
  if ("xyzXYZ".includes(face)) return face.toLowerCase() + rest;
  if (upper === "U" || upper === "D") return upper + rest;
  if (!Y_CYCLE.includes(upper)) return m;
  return mapSideFace(upper, viewYaw, true) + rest;
}

function yawDeltaToMove(delta) {
  const d = ((delta % 4) + 4) % 4;
  if (d === 0) return null;
  if (d === 1) return "y'";
  if (d === 2) return "y2";
  return "y"; // d === 3
}

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

  /** Viewer yaw in y' steps; F/R/L/B buttons follow the face toward you. */
  let viewYaw = 0;
  let orbitPointerDown = false;
  let quatAtDown = null;
  let faceDragPossibly = false;

  const resize = () => {
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 280;
    cube.setSize(w, h);
  };
  resize();

  function healVisual() {
    try {
      cube.showPlastics();
      cube.showStickers();
      // Keep internal faces painted — holes often come from stuck introverts
      cube.showIntroverts(null, true);
      // Only unstick pieces that drifted (don't yank mid-tween matrices)
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
    } catch {
      /* ignore */
    }
  }

  function cameraDirInCubeSpace() {
    cube.object3D.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().getInverse(cube.object3D.matrixWorld);
    return cube.camera.position.clone().applyMatrix4(inv).normalize();
  }

  /** Which cube face is most toward the camera (among UDFBRL). */
  function dominantCubeFace() {
    const toCam = cameraDirInCubeSpace();
    const faces = [
      ["F", new THREE.Vector3(0, 0, 1)],
      ["B", new THREE.Vector3(0, 0, -1)],
      ["R", new THREE.Vector3(1, 0, 0)],
      ["L", new THREE.Vector3(-1, 0, 0)],
      ["U", new THREE.Vector3(0, 1, 0)],
      ["D", new THREE.Vector3(0, -1, 0)],
    ];
    let best = "F";
    let bestDot = -Infinity;
    for (const [id, n] of faces) {
      const d = n.dot(toCam);
      if (d > bestDot) {
        bestDot = d;
        best = id;
      }
    }
    return { face: best, dot: bestDot };
  }

  /**
   * If orbit left U roughly on top and a new side in front, record y/y'/y2
   * and remap F → that side (R or L, etc.). Does not twist ERNO — camera already did.
   */
  let suppressOrbitDetect = false;

  function detectOrbitYaw() {
    if (suppressOrbitDetect) return;
    if (cube.isTweening() !== 0) return;
    if (cube.mouseInteraction?.active) return;
    if (hooks.shouldIgnoreTwist?.()) return;

    const { face, dot } = dominantCubeFace();
    if (dot < 0.45) return;

    // Need U still “up-ish” so this is a y-turn, not an x/z flip
    const toCam = cameraDirInCubeSpace();
    const uDot = new THREE.Vector3(0, 1, 0).dot(toCam);
    const dDot = new THREE.Vector3(0, -1, 0).dot(toCam);
    // Camera looks from above-front usually; U should not be the front face
    if (face === "U" || face === "D") return;
    if (uDot < -0.35 || dDot > 0.55) return; // upside down-ish

    const newYaw = Y_CYCLE.indexOf(face);
    if (newYaw < 0) return;
    const delta = (newYaw - viewYaw + 4) % 4;
    const move = yawDeltaToMove(delta);
    if (!move) return;

    viewYaw = newYaw;
    // Camera already orbited — remap F only; do not mutate facelet state.
    hooks.onTwist?.({ cubeMove: null, viewMove: move, virtual: true });
  }

  cube.addEventListener("onTwistComplete", (e) => {
    const twist = e.detail?.twist;
    if (!twist || twist.degrees === 0) return;
    const cubeMove = twistToMove(twist);
    if (!cubeMove) return;
    hooks.onTwist?.({
      cubeMove,
      viewMove: cubeMoveToViewMove(cubeMove, viewYaw),
      virtual: false,
    });
    healVisual();
  });

  cube.addEventListener("onShuffleComplete", () => {
    healVisual();
    hooks.onShuffleComplete?.();
  });

  const onPointerDown = (e) => {
    if (e.type === "mousedown" && e.button !== 0) return;
    orbitPointerDown = true;
    faceDragPossibly = false;
    try {
      quatAtDown = cube.object3D.quaternion.clone();
    } catch {
      quatAtDown = null;
    }
  };
  const onPointerMove = () => {
    if (!orbitPointerDown) return;
    if (cube.mouseInteraction?.active) faceDragPossibly = true;
  };
  const onPointerUp = () => {
    if (!orbitPointerDown) return;
    orbitPointerDown = false;
    const wasFace = faceDragPossibly || cube.mouseInteraction?.active;
    faceDragPossibly = false;

    let orbitChanged = false;
    if (quatAtDown && cube.object3D?.quaternion) {
      orbitChanged = quatAtDown.dot(cube.object3D.quaternion) < 0.999;
    }
    quatAtDown = null;

    if (!wasFace && orbitChanged) {
      // Let damping settle a frame, then snap-detect yaw
      requestAnimationFrame(() => {
        requestAnimationFrame(() => detectOrbitYaw());
      });
    }
  };

  container.addEventListener("mousedown", onPointerDown);
  container.addEventListener("touchstart", onPointerDown, { passive: true });
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("touchend", onPointerUp);

  return {
    cube,
    resize,
    healVisual,
    getViewYaw: () => viewYaw,
    setViewYaw(yaw) {
      viewYaw = ((yaw % 4) + 4) % 4;
    },
    resetViewYaw() {
      viewYaw = 0;
    },
    setSuppressOrbitDetect(on) {
      suppressOrbitDetect = !!on;
    },
    /** Viewer-space move (F = face toward you). */
    twist(move) {
      const cubeMove = viewMoveToCubeMove(move, viewYaw);
      const s = moveToErno(cubeMove);
      if (s) cube.twist(s);
    },
    /** Viewer-space alg. */
    twistAlg(alg) {
      const mapped = String(alg)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((m) => viewMoveToCubeMove(m, viewYaw))
        .join(" ");
      const s = algToErno(mapped);
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
          healVisual();
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
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      try {
        cube.domElement?.remove();
      } catch {
        /* ignore */
      }
      container.innerHTML = "";
    },
  };
}

export { moveToErno, algToErno, twistToMove, viewMoveToCubeMove, cubeMoveToViewMove, Y_CYCLE };

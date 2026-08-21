/**
 * Exact onlinecube.com drag behaviour via vendored ERNO / Cuber.
 * https://onlinecube.com — Chrome Cube Lab (Mark Lundin / Stewart Smith / Google Creative Lab)
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
  });

  container.appendChild(cube.domElement);

  // Same default tilt as onlinecube.com
  const tilt = new THREE.Euler(0.1 * Math.PI, -0.25 * Math.PI, 0);
  cube.object3D.lookAt(cube.camera.position);
  cube.rotation.x += tilt.x;
  cube.rotation.y += tilt.y;
  cube.rotation.z += tilt.z;

  const resize = () => {
    const w = container.clientWidth || 320;
    const h = container.clientHeight || 280;
    cube.setSize(w, h);
  };
  resize();

  cube.addEventListener("onTwistComplete", (e) => {
    const twist = e.detail?.twist;
    if (!twist || twist.degrees === 0) return;
    const move = twistToMove(twist);
    if (move) hooks.onTwist?.(move);
    // After whole-cube turns, force plastic faces stable (avoids introvert flicker)
    const cmd = String(twist.command || "").toLowerCase();
    if (cmd === "x" || cmd === "y" || cmd === "z") {
      try {
        cube.showIntroverts(null, true);
      } catch {
        /* ignore */
      }
    }
  });

  cube.addEventListener("onShuffleComplete", () => {
    hooks.onShuffleComplete?.();
  });

  return {
    cube,
    resize,
    twist(move) {
      const s = moveToErno(move);
      if (s) cube.twist(s);
    },
    twistAlg(alg) {
      const s = algToErno(alg);
      if (s) cube.twist(s);
    },
    shuffle(n = 25) {
      cube.shuffle(n);
    },
    /** Hard reset: destroy and recreate (caller should replace this handle). */
    destroy() {
      try {
        cube.domElement?.remove();
      } catch {
        /* ignore */
      }
      container.innerHTML = "";
    },
  };
}

export { moveToErno, algToErno, twistToMove };

/**
 * Whole-cube rotations from a smart-cube GYRO quaternion stream.
 * Face turns leave the housing attitude alone; tilting the cube in your hands
 * jumps the quaternion. We snap those jumps to x / y / z (and doubles), and
 * also stream the live attitude so the on-screen cube can follow the tilt.
 *
 * GAN firmware quaternions are in the cube's white-U / green-F body frame.
 * Training algs use yellow-U / green-F (Acubemy hold). The same physical tip
 * that brings yellow toward you is therefore a −90° pitch about +X in the GAN
 * frame (white goes to back), which we label x' to match Cube Academy.
 */

const AXES = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const ROT_FACE = {
  // Cube Academy / Acubemy: x' tips yellow (app U) toward you (to F).
  // cubejs Singmaster matches this for yellow-U: after x', F holds U.
  x: { U: "B", B: "D", D: "F", F: "U", R: "R", L: "L" },
  "x'": { U: "F", F: "D", D: "B", B: "U", R: "R", L: "L" },
  x2: { U: "D", D: "U", F: "B", B: "F", R: "R", L: "L" },
  y: { F: "L", L: "B", B: "R", R: "F", U: "U", D: "D" },
  "y'": { F: "R", R: "B", B: "L", L: "F", U: "U", D: "D" },
  y2: { F: "B", B: "F", L: "R", R: "L", U: "U", D: "D" },
  z: { U: "L", L: "D", D: "R", R: "U", F: "F", B: "B" },
  "z'": { U: "R", R: "D", D: "L", L: "U", F: "F", B: "B" },
  z2: { U: "D", D: "U", L: "R", R: "L", F: "F", B: "B" },
};

export function isRotationMove(move) {
  const t = String(move || "").trim();
  return Boolean(ROT_FACE[t]);
}

export function identityFaceMap() {
  return { U: "U", R: "R", F: "F", D: "D", L: "L", B: "B" };
}

export function composeFaceMap(a, b) {
  const out = {};
  for (const face of Object.keys(a)) out[face] = b[a[face]] || a[face];
  return out;
}

/** Where each home centre sits after the listed whole-cube rotations. */
export function basisFaceMap(rotations) {
  let map = identityFaceMap();
  for (const rot of rotations || []) {
    const step = ROT_FACE[String(rot || "").trim()];
    if (step) map = composeFaceMap(map, step);
  }
  return map;
}

/**
 * Map a sticker-fixed coach face turn into alg-space after matched whole-cube
 * rotations. After x' (yellow tipped toward you), the old B centre sits on top;
 * turning that physical top face must read as alg U — never D'.
 */
export function physicalMoveToAlgMove(move, rotations) {
  const token = String(move || "").trim();
  if (!token) return "";
  if (isRotationMove(token)) return token;
  const face = token[0];
  const suffix = token.slice(1);
  if (!"URFDLB".includes(face)) return token;
  // basisFaceMap: home centre → slot after the tilts. Remap the sticker face
  // the cube reported into the alg face name for that slot.
  const mapped = basisFaceMap(rotations)[face] || face;
  return mapped + suffix;
}

function quatLen(q) {
  return Math.hypot(q.x || 0, q.y || 0, q.z || 0, q.w || 0) || 1;
}

export function normalizeQuat(q) {
  const n = quatLen(q);
  return { x: (q.x || 0) / n, y: (q.y || 0) / n, z: (q.z || 0) / n, w: (q.w || 0) / n };
}

export function quatConjugate(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatMul(a, b) {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** Rotation that takes q0's attitude to q1's (body frame at q0). */
export function relativeQuat(q0, q1) {
  if (!q0 || !q1) return normalizeQuat({ x: 0, y: 0, z: 0, w: 1 });
  return quatMul(normalizeQuat(q1), quatConjugate(normalizeQuat(q0)));
}

function rotateVec(q, v) {
  const p = { x: v[0], y: v[1], z: v[2], w: 0 };
  const r = quatMul(quatMul(q, p), quatConjugate(q));
  return [r.x, r.y, r.z];
}

function axisAngleFromQuat(q) {
  const n = normalizeQuat(q);
  let w = n.w;
  if (w > 1) w = 1;
  if (w < -1) w = -1;
  // Prefer the shorter arc.
  const sign = w < 0 ? -1 : 1;
  const qw = w * sign;
  const qx = n.x * sign;
  const qy = n.y * sign;
  const qz = n.z * sign;
  const angle = 2 * Math.acos(qw);
  const s = Math.sqrt(Math.max(0, 1 - qw * qw));
  if (s < 1e-6) return { axis: [1, 0, 0], angle: 0 };
  return { axis: [qx / s, qy / s, qz / s], angle };
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Relative housing rotation from q0 → q1, snapped to a single x/y/z move.
 * Returns "" when the jump is too small or not a clean face-axis turn.
 *
 * Axis sense matches the GAN white-U body frame: +90° about +X pitches white
 * (GAN U) toward green (F) → our x (yellow away). −90° pitches yellow toward
 * you → x'. Do not flip the x axis — that made yellow-to-self report as x.
 */
export function rotationBetweenQuats(q0, q1, { minAngle = 0.55, axisDot = 0.82 } = {}) {
  if (!q0 || !q1) return "";
  const rel = relativeQuat(q0, q1);
  // Express the rotation axis in the cube body frame at q0.
  const { axis: worldAxis, angle } = axisAngleFromQuat(rel);
  if (angle < minAngle) return "";
  const bodyAxis = rotateVec(quatConjugate(normalizeQuat(q0)), worldAxis);
  let best = "";
  let bestScore = axisDot;
  for (const [name, axis] of Object.entries(AXES)) {
    const d = dot(bodyAxis, axis);
    const ad = Math.abs(d);
    if (ad < bestScore) continue;
    bestScore = ad;
    const turns = Math.round(angle / (Math.PI / 2));
    if (turns <= 0) continue;
    const k = ((turns % 4) + 4) % 4;
    if (k === 0) continue;
    const positive = d >= 0;
    // Right-hand in the GAN body frame: +x → x, +y → y, +z → z.
    if (k === 2) best = `${name}2`;
    else if (k === 1) best = positive ? name : `${name}'`;
    else best = positive ? `${name}'` : name; // 3 quarters = opposite prime
  }
  return best;
}

/**
 * CSS matrix3d() for a unit quaternion (column-major, local → parent).
 * Cubie axes: x right, y up, z toward camera — same as the quat body frame.
 */
export function quatToCssMatrix3d(q) {
  const n = normalizeQuat(q || { x: 0, y: 0, z: 0, w: 1 });
  const { x, y, z, w } = n;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;
  const m00 = 1 - 2 * (yy + zz);
  const m01 = 2 * (xy - wz);
  const m02 = 2 * (xz + wy);
  const m10 = 2 * (xy + wz);
  const m11 = 1 - 2 * (xx + zz);
  const m12 = 2 * (yz - wx);
  const m20 = 2 * (xz - wy);
  const m21 = 2 * (yz + wx);
  const m22 = 1 - 2 * (xx + yy);
  const f = (v) => {
    const n = Math.abs(v) < 1e-10 ? 0 : v;
    return Number(n.toFixed(6));
  };
  // matrix3d is column-major: (m00, m10, m20, 0, m01, m11, m21, 0, ...)
  return `matrix3d(${f(m00)}, ${f(m10)}, ${f(m20)}, 0, ${f(m01)}, ${f(m11)}, ${f(m21)}, 0, ${f(m02)}, ${f(m12)}, ${f(m22)}, 0, 0, 0, 0, 1)`;
}

/**
 * Follow a GYRO stream: emit discrete whole-cube moves after settle, and stream
 * live orientation every packet so the 3D cube can track the housing.
 * Face turns should not call observe — only GYRO packets.
 */
export function createGyroTracker({ onRotation, onOrientation, settleMs = 120, minAngle = 0.55 } = {}) {
  let home = null;
  let settled = null;
  let candidate = null;
  let timer = 0;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  }

  function observe(quaternion) {
    if (!quaternion) return;
    const q = normalizeQuat(quaternion);
    if (!home) {
      home = q;
      settled = q;
      candidate = q;
      onOrientation?.(q, {
        home,
        relative: normalizeQuat({ x: 0, y: 0, z: 0, w: 1 }),
      });
      return;
    }
    candidate = q;
    const relative = relativeQuat(home, q);
    onOrientation?.(q, { home, relative });
    clearTimer();
    timer = setTimeout(() => {
      timer = 0;
      const from = settled || home;
      const move = rotationBetweenQuats(from, candidate, { minAngle });
      settled = candidate;
      if (move) onRotation?.(move);
    }, settleMs);
  }

  function reset() {
    clearTimer();
    home = null;
    settled = null;
    candidate = null;
  }

  /**
   * Treat the current physical attitude as the new home (yellow U / green F).
   * Clears the settle timer, snaps live relative orientation to identity, and
   * makes the next discrete x/y/z snaps measure from this hold. Pass a quat to
   * force that attitude; otherwise uses the latest GYRO packet.
   */
  function rehome(quaternion) {
    clearTimer();
    const q = quaternion
      ? normalizeQuat(quaternion)
      : candidate || settled || home;
    if (!q) {
      home = null;
      settled = null;
      candidate = null;
      return false;
    }
    home = q;
    settled = q;
    candidate = q;
    const identity = normalizeQuat({ x: 0, y: 0, z: 0, w: 1 });
    onOrientation?.(q, { home, relative: identity });
    return true;
  }

  function dispose() {
    reset();
  }

  return { observe, reset, rehome, dispose };
}

/**
 * Phone cube contracts. The 21af0db flick deadzone and look-only orbit are the
 * last verified “I can actually solve” UX. Tests import these so a later
 * experiment cannot silently remap R/L′ into D/D′.
 */

export const TAP_PX = 10;
/** Finger jitter on a sticker used to lock a slice after ~4px. */
export const FLICK_MIN_PX = 28;
export const ORBIT_SPEED = 0.008;

/** Camera orbit must never rewrite a face flick (no inferred y/x/z on pointer down). */
export const ORBIT_REMAPS_FLICKS = false;

/**
 * ERNO momentum may finish an incomplete flick into 90°, but must never promote
 * an already-committed quarter turn into a half turn (slow R → R2).
 * Mirrored in vendor/erno.js Interaction release; keep both in sync.
 */
export const FLICK_MOMENTUM_MIN_VELOCITY = 0.55;
export const FLICK_MOMENTUM_MIN_ANGLE = 0.2;
/** Ignore momentum if the finger has been still this long before lift (ms). */
export const FLICK_MOMENTUM_IDLE_MS = 150;

/**
 * Phone flicks never commit a half turn. Intentional doubles are two quarter
 * flicks (U U), so a single drag past 135°/150° must still log U — not U2.
 * Kept as Infinity so older tests/docs can still import the name.
 * Mirrored in vendor/erno.js; keep both in sync.
 */
export const FLICK_HALF_TURN_DEG = Infinity;

/**
 * Snap a live drag angle (radians) to the twist that should commit on lift.
 * Phone drags cap at one quarter turn; half turns are never emitted.
 * @param {number} angleRad live slice rotation
 * @param {{ velocity?: number, idleMs?: number }} motion
 * @returns {number} snapped angle in radians (0 or ±π/2)
 */
export function snapFlickAngle(angleRad, motion = {}) {
  const velocity = motion.velocity ?? 0;
  const idleMs = motion.idleMs ?? 0;
  const quarter = Math.PI * 0.5;
  const abs = Math.abs(angleRad);
  const sign = angleRad >= 0 ? 1 : -1;

  // Below 45° cancel; anything further is one quarter — never 180°.
  let snapped = abs < quarter * 0.5 ? 0 : sign * quarter;

  // Momentum only when snap would cancel — never turns R into R2.
  if (
    velocity > FLICK_MOMENTUM_MIN_VELOCITY &&
    Math.abs(angleRad) > FLICK_MOMENTUM_MIN_ANGLE &&
    snapped === 0 &&
    idleMs < FLICK_MOMENTUM_IDLE_MS
  ) {
    snapped = angleRad > 0 ? quarter : -quarter;
  }
  return snapped;
}

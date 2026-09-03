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
 * Prefer a single quarter turn unless the drag is clearly a half turn.
 * Math.round’s 135° cliff was too eager: a quick U aiming for 90° that
 * overshoots to ~140° (easy with dragSpeed > 1) logged as U2.
 * Mirrored in vendor/erno.js; keep both in sync.
 */
export const FLICK_HALF_TURN_DEG = 150;

/**
 * Snap a live drag angle (radians) to the twist that should commit on lift.
 * @param {number} angleRad live slice rotation
 * @param {{ velocity?: number, idleMs?: number }} motion
 * @returns {number} snapped angle in radians (0, ±π/2, ±π, …)
 */
export function snapFlickAngle(angleRad, motion = {}) {
  const velocity = motion.velocity ?? 0;
  const idleMs = motion.idleMs ?? 0;
  const quarter = Math.PI * 0.5;
  const abs = Math.abs(angleRad);
  const sign = angleRad >= 0 ? 1 : -1;
  const halfMin = (FLICK_HALF_TURN_DEG / 90) * quarter;

  let snapped;
  if (abs < quarter * 0.5) {
    snapped = 0;
  } else if (abs < halfMin) {
    // 45° … just-under-150° → one quarter (not Math.round’s 135° → 180°)
    snapped = sign * quarter;
  } else {
    snapped = sign * Math.round(abs / quarter) * quarter;
  }

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

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

/**
 * Web Bluetooth is Chrome-only here. Mac Chrome is the target; other browsers
 * get a plain explanation instead of a dead Connect button.
 */

export function bluetoothBlocker(bluetooth = globalThis.navigator?.bluetooth) {
  if (!bluetooth || typeof bluetooth.requestDevice !== "function") {
    return "Web Bluetooth isn't available in this browser. Open the timer in Chrome on a Mac — the site is already on HTTPS.";
  }
  return "";
}

export async function bluetoothAdapterMessage(bluetooth = globalThis.navigator?.bluetooth) {
  const blocked = bluetoothBlocker(bluetooth);
  if (blocked) return blocked;
  if (typeof bluetooth.getAvailability !== "function") return "";
  try {
    const available = await bluetooth.getAvailability();
    if (!available) return "Chrome can't see a Bluetooth adapter. Turn Bluetooth on, then connect the cube.";
  } catch {
    return "Chrome couldn't check Bluetooth. Turn Bluetooth on and try Connect again.";
  }
  return "";
}

export function connectErrorMessage(error) {
  const name = String(error?.name || "");
  if (name === "NotFoundError" || name === "AbortError") return "No cube selected.";
  if (name === "SecurityError") {
    return "Web Bluetooth needs Chrome on HTTPS. Open this timer in Chrome on a Mac.";
  }
  if (name === "NotSupportedError") return "This browser doesn't support Web Bluetooth. Use Chrome on a Mac.";
  return "Couldn't connect. Wake the cube by turning a face, keep it close, and try again.";
}

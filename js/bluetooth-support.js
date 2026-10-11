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

/** Chrome hides advertisement manufacturer data (the GAN MAC) until this flag is on. */
export const CHROME_BLUETOOTH_MAC_FLAG = "chrome://flags/#enable-web-bluetooth-new-permissions-backend";

/** Thrown by us and by the library when ads, cache, and the prompt all miss. */
export const MAC_UNAVAILABLE_ERROR = "Unable to determine cube MAC address, connection is not possible!";

export const MAC_CONNECT_GUIDANCE =
  `Enter the cube's Bluetooth MAC (aa:bb:cc:dd:ee:ff), or enable ${CHROME_BLUETOOTH_MAC_FLAG} so Chrome can read it from advertisements, then try again.`;

export const MAC_FORM_HELP =
  `${MAC_CONNECT_GUIDANCE} The address is listed for the paired cube in chrome://bluetooth-internals.`;

const WAKE_CUBE = "Couldn't connect. Wake the cube by turning a face, keep it close, and try again.";

export function connectErrorMessage(error) {
  const name = String(error?.name || "");
  if (name === "NotFoundError" || name === "AbortError") return "No cube selected.";
  if (name === "SecurityError") {
    return "Web Bluetooth needs Chrome on HTTPS. Open this timer in Chrome on a Mac.";
  }
  if (name === "NotSupportedError") return "This browser doesn't support Web Bluetooth. Use Chrome on a Mac.";
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (/unable to determine/i.test(message) && /mac/i.test(message)) {
    return `${message} ${MAC_CONNECT_GUIDANCE}`;
  }
  if (message) return message;
  return WAKE_CUBE;
}

/**
 * GAN Gen2/3/4 salt AES with the six-byte Bluetooth MAC. Accept the same
 * separators the library does and return a lowercase colon form.
 */
export function normalizeCubeMac(value) {
  const parts = String(value ?? "")
    .trim()
    .split(/[:\-\s]+/)
    .filter(Boolean);
  if (parts.length !== 6) return "";
  const bytes = [];
  for (const part of parts) {
    if (!/^[0-9a-fA-F]{1,2}$/.test(part)) return "";
    bytes.push(Number.parseInt(part, 16).toString(16).padStart(2, "0"));
  }
  return bytes.join(":");
}

/**
 * The library calls this only after advertisements and its device cache miss.
 * Ask immediately. Cancelling throws so another advertisement scan does not
 * run. A MAC saved after a previous successful connect short-circuits the prompt.
 */
export function createMacAddressProvider({ getCachedMac, requestMac }) {
  return async function macAddressProvider(device) {
    let cached = null;
    try {
      cached = getCachedMac?.(device) ?? null;
    } catch {
      cached = null;
    }
    if (typeof cached === "string" && cached.trim()) return cached.trim();
    const mac = await requestMac?.(device);
    if (!mac) throw new Error(MAC_UNAVAILABLE_ERROR);
    return mac;
  };
}

/**
 * Inline MAC form. Resolves to a normalized MAC, or null when cancelled.
 * Invalid input stays on the form so the connect attempt can continue.
 */
export function bindMacPrompt({ form, input, cancelButton, setStatus, initialValue = "", onAccept }) {
  return function requestMac(device) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        form.hidden = true;
        form.removeEventListener("submit", onSubmit);
        cancelButton.removeEventListener("click", onCancel);
        resolve(value);
      };
      const onSubmit = (event) => {
        event.preventDefault();
        const mac = normalizeCubeMac(input.value);
        if (!mac) {
          setStatus?.("Enter a 6-byte Bluetooth MAC like aa:bb:cc:dd:ee:ff.");
          input.focus?.();
          return;
        }
        onAccept?.(mac);
        finish(mac);
      };
      const onCancel = () => finish(null);
      const label = String(device?.name || "").trim();
      setStatus?.(
        label
          ? `${label} needs its Bluetooth MAC before the connection can finish.`
          : "This cube needs its Bluetooth MAC before the connection can finish."
      );
      const seed = typeof initialValue === "function" ? initialValue() : initialValue;
      input.value = typeof seed === "string" ? seed : "";
      form.hidden = false;
      form.addEventListener("submit", onSubmit);
      cancelButton.addEventListener("click", onCancel);
      input.focus?.();
      input.select?.();
    });
  };
}

export function promptForCubeMac(promptImpl = globalThis.prompt) {
  if (typeof promptImpl !== "function") return "";
  try {
    return normalizeCubeMac(promptImpl(MAC_CONNECT_GUIDANCE) ?? "");
  } catch {
    return "";
  }
}

/** Late Bluetooth-availability checks must not replace a failure or a live attempt. */
export function shouldApplyAdapterIdleStatus({ connected = false, busy = false, settled = false } = {}) {
  return !connected && !busy && !settled;
}

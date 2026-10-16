import { connectSmartCube, getCachedMacForDevice } from "../vendor/smartcube-web-bluetooth.js";
import {
  MAC_FORM_HELP,
  bindMacPrompt,
  bluetoothAdapterMessage,
  bluetoothBlocker,
  connectErrorMessage,
  createMacAddressProvider,
  normalizeCubeMac,
  promptForCubeMac,
  shouldApplyAdapterIdleStatus,
} from "./bluetooth-support.js?v=cube2";
import { createCubeMirror } from "./cube-mirror.js?v=gyro5";
import { faceletsForScramble, renderCubeNet } from "./cube-reconstruction.js?v=lllive1";
import { createGyroTracker } from "./cube-gyro.js?v=gyro5";
import { ganFaceletsToApp, ganMoveToApp, normalizeMoves } from "./move-log.js?v=lllive1";

const FEED_LIMIT = 24;
const MAC_DRAFT_KEY = "gan-cube-mac-draft";

function readMacDraft() {
  try {
    return normalizeCubeMac(localStorage.getItem(MAC_DRAFT_KEY) || "");
  } catch {
    return "";
  }
}

function writeMacDraft(mac) {
  try {
    localStorage.setItem(MAC_DRAFT_KEY, mac);
  } catch {
    /* private mode or a full store */
  }
}

/**
 * Connect panel for a GAN smart cube (Gen3/Gen4, including i4 and GAN12 ui Maglev).
 * The library filters advertised names that start with GAN, MG, or AiCube.
 */
export function initSmartCube({ timer } = {}) {
  const root = document.getElementById("cube-connect");
  const statusEl = document.getElementById("cube-connect-status");
  const metaEl = document.getElementById("cube-connect-meta");
  const slotEl = document.getElementById("cube-connect-3d");
  const cubeEl = document.getElementById("cube-connect-cube");
  const sceneEl = document.getElementById("cube-connect-scene");
  const hintEl = document.getElementById("cube-connect-hint");
  const flatEl = document.getElementById("cube-connect-flat");
  const netEl = document.getElementById("cube-connect-net");
  const feedEl = document.getElementById("cube-connect-feed");
  const button = document.getElementById("cube-connect-btn");
  const resetGyroBtn = document.getElementById("cube-gyro-reset");
  const macForm = document.getElementById("cube-connect-mac");
  const macInput = document.getElementById("cube-connect-mac-input");
  const macCancel = document.getElementById("cube-connect-mac-cancel");
  const macHelp = document.getElementById("cube-connect-mac-help");
  if (!root || !statusEl || !button) return { disconnect() {} };
  if (macHelp) macHelp.textContent = MAC_FORM_HELP;

  const reducedMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mirror = cubeEl ? createCubeMirror(cubeEl, { reducedMotion }) : null;
  mirror?.bindOrbit(sceneEl);

  let session = null;
  let battery = null;
  let facelets = "";
  let mirroredFacelets = "";
  let replaying = false;
  let feed = [];
  let busy = false;
  let adapterNote = "";
  let statusSettled = false;
  const gyro = createGyroTracker({
    onRotation(move) {
      rememberMove(move);
      timer?.onCubeRotation?.(move);
    },
    onOrientation(_q, { relative } = {}) {
      mirror?.setHousingOrientation?.(relative);
      timer?.onCubeGyro?.(relative);
    },
  });

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function paint() {
    const connected = Boolean(session);
    button.textContent = connected ? "Disconnect" : "Connect";
    button.disabled = busy;
    button.classList.toggle("btn-ghost", connected);
    if (resetGyroBtn) {
      resetGyroBtn.hidden = !connected;
      resetGyroBtn.disabled = busy || !connected;
    }
    if (metaEl) {
      if (!connected) {
        metaEl.hidden = true;
        metaEl.textContent = "";
      } else {
        const bits = [session.name || "GAN cube"];
        if (session.protocol) bits.push(session.protocol);
        if (battery != null) bits.push(`${battery}% battery`);
        metaEl.hidden = false;
        metaEl.textContent = bits.join(" · ");
      }
    }
    const showCube = connected;
    if (slotEl) slotEl.hidden = !showCube;
    if (hintEl) {
      hintEl.textContent = facelets ? "Drag to look around" : "Reading the cube…";
    }
    if (flatEl) flatEl.hidden = !facelets;
    if (netEl) {
      const net = facelets ? renderCubeNet(facelets) : "";
      netEl.innerHTML = net;
    }
    if (mirror) {
      if (!connected) {
        mirror.reset();
        mirroredFacelets = "";
        mirror.clearHousingOrientation?.();
      } else if (facelets && facelets !== mirroredFacelets) {
        mirror.setFacelets(facelets);
        mirroredFacelets = facelets;
        requestAnimationFrame(() => mirror.fit());
      }
    }
    if (feedEl) {
      feedEl.hidden = !connected;
      feedEl.textContent = feed.length ? feed.join(" ") : "Turns show up here.";
    }
  }

  /**
   * Re-home GYRO to the current physical hold (yellow on top, green in front)
   * and snap the 3D model back to the face-on resting orbit (not a 3-face
   * isometric). Does not touch facelets or Training notation remapping.
   */
  function resetGyro() {
    if (!session) return false;
    gyro.rehome();
    if (mirror?.resetRestingView) mirror.resetRestingView();
    else mirror?.clearHousingOrientation?.();
    timer?.onCubeGyroHome?.();
    return true;
  }

  async function disconnect() {
    statusSettled = true;
    const current = session;
    session = null;
    battery = null;
    facelets = "";
    mirroredFacelets = "";
    feed = [];
    gyro.reset();
    if (macForm) macForm.hidden = true;
    timer?.setCubeConnected?.(false);
    paint();
    setStatus("Disconnected. Space or tap still times a solve.");
    try {
      current?.unsubscribe?.();
      await current?.conn?.disconnect?.();
    } catch {
      /* the cube may already be gone */
    }
  }

  function rememberMove(move) {
    if (!move) return;
    feed = [...feed, move].slice(-FEED_LIMIT);
    paint();
  }

  function stopReplay() {
    if (!replaying) return;
    replaying = false;
    mirror?.cancelReplay();
  }

  function replaySolve({ scramble, moves } = {}) {
    if (!mirror || !session) return false;
    const start = faceletsForScramble(scramble);
    const list = normalizeMoves(moves);
    if (!start || !list) return false;
    replaying = true;
    if (hintEl) hintEl.textContent = "Replaying this solve";
    mirror.replay(start, list, {
      onDone() {
        replaying = false;
        mirroredFacelets = "";
        paint();
      },
    });
    return true;
  }

  function onEvent(event) {
    if (!session) return;
    if (event?.type === "MOVE") {
      stopReplay();
      const move = ganMoveToApp(event);
      const cubeT = Number(event.cubeTimestamp);
      rememberMove(move);
      mirror?.turn(move);
      timer?.onCubeMove?.(move, Number.isFinite(cubeT) ? cubeT : undefined);
      return;
    }
    if (event?.type === "GYRO") {
      stopReplay();
      gyro.observe(event.quaternion);
      return;
    }
    if (event?.type === "FACELETS") {
      stopReplay();
      const app = ganFaceletsToApp(event.facelets);
      if (!app) return;
      facelets = app;
      paint();
      timer?.onCubeFacelets?.(app);
      return;
    }
    if (event?.type === "BATTERY") {
      const level = Number(event.batteryLevel);
      if (Number.isFinite(level)) battery = Math.max(0, Math.min(100, Math.round(level)));
      paint();
      return;
    }
    if (event?.type === "HARDWARE" && event.hardwareName && session) {
      session.name = event.hardwareName;
      paint();
      return;
    }
    if (event?.type === "DISCONNECT") {
      statusSettled = true;
      session = null;
      battery = null;
      if (macForm) macForm.hidden = true;
      timer?.setCubeConnected?.(false);
      paint();
      setStatus("Cube disconnected. Space or tap still times a solve.");
    }
  }

  async function connect() {
    statusSettled = true;
    const blocked = adapterNote || bluetoothBlocker();
    if (blocked) {
      setStatus(blocked);
      return;
    }
    // requestDevice has to run in this click, before any await, or Chrome drops the gesture.
    busy = true;
    paint();
    setStatus("Choose the GAN cube in the Chrome dialog…");
    const pending = connectSmartCube({
      onStatus: (message) => setStatus(message),
      macAddressProvider: createMacAddressProvider({
        getCachedMac(device) {
          try {
            return getCachedMacForDevice(device);
          } catch {
            return null;
          }
        },
        requestMac,
      }),
    });
    try {
      const conn = await pending;
      const subscription = conn.events$?.subscribe?.({
        next: onEvent,
        error: () => {
          setStatus("The cube connection dropped. Connect again when you're ready.");
        },
      });
      gyro.reset();
      session = {
        conn,
        name: conn.deviceName || "GAN cube",
        protocol: conn.protocol?.name || "",
        unsubscribe: () => subscription?.unsubscribe?.(),
      };
      feed = [];
      facelets = "";
      battery = null;
      timer?.setCubeConnected?.(true);
      paint();
      setStatus("Connected. Apply the scramble — the timer arms when the cube matches it.");
      if (conn.capabilities?.facelets) conn.sendCommand({ type: "REQUEST_FACELETS" }).catch(() => {});
      if (conn.capabilities?.battery) conn.sendCommand({ type: "REQUEST_BATTERY" }).catch(() => {});
      if (conn.capabilities?.hardware) conn.sendCommand({ type: "REQUEST_HARDWARE" }).catch(() => {});
    } catch (error) {
      if (macForm) macForm.hidden = true;
      setStatus(connectErrorMessage(error));
    } finally {
      busy = false;
      paint();
    }
  }

  const requestMac =
    macForm && macInput && macCancel
      ? bindMacPrompt({
          form: macForm,
          input: macInput,
          cancelButton: macCancel,
          setStatus,
          initialValue: readMacDraft,
          onAccept: writeMacDraft,
        })
      : async () => {
          const typed = promptForCubeMac();
          if (typed) writeMacDraft(typed);
          return typed || null;
        };

  button.addEventListener("click", () => {
    button.blur();
    if (session) disconnect();
    else connect();
  });

  resetGyroBtn?.addEventListener("click", () => {
    resetGyroBtn.blur();
    if (!resetGyro()) return;
    setStatus("Gyro reset — yellow on top, green in front is home again.");
  });

  bluetoothAdapterMessage().then((blocked) => {
    adapterNote = blocked;
    if (!shouldApplyAdapterIdleStatus({ connected: Boolean(session), busy, settled: statusSettled })) return;
    setStatus(blocked || "Not connected. Chrome on a Mac can pair a GAN cube — no CubeStation app.");
  });
  paint();

  // Lets the timer show the live cube without a GAN cube attached.
  timer?.setReplayHandler?.(replaySolve);

  if (new URLSearchParams(location.search).get("cubePreview") === "1") {
    session = { name: "GAN i4", protocol: "GAN Gen4" };
    battery = 82;
    facelets = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
    mirroredFacelets = "";
    feed = [];
    paint();
    setStatus("Preview — the cube by the timer tracks turns the same way a connected GAN cube does.");
    const solvePreview = new URLSearchParams(location.search).get("solvePreview") === "1";
    const moves = ["R", "U", "R'", "U'", "F2", "D", "L'"];
    let index = 0;
    if (solvePreview) return { disconnect };
    const step = () => {
      if (!session || index >= moves.length) return;
      const move = moves[index++];
      feed = [...feed, move].slice(-FEED_LIMIT);
      if (feedEl) {
        feedEl.hidden = false;
        feedEl.textContent = feed.join(" ");
      }
      mirror?.turn(move);
      window.setTimeout(step, 480);
    };
    window.setTimeout(step, 700);
  }

  return { disconnect, resetGyro };
}

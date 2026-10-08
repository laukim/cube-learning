import { connectSmartCube } from "../vendor/smartcube-web-bluetooth.js";
import { bluetoothAdapterMessage, bluetoothBlocker, connectErrorMessage } from "./bluetooth-support.js?v=cube1";
import { renderCubeNet } from "./cube-reconstruction.js?v=cube1";
import { ganFaceletsToApp, ganMoveToApp } from "./move-log.js?v=cube1";

const FEED_LIMIT = 24;

/**
 * Connect panel for a GAN smart cube (Gen3/Gen4, including i4 and GAN12 ui Maglev).
 * The library filters advertised names that start with GAN, MG, or AiCube.
 */
export function initSmartCube({ timer } = {}) {
  const root = document.getElementById("cube-connect");
  const statusEl = document.getElementById("cube-connect-status");
  const metaEl = document.getElementById("cube-connect-meta");
  const netEl = document.getElementById("cube-connect-net");
  const feedEl = document.getElementById("cube-connect-feed");
  const button = document.getElementById("cube-connect-btn");
  if (!root || !statusEl || !button) return { disconnect() {} };

  let session = null;
  let battery = null;
  let facelets = "";
  let feed = [];
  let busy = false;
  let adapterNote = "";

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function paint() {
    const connected = Boolean(session);
    button.textContent = connected ? "Disconnect" : "Connect";
    button.disabled = busy;
    button.classList.toggle("btn-ghost", connected);
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
    if (netEl) {
      const net = facelets ? renderCubeNet(facelets) : "";
      netEl.hidden = !net;
      netEl.innerHTML = net;
    }
    if (feedEl) {
      feedEl.hidden = !connected;
      feedEl.textContent = feed.length ? feed.join(" ") : "Turns show up here.";
    }
  }

  async function disconnect() {
    const current = session;
    session = null;
    battery = null;
    facelets = "";
    feed = [];
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

  function onEvent(event) {
    if (!session) return;
    if (event?.type === "MOVE") {
      const move = ganMoveToApp(event);
      const cubeT = Number(event.cubeTimestamp);
      rememberMove(move);
      timer?.onCubeMove?.(move, Number.isFinite(cubeT) ? cubeT : undefined);
      return;
    }
    if (event?.type === "FACELETS") {
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
      session = null;
      battery = null;
      timer?.setCubeConnected?.(false);
      paint();
      setStatus("Cube disconnected. Space or tap still times a solve.");
    }
  }

  async function connect() {
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
    });
    try {
      const conn = await pending;
      const subscription = conn.events$?.subscribe?.({
        next: onEvent,
        error: () => {
          setStatus("The cube connection dropped. Connect again when you're ready.");
        },
      });
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
      setStatus(connectErrorMessage(error));
    } finally {
      busy = false;
      paint();
    }
  }

  button.addEventListener("click", () => {
    button.blur();
    if (session) disconnect();
    else connect();
  });

  bluetoothAdapterMessage().then((blocked) => {
    adapterNote = blocked;
    if (session || busy) return;
    setStatus(blocked || "Not connected. Chrome on a Mac can pair a GAN cube — no CubeStation app.");
  });
  paint();

  return { disconnect };
}

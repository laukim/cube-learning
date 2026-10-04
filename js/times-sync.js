import { GOOGLE_CLIENT_ID } from "./google-client.js?v=sync1";
import { loadPracticeTimes, savePracticeTimes } from "./practice-timer.js?v=sync2";
import { planSync, reconcileSolves } from "./solve-order.js?v=sync1";
import {
  decodeJwtPayload,
  forgetDeletion,
  noteDeleted,
  readGoogleToken,
  readSyncState,
  signOutAccount,
  tokenUsable,
  writeGoogleToken,
  writeSyncState,
} from "./times-account.js?v=sync1";

const API = "/api/times";

function browserStore() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export async function syncAccount({ store, token, fetchImpl = fetch } = {}) {
  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (!sub) throw coded("auth");
  const state = readSyncState(store);
  if (state.sub && state.sub !== sub) throw coded("account");
  writeSyncState(store, { ...state, sub });

  const remote = await requestTimes(fetchImpl, token);
  const plan = planSync({
    local: loadPracticeTimes(store),
    remote: remote.records,
    uploadedIds: state.uploadedIds,
    deletedIds: state.deletedIds,
  });
  let records = remote.records;
  if (plan.upsert.length || plan.deleteIds.length) {
    const posted = await requestTimes(fetchImpl, token, {
      upsert: plan.upsert,
      deleteIds: plan.deleteIds,
    });
    records = posted.records;
  }
  return saveRemote(store, sub, records);
}

export async function pushAccountChange({ store, token, event, fetchImpl = fetch } = {}) {
  const state = readSyncState(store);
  if (event?.reason === "add" && event.record?.id) writeSyncState(store, forgetDeletion(state, event.record.id));
  else if (event?.reason === "delete" && event.id) writeSyncState(store, noteDeleted(state, [event.id]));
  else if (event?.reason === "clear") writeSyncState(store, noteDeleted(state, event.deletedIds || []));

  if (!tokenUsable(token)) return { pushed: false, records: loadPracticeTimes(store) };

  let body = null;
  if (event?.reason === "clear") body = { clear: true };
  else if (event?.reason === "delete") body = { deleteIds: [event.id] };
  else if (event?.reason === "add" && event.record) body = { upsert: [event.record] };
  if (!body) return { pushed: false, records: loadPracticeTimes(store) };

  const posted = await requestTimes(fetchImpl, token, body);
  const sub = decodeJwtPayload(token)?.sub || readSyncState(store).sub;
  const records = saveRemote(store, sub, posted.records);
  return { pushed: true, records };
}

function saveRemote(store, sub, records) {
  const state = readSyncState(store);
  const remote = Array.isArray(records) ? records : [];
  const merged = reconcileSolves({
    local: loadPracticeTimes(store),
    remote,
    uploadedIds: state.uploadedIds,
    deletedIds: state.deletedIds,
  });
  savePracticeTimes(merged, store);
  writeSyncState(store, {
    sub: sub || state.sub || "",
    uploadedIds: remote.map((row) => String(row.id)),
    deletedIds: state.deletedIds.filter((id) => remote.some((row) => String(row.id) === id)),
  });
  return loadPracticeTimes(store);
}

async function requestTimes(fetchImpl, token, body) {
  const response = await fetchImpl(API, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (response.status === 401) throw coded("auth");
  if (!response.ok) throw coded("sync");
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.records)) throw coded("sync");
  return payload;
}

function coded(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function initTimesSync({ store = browserStore(), onSynced, fetchImpl = fetch } = {}) {
  const doc = globalThis.document;
  const slot = doc?.getElementById?.("timer-google-slot") || null;
  const signInBtn = doc?.getElementById?.("timer-sign-in") || null;
  const userEl = doc?.getElementById?.("timer-account-user") || null;
  const emailEl = doc?.getElementById?.("timer-account-email") || null;
  const statusEl = doc?.getElementById?.("timer-account-status") || null;
  const signOutBtn = doc?.getElementById?.("timer-sign-out") || null;
  const foot = doc?.getElementById?.("timer-foot-note") || null;
  let chain = Promise.resolve();
  let lastPull = 0;
  let gisReady = false;

  function enqueue(task) {
    const run = () => task();
    chain = chain.then(run, run);
    return chain;
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function renderGoogleButton() {
    const google = globalThis.google;
    if (!gisReady || !google?.accounts?.id || !slot || slot.hidden) return;
    google.accounts.id.renderButton(slot, {
      theme: "filled_black",
      size: "medium",
      text: "signin_with",
      shape: "rectangular",
      width: 220,
    });
  }

  function showSignedOut() {
    if (userEl) userEl.hidden = true;
    if (slot) slot.hidden = false;
    if (foot) foot.textContent = "Works offline · times stay on this device";
    setStatus("Times stay on this device");
    renderGoogleButton();
  }

  function showSignedIn(email) {
    if (slot) slot.hidden = true;
    if (userEl) userEl.hidden = false;
    if (emailEl) emailEl.textContent = email || "Signed in";
    if (foot) foot.textContent = "Signed in · times sync to this Google account";
  }

  async function runSync(token) {
    await syncAccount({ store, token, fetchImpl });
    setStatus("Synced to your account");
    onSynced?.();
  }

  function reportSyncError(error) {
    if (error?.code === "account") {
      signOutAccount(store);
      showSignedOut();
      setStatus("This device already syncs a different Google account");
      return;
    }
    if (error?.code === "auth") {
      signOutAccount(store);
      showSignedOut();
      return;
    }
    setStatus("Saved on this device — sync didn't finish");
  }

  function handleLocalChange(event) {
    const token = readGoogleToken(store);
    enqueue(async () => {
      try {
        const result = await pushAccountChange({ store, token, event, fetchImpl });
        if (!result.pushed) return;
        setStatus("Synced to your account");
        onSynced?.();
      } catch (error) {
        reportSyncError(error);
      }
    });
  }

  signInBtn?.addEventListener("click", () => {
    setStatus("Opening Google sign-in…");
    loadGoogleIdentity()
      .then(() => {
        gisReady = true;
        const google = globalThis.google;
        if (!google?.accounts?.id) throw new Error("gis");
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: onCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        renderGoogleButton();
        google.accounts.id.prompt();
      })
      .catch(() => {
        setStatus("Sign-in needs a connection to Google. Times stay on this device.");
      });
  });

  signOutBtn?.addEventListener("click", () => {
    signOutAccount(store);
    try {
      globalThis.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* ignore */
    }
    showSignedOut();
  });

  if (doc) {
    doc.addEventListener("visibilitychange", () => {
      if (doc.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPull < 15_000) return;
      const token = readGoogleToken(store);
      if (!tokenUsable(token)) return;
      lastPull = now;
      setStatus("Syncing times…");
      enqueue(() => runSync(token).catch(reportSyncError));
    });
  }

  const existing = readGoogleToken(store);
  if (tokenUsable(existing)) {
    showSignedIn(decodeJwtPayload(existing)?.email || "Signed in");
    setStatus("Syncing times…");
    enqueue(() => runSync(existing).catch(reportSyncError));
  } else {
    if (existing) signOutAccount(store);
    showSignedOut();
  }

  if (doc) {
    loadGoogleIdentity()
      .then(() => {
        gisReady = true;
        globalThis.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: onCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        renderGoogleButton();
      })
      .catch(() => {
        if (!tokenUsable(readGoogleToken(store))) setStatus("Times stay on this device");
      });
  }

  function onCredential(response) {
    const token = response?.credential || "";
    if (!tokenUsable(token)) {
      setStatus("Google didn't return a usable sign-in");
      return;
    }
    writeGoogleToken(store, token);
    showSignedIn(decodeJwtPayload(token)?.email || "Signed in");
    setStatus("Syncing times…");
    enqueue(() => runSync(token).catch(reportSyncError));
  }

  return { handleLocalChange };
}

function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.id) return Promise.resolve();
  const doc = globalThis.document;
  if (!doc?.head) return Promise.reject(new Error("gis"));
  return new Promise((resolve, reject) => {
    const script = doc.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis"));
    doc.head.appendChild(script);
  });
}

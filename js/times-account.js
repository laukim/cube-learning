import { base64UrlToBytes } from "./google-jwt.js";

export const GOOGLE_TOKEN_KEY = "cube-coach-google-id-token";
export const SYNC_STATE_KEY = "cube-coach-times-sync";

export function emptySyncState() {
  return { sub: "", uploadedIds: [], deletedIds: [] };
}

export function readSyncState(store) {
  try {
    const raw = store?.getItem?.(SYNC_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return emptySyncState();
    return {
      sub: typeof parsed.sub === "string" ? parsed.sub : "",
      uploadedIds: Array.isArray(parsed.uploadedIds) ? parsed.uploadedIds.map(String) : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds.map(String) : [],
    };
  } catch {
    return emptySyncState();
  }
}

export function writeSyncState(store, state) {
  const next = {
    sub: state?.sub || "",
    uploadedIds: Array.isArray(state?.uploadedIds) ? state.uploadedIds.map(String) : [],
    deletedIds: Array.isArray(state?.deletedIds) ? state.deletedIds.map(String) : [],
  };
  try {
    store?.setItem?.(SYNC_STATE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota */
  }
  return next;
}

export function noteDeleted(state, ids) {
  const deleted = new Set((state?.deletedIds || []).map(String));
  for (const id of ids || []) {
    if (id) deleted.add(String(id));
  }
  return {
    sub: state?.sub || "",
    uploadedIds: (state?.uploadedIds || []).map(String).filter((id) => !deleted.has(id)),
    deletedIds: [...deleted],
  };
}

export function forgetDeletion(state, id) {
  const key = String(id || "");
  return {
    sub: state?.sub || "",
    uploadedIds: (state?.uploadedIds || []).map(String),
    deletedIds: (state?.deletedIds || []).map(String).filter((item) => item !== key),
  };
}

export function readGoogleToken(store) {
  try {
    return store?.getItem?.(GOOGLE_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function writeGoogleToken(store, token) {
  try {
    if (token) store?.setItem?.(GOOGLE_TOKEN_KEY, token);
    else store?.removeItem?.(GOOGLE_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Drop the Google session only. Local solves and sync progress stay put. */
export function signOutAccount(store) {
  writeGoogleToken(store, "");
}

export function decodeJwtPayload(token) {
  const part = String(token || "").split(".")[1];
  if (!part) return null;
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(part));
    const payload = JSON.parse(json);
    return payload && typeof payload === "object" ? payload : null;
  } catch {
    return null;
  }
}

export function tokenUsable(token, now = Date.now()) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!payload?.sub || !Number.isFinite(exp)) return false;
  return exp * 1000 > now + 30_000;
}

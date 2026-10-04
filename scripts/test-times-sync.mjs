import { readFileSync } from "fs";
import { DatabaseSync } from "node:sqlite";
import { GOOGLE_CLIENT_ID } from "../js/google-client.js";
import { resetGoogleCertCache, verifyGoogleIdToken } from "../js/google-jwt.js";
import {
  addPracticeTime,
  clearPracticeTimes,
  computeStats,
  deletePracticeTime,
  loadPracticeTimes,
  memoryStore,
  PRACTICE_TIMES_KEY,
  renderTimesList,
} from "../js/practice-timer.js";
import { mergeSolves, planSync, reconcileSolves } from "../js/solve-order.js";
import {
  decodeJwtPayload,
  GOOGLE_TOKEN_KEY,
  signOutAccount,
  SYNC_STATE_KEY,
  writeGoogleToken,
} from "../js/times-account.js";
import { pushAccountChange, syncAccount } from "../js/times-sync.js";
import worker from "../worker/index.js";
import { handleTimesRequest } from "../worker/times-api.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function bytesToBase64Url(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlJson(value) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function sessionToken(sub, email = "kim@example.com") {
  return `${base64UrlJson({ alg: "RS256", kid: "k" })}.${base64UrlJson({
    sub,
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.sig`;
}

function sqliteD1() {
  const db = new DatabaseSync(":memory:");
  return {
    prepare(sql) {
      const build = (params) => ({
        async run() {
          db.prepare(sql).run(...(params || []));
          return { success: true };
        },
        async all() {
          return { results: db.prepare(sql).all(...(params || [])) };
        },
      });
      return {
        bind(...params) {
          return build(params);
        },
        run() {
          return build([]).run();
        },
        all() {
          return build([]).all();
        },
      };
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
  };
}

function apiFetch(db, verify) {
  return async (url, options = {}) => {
    const request = new Request(`https://3x3coach.mocholate.workers.dev${url}`, options);
    return handleTimesRequest(request, { DB: db }, { verify });
  };
}

const verifyPayload = async (token) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub) throw new Error("no");
  return { sub: payload.sub, email: payload.email || "" };
};

const earlyAt = 1_700_000_001_000;
const midAt = 1_700_000_002_000;
const lateAt = 1_700_000_003_000;

const orderStore = memoryStore();
addPracticeTime({ id: "late", ms: 11000, at: lateAt, scramble: "U R" }, orderStore);
addPracticeTime(
  { id: "early", ms: 15000, at: earlyAt, scramble: "R U", splits: { cross: 4000, f2l: 8000, final: 3000 } },
  orderStore
);
addPracticeTime({ id: "mid", ms: 13000, at: midAt, scramble: "F" }, orderStore);
const ordered = loadPracticeTimes(orderStore);
assert(ordered.map((row) => row.id).join() === "early,mid,late", "saves order by solve datetime, not insertion");
assert(ordered[0].at === earlyAt && ordered[2].at === lateAt, "existing timestamps are kept");
assert(ordered[0].splits.f2l === 8000, "stage splits stay on the solve");
const listHtml = renderTimesList(ordered);
assert(listHtml.indexOf('data-id="late"') < listHtml.indexOf('data-id="mid"'), "newest datetime is listed first");
assert(listHtml.indexOf('data-id="mid"') < listHtml.indexOf('data-id="early"'), "oldest datetime is listed last");
assert(listHtml.includes("2023"), "the list shows the solve datetime");
assert(!listHtml.includes('datetime=""'), "blank datetimes are omitted");

const windowStats = computeStats([
  { id: "newest", ms: 1000, at: 40 },
  { id: "oldest", ms: 9000, at: 10 },
  { id: "second", ms: 8000, at: 20 },
  { id: "third", ms: 7000, at: 30 },
]);
assert(Math.abs(windowStats.mo3 - (8000 + 7000 + 1000) / 3) < 0.001, "mo3 uses the latest timestamps, not insertion order");

const merged = mergeSolves(
  [
    { id: "early", ms: 15000, at: earlyAt, scramble: "R U" },
    { id: "late", ms: 11000, at: lateAt, scramble: "U R" },
  ],
  [{ id: "mid", ms: 13000, at: midAt, scramble: "F" }]
);
assert(merged.map((row) => row.id).join() === "early,mid,late", "two devices merge in datetime order");
const kept = mergeSolves([{ id: "early", ms: 15000, at: earlyAt }], [{ id: "early", ms: 15000, at: lateAt }]);
assert(kept[0].at === earlyAt, "an existing local timestamp wins over a different copy");

const phone = memoryStore();
addPracticeTime(
  { id: "early", ms: 15000, at: earlyAt, scramble: "R U", splits: { cross: 4000, f2l: 8000, final: 3000 } },
  phone
);
addPracticeTime({ id: "late", ms: 11000, at: lateAt, scramble: "U R" }, phone);
const db = sqliteD1();
const fetchImpl = apiFetch(db, verifyPayload);
const kim = sessionToken("kim-sub");
const offlineStore = memoryStore();
addPracticeTime({ id: "keep", ms: 10000, at: earlyAt, scramble: "R" }, offlineStore);
const beforeOffline = offlineStore.getItem(PRACTICE_TIMES_KEY);
let fetches = 0;
const offline = async () => {
  fetches += 1;
  throw new Error("offline");
};
await pushAccountChange({
  store: offlineStore,
  token: "",
  event: { reason: "add", record: { id: "keep", ms: 10000, at: earlyAt, scramble: "R" } },
  fetchImpl: offline,
});
assert(fetches === 0, "signed-out changes are not sent to the worker");
assert(offlineStore.getItem(PRACTICE_TIMES_KEY) === beforeOffline, "signed-out sync leaves the local copy alone");
assert(loadPracticeTimes(offlineStore)[0].at === earlyAt, "signed-out solves keep their datetime");

const phoneRows = await syncAccount({ store: phone, token: kim, fetchImpl });
assert(phoneRows.map((row) => row.id).join() === "early,late", "first sign-in uploads local solves instead of wiping them");
assert(phoneRows[0].at === earlyAt && phoneRows[1].at === lateAt, "uploaded solves keep the datetime they happened");
assert(phoneRows[0].splits.cross === 4000, "uploaded solves keep Cross / F2L / Final splits");

const laptop = memoryStore();
addPracticeTime({ id: "mid", ms: 13000, at: midAt, scramble: "F" }, laptop);
const laptopRows = await syncAccount({ store: laptop, token: kim, fetchImpl });
assert(laptopRows.map((row) => row.id).join() === "early,mid,late", "second device sees both devices' solves");
assert(
  laptopRows.map((row) => row.at).join() === `${earlyAt},${midAt},${lateAt}`,
  "shared list is ordered by solve datetime"
);

const phoneAgain = await syncAccount({ store: phone, token: kim, fetchImpl });
assert(phoneAgain.map((row) => row.id).join() === "early,mid,late", "first device picks up the other device's solve");
assert(phoneAgain[0].at === earlyAt, "the original solve datetime is still the one first saved");

writeGoogleToken(phone, kim);
signOutAccount(phone);
assert(phone.getItem(GOOGLE_TOKEN_KEY) == null, "sign-out drops the Google token");
assert(loadPracticeTimes(phone).map((row) => row.id).join() === "early,mid,late", "sign-out does not delete local solves");
assert(loadPracticeTimes(phone)[0].at === earlyAt, "sign-out does not change solve datetimes");
assert(phone.getItem(SYNC_STATE_KEY), "sign-out keeps sync progress so the next sign-in can continue");

addPracticeTime({ id: "after", ms: 12500, at: lateAt + 1000, scramble: "B" }, phone);
const afterSignIn = await syncAccount({ store: phone, token: kim, fetchImpl });
assert(afterSignIn.at(-1).id === "after" && afterSignIn.at(-1).at === lateAt + 1000, "a solve saved while signed out uploads later");

const otherStore = memoryStore();
const otherRows = await syncAccount({ store: otherStore, token: sessionToken("other-sub", "other@example.com"), fetchImpl });
assert(otherRows.length === 0, "another Google account cannot read these solves");
const kimOnly = await syncAccount({ store: memoryStore(), token: kim, fetchImpl });
assert(kimOnly.map((row) => row.id).join() === "early,mid,late,after", "the signed-in account still has its own solves");

let blocked = 0;
try {
  await syncAccount({
    store: phone,
    token: sessionToken("other-sub", "other@example.com"),
    fetchImpl: async () => {
      blocked += 1;
      throw new Error("should not upload");
    },
  });
  assert(false, "a different account should be refused");
} catch (error) {
  assert(error.code === "account", "linked device refuses a second Google account");
}
assert(blocked === 0, "a different account is not given this device's solves");
assert(loadPracticeTimes(phone).some((row) => row.id === "early"), "refusing another account leaves local solves in place");

deletePracticeTime("mid", phone);
await pushAccountChange({ store: phone, token: kim, event: { reason: "delete", id: "mid" }, fetchImpl });
const laptopAfterDelete = await syncAccount({ store: laptop, token: kim, fetchImpl });
assert(!laptopAfterDelete.some((row) => row.id === "mid"), "a delete on one device disappears from the other");
assert(laptopAfterDelete[0].at === earlyAt, "remaining solves keep their datetimes");

const conflict = await handleTimesRequest(
  new Request("https://3x3coach.mocholate.workers.dev/api/times", {
    method: "POST",
    headers: { authorization: `Bearer ${kim}`, "content-type": "application/json" },
    body: JSON.stringify({ upsert: [{ id: "early", ms: 15000, at: lateAt, scramble: "nope" }], user_sub: "other-sub" }),
  }),
  { DB: db },
  { verify: verifyPayload }
);
const conflictBody = await conflict.json();
assert(conflictBody.records.find((row) => row.id === "early").at === earlyAt, "D1 keeps the first stored solve datetime");
const otherView = await handleTimesRequest(
  new Request("https://3x3coach.mocholate.workers.dev/api/times", {
    headers: { authorization: `Bearer ${sessionToken("other-sub")}` },
  }),
  { DB: db },
  { verify: verifyPayload }
);
assert((await otherView.json()).records.length === 0, "a user_sub in the body does not select someone else's rows");

const anonymous = await handleTimesRequest(new Request("https://3x3coach.mocholate.workers.dev/api/times"), { DB: db });
assert(anonymous.status === 401, "missing Google token is rejected");
const garbage = await handleTimesRequest(
  new Request("https://3x3coach.mocholate.workers.dev/api/times", { headers: { authorization: "Bearer a.b.c" } }),
  { DB: db }
);
assert(garbage.status === 401, "unverified token is rejected");
const notApi = await worker.fetch(new Request("https://3x3coach.mocholate.workers.dev/timer.html"), { DB: db });
assert(notApi.status === 404, "the worker leaves non-api paths to static assets");

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"]
);
const jwk = await crypto.subtle.exportKey("jwk", publicKey);
jwk.kid = "test-key";
const nowSec = Math.floor(Date.now() / 1000);

async function signJwt(payload, kid = "test-key") {
  const header = base64UrlJson({ alg: "RS256", kid, typ: "JWT" });
  const body = base64UrlJson(payload);
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(`${header}.${body}`))
  );
  return `${header}.${body}.${bytesToBase64Url(sig)}`;
}

const validPayload = {
  iss: "https://accounts.google.com",
  aud: GOOGLE_CLIENT_ID,
  sub: "kim-sub",
  email: "kim@example.com",
  email_verified: true,
  exp: nowSec + 600,
  iat: nowSec,
};
resetGoogleCertCache();
const verified = await verifyGoogleIdToken(await signJwt(validPayload), { jwks: [jwk] });
assert(verified.sub === "kim-sub" && verified.email === "kim@example.com", "a real Google-shaped token verifies");

const rejected = async (payload, message) => {
  let failed = false;
  try {
    await verifyGoogleIdToken(await signJwt(payload), { jwks: [jwk] });
  } catch {
    failed = true;
  }
  assert(failed, message);
};
await rejected({ ...validPayload, aud: "someone-else.apps.googleusercontent.com" }, "wrong audience is rejected");
await rejected({ ...validPayload, iss: "https://example.com" }, "wrong issuer is rejected");
await rejected({ ...validPayload, exp: nowSec - 600 }, "expired token is rejected");
await rejected({ ...validPayload, email_verified: false }, "unverified email is rejected");

const signed = await signJwt(validPayload);
const sigAt = signed.lastIndexOf(".") + 8;
const chars = signed.split("");
chars[sigAt] = chars[sigAt] === "A" ? "B" : "A";
const tampered = chars.join("");
let badSig = false;
try {
  await verifyGoogleIdToken(tampered, { jwks: [jwk] });
} catch {
  badSig = true;
}
assert(badSig, "a bad signature is rejected");

const source = [
  "worker/index.js",
  "worker/times-api.js",
  "worker/solves.js",
  "js/google-jwt.js",
  "js/times-sync.js",
  "wrangler.jsonc",
].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8")).join("\n");
assert(!/client_secret|CLIENT_SECRET/i.test(source), "Google sign-in does not use a client secret");
assert(source.includes("3x3coach-times"), "times are stored in the 3x3coach D1 database");
assert(source.includes("ORDER BY solved_at ASC, id ASC"), "D1 orders by the solve datetime");

clearPracticeTimes(orderStore);
assert(loadPracticeTimes(orderStore).length === 0, "clear still empties the local timer");

console.log("times sync ok");

# Acubemy → 3x3coach import

## Storage today
- **Browser:** `localStorage` key `cube-coach-practice-times` (and sync state keys).
- **Cloud:** Cloudflare D1 `3x3coach-times` table `solves` (bound as `DB` on Worker `3x3coach`).
- **API:** `GET/POST /api/times` (Google ID token). No KV/R2 for solve history.
- **Schema:** `(user_sub, id)` PK — `ms`, `solved_at`, `scramble`, `splits_json`, `moves_json`.

## Import design (v1)
1. Export Acubemy solve details (tRPC `solves.getById`) as a JSON object/array.
2. Map each solve → upsert row with **idempotent** id `acubemy-{id}`.
3. Splits: `cross` / `f2l` / `final` (+ `oll`/`pll` when they sum to final).
4. Moves: face turns only from `rawSolutionSequence` / `solutionSequence` (`{move,t}`).
5. Upsert via existing `/api/times` under Kim’s **Google** `user_sub` (same as live sync). Acubemy Apple UID is not the D1 key.
6. **UI:** no new surface required — Timer history shows rows after the next signed-in sync. Later optional: “Import Acubemy” on Timer.

## Run
```bash
# dry-run
node scripts/import-acubemy-solves.mjs fixtures/acubemy/sample-details.json

# apply (needs Google ID token for 3x3coach account)
CUBE_COACH_GOOGLE_ID_TOKEN='…' node scripts/import-acubemy-solves.mjs path/to/details.json --apply \
  --api https://3x3coach.mocholate.workers.dev/api/times
```

Re-running is safe: same ids upsert without duplicating.

## Prepared local exports (not in git)
Kim’s real Acubemy JSON for the next apply lives outside the repo, e.g.:
`~/Sites/cube-last-layer-private/acubemy-import_payload_slim.json` (already mapped)
or raw details `acubemy-details-*.json` fed to the same script.

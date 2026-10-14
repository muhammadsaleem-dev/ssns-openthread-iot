# Reliability Test Protocol

Run this **before** the presentation. Present the *results* (the filled-in tables below) on the Reliability slide — don't re-run all of this live, it won't fit the 20-25 minute budget.

Two separate test types, per the reasoning: failover behavior is non-deterministic (worth repeating 10x), the 25-minute buffer guarantee is deterministic arithmetic (worth proving once, rigorously, not diluting across 10 runs).

---

## Part A — 10-Run Failover Reliability Test (~3-5 min per run, ~30-50 min total)

**One run = this full cycle:**

1. Confirm baseline: both fog nodes up, both API instances up, dashboard showing live data.
2. `make stop-fog-mac` — kill the Mac fog node.
3. **Observe:** do sensor nodes re-parent / redirect to the Linux fog node? Does it become leader? (Check `make logs-fog-linux` for OpenThread role change, and confirm the dashboard keeps receiving live data with no gap.)
4. `make start-fog-mac` — bring it back.
5. **Observe:** does it rejoin the mesh cleanly? (`make logs-fog-mac`)
6. Stop one backend API instance directly: `cd platform && docker compose -f docker-compose.ha.yml stop api-1`
7. **Observe:** does `api-2` continue serving all traffic with no dashboard interruption? (Check Nginx/dashboard — no visible gap in live telemetry.)
8. Bring it back: `docker compose -f docker-compose.ha.yml start api-1`
9. **Observe:** does it rejoin the load-balanced pool cleanly?

**Pass** = every observation in steps 3, 5, 7, 9 behaves as expected, with **no data loss** and **no manual intervention** beyond the stop/start commands themselves.
**Fail** = anything doesn't recover on its own (no re-parenting, dashboard gap, node doesn't rejoin, needs a manual restart of something else to fix).

### Results

| Run | Fog failover OK? | Fog rejoin OK? | API failover OK? | API rejoin OK? | Overall | Notes |
|---|---|---|---|---|---|---|
| 1 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 2 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 3 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 4 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 5 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 6 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 7 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 8 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 9 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |
| 10 | ☐ | ☐ | ☐ | ☐ | ☐ Pass / ☐ Fail | |

**Failure rate = (failed runs / 10) × 100%**

---

## Part B — Boundary Condition Tests (run once each, not counted in the 10)

### B1: Both fog nodes down for >25 minutes (edge circular-buffer overflow)

Validates the report's claim: *"the 50-packet edge RAM queue, at a fixed 30-second transmission interval, guarantees exactly 25 minutes of data preservation during a partition."*

1. Confirm baseline: both fog nodes up, sensor node transmitting normally.
2. `make stop-fog-mac && make stop-fog-linux` — both fog nodes down simultaneously. Note the exact start time.
3. Wait. At **~24 minutes**, note that the sensor node should still be buffering everything (no loss yet).
4. Let it pass **25 minutes**. From this point, the sensor's circular buffer should start overwriting its oldest unsent packets (per `storage.c`'s "overwrite oldest when full" logic) — some data from this window will now be permanently lost.
5. At a time of your choosing **past 25 minutes** (e.g., 27-30 min), bring one fog node back: `make start-fog-mac`.
6. **Observe:** does the sensor node immediately forward everything currently in its queue and empty it? Does the dashboard show a data gap corresponding to the period between the 25-minute mark and recovery (expected, per the buffer's capacity) but **no gap before the 25-minute mark** (also expected — that portion should have survived intact)?

**Result:** ☐ Behaves exactly as predicted (data intact up to ~25min, gap only after) / ☐ Unexpected behavior (describe): _______________

### B2: Both backend API instances down (fog-tier Redis caching)

Validates: fog gateway's Store-and-Forward queue caches locally when the backend is unreachable, then drains fully on recovery.

1. Confirm baseline: normal operation.
2. Stop both API instances: `cd platform && docker compose -f docker-compose.ha.yml stop api-1 api-2`
3. Let it run for a few minutes with fog nodes still up (so they keep receiving from sensor nodes and queueing in Redis).
4. **Observe:** check Redis queue depth on a fog node (e.g., via `docker exec` into the fog node's Redis and checking the queue length) — it should be growing, not erroring or dropping.
5. Bring the backend back: `docker compose -f docker-compose.ha.yml start api-1 api-2`
6. **Observe:** does the fog node drain its entire Redis backlog and forward all cached packets? Does the dashboard eventually show the full backlog with correct timestamps (no permanent loss, just delayed delivery)?

**Result:** ☐ Full backlog delivered, no loss / ☐ Some loss or manual intervention needed (describe): _______________

---

## After running this

Send me the filled-in tables and I'll:
1. Compute the final failure rate for the presentation's Reliability slide
2. Write up B1/B2 as the "boundary condition experimentally verified" talking points
3. Update the presentation deck with real numbers, replacing the PENDING DATA placeholder

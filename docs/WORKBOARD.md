# Tally — Workboard

Execution tasks derived from [`ROADMAP.md`](ROADMAP.md). One task per phase
(qualifying boundary: each is a hard dependency handoff with its own exit
gate — not split further). Work phase 0 → 7 in order; do not start a phase
until its `blockedBy` phase is `done`. Post-Cycle-II items are backlog, not
active tasks (see Stop conditions in ROADMAP.md).

Status values: `pending` | `in_progress` | `blocked` | `done`.

---

## P0 — Repository, compliance and build foundation
**Status:** pending · **blockedBy:** none · **target:** 2026-09-12

Deliverables: public repo, MIT LICENSE, Vue3+TS+Vite scaffold, `@nimiq/mini-app-sdk`
installed, TS strict, ESLint, Vitest, Postgres + migrations, CI (typecheck/test/build),
LAN-host dev server.

**Exit gate (all required):**
- [ ] CI green from a clean clone.
- [ ] App loads on desktop browser.
- [ ] App loads inside Nimiq Pay from a LAN URL.
- [ ] Provider-unavailable state renders instead of freezing.
- [ ] Repository is public.
- [ ] MIT `LICENSE` present.

---

## P1 — Wallet connection and wallet-backed authentication
**Status:** pending · **blockedBy:** P0 · **target:** 2026-09-13

Deliverables: provider adapter (idle/initializing/ready/unsupported/permission-denied/failed),
challenge issue+verify endpoints, one-time challenge consumption, session cookie
issuance/revocation, current-user + sign-out, first-run display name, auth audit events.

**Required tests:** correct signature authenticates; wrong signature rejected; correct
signature/wrong wallet rejected; expired challenge rejected; replayed challenge rejected;
permission rejection creates no session; missing provider shows fallback.

**Exit gate (all required):**
- [ ] Two independent Nimiq Pay wallets sign in repeatedly with no manual DB intervention.
- [ ] Challenges expire (5 min) and are single-use — proven by test.
- [ ] Session cookie is HttpOnly/Secure/SameSite=Lax in production.
- [ ] Origin-check enforced on state-changing endpoints.
- [ ] Auth rate limit exists per IP and per wallet address.

---

## P2 — Groups, membership and invite loop
**Status:** pending · **blockedBy:** P1 · **target:** 2026-09-13

Deliverables: create/rename/archive group, owner/member roles, invite token
(hashed, 7-day default, revocable), join flow, member list, leave-group safety
checks, activity entries.

**Exit gate (all required):**
- [ ] Wallet A creates group, shares invite; Wallet B joins on a second device.
- [ ] Both wallets see identical membership state immediately.
- [ ] Refresh/reopen on both devices preserves state.
- [ ] Raw invite token never persisted — only `SHA-256(token)`.
- [ ] A wallet cannot join the same group twice.

---

## P3 — Expense ledger and deterministic split engine
**Status:** pending · **blockedBy:** P2 · **target:** 2026-09-14

Deliverables: add/edit/soft-delete expense, payer + participant selection, equal/
exact/percentage splits, notes, activity history, per-member net balances, group
totals — calculation library pure and DB-free.

**Required tests:** 1-cent split over 2–10 people; odd totals; large totals;
reordered members; edit/delete recomputation; payer in/out of participants;
`sum(memberNetBalances) === 0` always.

**Exit gate (all required):**
- [ ] Seeded 4-person group, 30+ mixed expenses, balances match an independently
      calculated fixture exactly.
- [ ] Balance invariant (`sum === 0`) holds after every mutation in the test suite.
- [ ] Invariant failure blocks settlement generation and logs a critical error.

---

## P4 — Optimized settlement engine
**Status:** pending · **blockedBy:** P3 · **target:** 2026-09-15

Deliverables: pure `calculateSettlementPlan()`, plan endpoint/projection, plan
fingerprint tied to ledger state, stale-plan detection after mutation, "you pay"/
"you receive" views.

**Exit gate (all required):**
- [ ] Property tests over randomized valid balances: plan always resolves all
      balances to zero without changing total value.
- [ ] No generated transfer has value `<= 0` or pays a member to themselves.
- [ ] Same input always produces the same ordered plan (determinism test).
- [ ] Any expense mutation invalidates the previously generated plan.

---

## P5 — NIM settlement and on-chain verification
**Status:** pending · **blockedBy:** P4 · **target:** 2026-09-16

Deliverables: settlement intent (locks amount/payer/recipient/ledger fingerprint),
fiat→NIM quote snapshot with expiry, `@nimiq/mini-app-sdk` payment flow, server-side
RPC verification (sender/recipient/value/state/reference/hash-uniqueness), full
settlement state machine (DRAFT→...→CONFIRMED/FAILED/EXPIRED/CANCELLED).

**Exit gate (all required):**
- [ ] 5+ real Testnet settlement cycles succeed on physical Nimiq Pay devices.
- [ ] Includes one deliberately rejected payment, recovered without dead-ending.
- [ ] Includes one retry after simulated RPC/API failure — no false CONFIRMED.
- [ ] A given tx hash cannot confirm two settlements (tested).
- [ ] Client-decoded transaction data alone never marks a settlement CONFIRMED.

---

## P6 — Product polish, resilience and physical-device QA
**Status:** pending · **blockedBy:** P5 · **target:** 2026-09-17

Deliverables: 375px layout, 44px tap targets, pending/success/error state on every
async action, idempotency on expense-create + settlement-submit, rate limiting,
structured logs w/ request IDs, CSP/security headers, dependency audit.

**Physical-device matrix:** Android+Nimiq Pay, iOS+Nimiq Pay (if available),
Testnet NIM, mainnet provider init (no real transfer), slow network, offline at
load, offline after submit, permission rejection, session expiry, invite opened
pre-auth, invite already used/revoked.

**Exit gate (all required):**
- [ ] A tester who has never seen the app completes create → invite → expense →
      settle with no verbal guidance.
- [ ] No horizontal scroll at 375px on any core screen.
- [ ] No wallet prompt fires on page load.
- [ ] Every failure mode in the device matrix has a defined recovery path.

---

## P7 — Real usage, launch and submission
**Status:** pending · **blockedBy:** P6 · **target:** 2026-09-17 (submission buffer 2026-09-18)

Deliverables: analytics events (app_opened...settlement_confirmed), submission
assets (screenshots, demo video, description, architecture summary), promotion
posts, changelog/release tag.

**Exit gate (all required):**
- [ ] Submission package complete per `COMPETITION_CHECKLIST.md`.
- [ ] Production remains reachable and functional from a clean phone/session
      after final deploy.
- [ ] None of the ROADMAP "Final no-go conditions" are true at submission time.

---

## Backlog (post-Cycle-II — do not start before P7 is done)

- P8 — USDT settlement (Polygon/`window.ethereum`, ERC-20 verification).
- P9 — Recurring expenses, categories, receipts, CSV export, multi-currency ledger.
- P10 — Public templates, merchant checkout, travel/household modes, PWA outside Nimiq Pay.

---

## Stop conditions (halt all phase advancement immediately if any occur)

- Incorrect balance calculation.
- Settlement confirmed without server-side chain verification.
- One transaction hash settling two debts.
- Leaked secret / client-side service credential.
- Auth replay bug.
- User unable to recover after rejecting a wallet request.
- Core flow failing on a physical Nimiq Pay device.
- Production build or CI red.

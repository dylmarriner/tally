# Tally — Phased Execution Roadmap

**Cycle II submission deadline:** 18 September 2026  
**Internal production deadline:** 17 September 2026  
**Priority:** finished, reliable, measurable product before optional scope.

This roadmap is ordered by dependency, competition value, and failure risk. A phase is complete only when its exit gate passes. Work must not jump ahead merely because a later feature looks more entertaining.

---

## Success definition

The Cycle II build succeeds when a real user can, on a physical phone inside Nimiq Pay:

1. Open Tally.
2. Connect a Nimiq wallet and authenticate by signing a challenge.
3. Create a group.
4. Share an invite and have another wallet join.
5. Add several expenses using equal, exact or percentage splits.
6. See correct balances for every member.
7. Generate a deterministic settlement plan.
8. Pay a required settlement in NIM from inside Nimiq Pay.
9. Have the server independently verify that transaction.
10. See the debt move to a confirmed/settled state.
11. Return later and see the same consistent ledger and history.

Anything outside that loop is secondary until the loop is proven end-to-end.

---

# Phase 0 — Repository, compliance and build foundation

**Target:** 12 September 2026  
**Purpose:** remove infrastructure and competition blockers before feature work.

## Deliverables

- Public GitHub repository.
- MIT `LICENSE` committed.
- README and project documentation committed.
- Node 22+ toolchain.
- Vue 3 + TypeScript + Vite app scaffold.
- Nimiq Mini Apps AI skill installed into supported coding tools where useful.
- `@nimiq/mini-app-sdk` installed.
- TypeScript strict mode enabled.
- ESLint / formatting configured.
- Vitest configured.
- Production and local environment templates created.
- PostgreSQL database provisioned.
- Migration framework configured.
- CI runs typecheck, unit tests and production build.
- Local Vite host available on LAN for Nimiq Pay testing.

## Mandatory project commands

The implementation should expose these stable commands regardless of the underlying package choices:

```bash
npm install
npm run dev -- --host
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run test:e2e
npm run build
```

## Environment contract

At minimum:

```text
DATABASE_URL=
NIMIQ_RPC_URL=
APP_ORIGIN=
NODE_ENV=
```

Secrets must never use a `VITE_` prefix.

## Exit gate

Phase 0 passes only when:

- CI is green from a clean clone.
- App loads on desktop browser.
- App loads inside Nimiq Pay from a LAN URL.
- Provider initialization state is visible and does not freeze when the provider is unavailable.
- Repository is public before competition submission.
- MIT license exists.

---

# Phase 1 — Wallet connection and wallet-backed authentication

**Target:** 12–13 September 2026  
**Competition value:** Nimiq integration, reliability, first-run UX.

## User flow

```text
Open Tally
  ↓
Tally detects Mini App environment
  ↓
User taps “Continue with Nimiq Pay”
  ↓
listAccounts()
  ↓
server issues one-time challenge
  ↓
user explicitly approves sign(challenge)
  ↓
server verifies signature + derived address
  ↓
secure session created
  ↓
Home
```

## Deliverables

- Provider adapter with explicit states:
  - idle
  - initializing
  - ready
  - unsupported
  - permission-denied
  - failed
- Nimiq account selection.
- Challenge endpoint.
- Signature verification endpoint.
- One-time challenge consumption.
- Session cookie issuance and revocation.
- Current-user endpoint.
- Sign-out.
- First-run display-name setup.
- Wallet rejection UX that leaves the app usable and retryable.
- Authentication audit events.

## Security requirements

- Challenges expire after 5 minutes.
- Challenges are single-use.
- Nonces contain at least 128 bits of entropy.
- Canonical challenge includes domain, wallet address, nonce and expiration timestamp.
- Server verifies that the public key derives to the claimed wallet address.
- Session tokens are random opaque values; only a hash is stored server-side.
- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` in production.
- State-changing endpoints validate request `Origin` against `APP_ORIGIN`.
- Authentication rate limits exist per IP and wallet address.

## Required tests

- Correct signature authenticates.
- Wrong signature rejected.
- Correct signature with different wallet rejected.
- Expired challenge rejected.
- Replayed challenge rejected.
- Permission rejection does not create session.
- Missing provider displays fallback instead of hanging.

## Exit gate

Two independent Nimiq Pay wallets can sign into the production-like environment repeatedly without manual database intervention.

---

# Phase 2 — Groups, membership and invite loop

**Target:** 13 September 2026  
**Competition value:** usefulness, repeat use, real-user acquisition.

## Deliverables

- Create group.
- Rename group.
- Archive group.
- Group list with current balance summary.
- Group detail shell.
- Owner/member roles.
- Secure invite token generation.
- Invite join flow.
- Invite expiry/revocation.
- Member list.
- Leave-group flow with safety checks.
- Activity entries for group creation, joins and removals.

## Invite rules

- Raw invite tokens are never stored in the database.
- Store `SHA-256(token)` and compare hashes.
- Default invite lifetime: 7 days.
- Owner may revoke and regenerate.
- Invite acceptance requires an authenticated Nimiq wallet.
- A wallet cannot join the same group twice.

## Exit gate

On two phones/wallets:

1. Wallet A creates a group.
2. Wallet A shares an invite.
3. Wallet B opens Tally and joins.
4. Both immediately see the same membership state.
5. Refresh/reopen preserves state.

---

# Phase 3 — Expense ledger and deterministic split engine

**Target:** 13–14 September 2026  
**Competition value:** the 45-point core functionality category.

## Deliverables

- Add expense.
- Edit expense.
- Soft-delete expense.
- Payer selection.
- Participant selection.
- Equal split.
- Exact split.
- Percentage split.
- Optional note.
- Expense activity history.
- Per-member net balances.
- Group summary totals.
- Deterministic calculation library with no database dependency.

## Money rules

- Fiat amounts are integer minor units, e.g. `12345` = NZD 123.45.
- Never use JS floating-point arithmetic to persist or reconcile monetary values.
- Percentage splits use integer basis points.
- Rounding remainder is distributed deterministically by member ID order unless product UX defines another explicit rule.
- Sum of expense shares must equal expense amount exactly.
- Negative expenses are not allowed in Cycle II.
- Refunds are represented as a dedicated adjustment type only if implemented and fully tested; otherwise deferred.

## Equal split algorithm

For `amountMinor` and `n` participants:

```text
base = floor(amountMinor / n)
remainder = amountMinor % n
```

Every participant receives `base`; the first `remainder` participants in deterministic order receive one additional minor unit.

## Exact split validation

```text
sum(shares.amountMinor) === expense.amountMinor
```

## Percentage validation

```text
sum(percentBps) === 10_000
```

Convert percentages into minor units and deterministically distribute rounding remainder.

## Required invariant

For every group:

```text
sum(memberNetBalances) === 0
```

If this invariant fails, settlement generation is blocked and the event is logged as a critical calculation error.

## Required tests

Property/invariant tests covering:

- 1 cent split between 2–10 people.
- Odd totals.
- Large totals.
- Reordered members.
- Multiple currencies rejected within a group if Cycle II supports one group currency only.
- Edit/delete recomputation.
- Payer included and excluded from participants.
- Sum of all balances always zero.

## Exit gate

A seeded 4-person group containing at least 30 mixed expenses produces balances matching a separately calculated fixture exactly.

---

# Phase 4 — Optimized settlement engine

**Target:** 14–15 September 2026  
**Competition value:** originality and product usefulness.

## Goal

Convert group net balances into a small deterministic set of transfers without changing who is owed what.

## Algorithm

1. Partition members into creditors (`balance > 0`) and debtors (`balance < 0`).
2. Sort each deterministically by absolute balance descending, then stable member ID.
3. Match the largest debtor to the largest creditor.
4. Transfer `min(abs(debt), credit)`.
5. Reduce both balances.
6. Continue until all balances are zero.

This greedy algorithm is deterministic and generally produces a compact settlement plan suitable for the competition build. It is **not represented as a proof of mathematically minimum edge count for every possible graph**. The product copy must therefore say “optimized” or “reduced settlement plan”, not make an unproven global-optimum claim.

## Deliverables

- Pure `calculateSettlementPlan()` domain function.
- Settlement plan endpoint or server projection.
- Plan version/fingerprint derived from current ledger state.
- Stale-plan detection after any expense mutation.
- “You pay” and “You receive” views.
- Completed settlements deducted from outstanding obligations.

## Required invariants

- Total transfers out = total debt.
- Total transfers in = total credit.
- Applying every transfer produces zero balances.
- No transfer has value `<= 0`.
- No member pays themselves.
- Same input always produces same ordered plan.

## Exit gate

Automated property tests generate random valid group balances and prove the settlement plan resolves them to zero without changing total value.

---

# Phase 5 — NIM settlement and on-chain verification

**Target:** 15–16 September 2026  
**Competition value:** largest share of the 25-point Nimiq integration category.

## Payment principle

Tally does not mark a debt settled because the browser says “transaction sent”. It creates a pending settlement and independently verifies the chain result.

## Settlement flow

```text
User taps Settle
  ↓
server creates immutable settlement intent
  ↓
server locks amount, payer, recipient and ledger fingerprint
  ↓
server obtains current fiat→NIM quote
  ↓
client displays fiat debt + NIM amount + quote timestamp
  ↓
user taps Pay with NIM
  ↓
Nimiq Pay native approval
  ↓
sendBasicTransactionWithData()
  ↓
client submits tx hash to server
  ↓
server queries Nimiq RPC
  ↓
verify sender + recipient + amount + transaction state/reference
  ↓
settlement CONFIRMED
  ↓
ledger projection updates
```

## Nimiq integration

Use `@nimiq/mini-app-sdk` `init()` and the Nimiq provider.

Prefer `sendBasicTransactionWithData()` for settlements so the transaction can include a compact Tally reference when the byte/text constraints allow it, for example:

```text
TALLY:<short-settlement-reference>
```

If transaction-data constraints or current SDK behaviour make this unreliable, use `sendBasicTransaction()` and verify the immutable tuple of transaction hash, sender, recipient and exact Luna amount instead. The app must not weaken verification merely to retain a decorative memo.

## NIM amount handling

- 1 NIM = 100,000 Luna.
- Persist settlement amount in Luna as an integer.
- Convert fiat debt to NIM from an explicit rate snapshot.
- Persist quote source, fiat currency, rate, timestamp and expiration.
- User sees rate and expiry before approving payment.
- Expired quote requires regeneration before wallet prompt.
- No silent rate refresh after the user confirms the displayed amount.

Use Nimiq utilities/exchange-rate facilities where production-suitable; isolate the quote provider behind an interface so it can be replaced without changing settlement logic.

## Settlement states

```text
DRAFT
QUOTED
AWAITING_WALLET
SUBMITTED
CONFIRMING
CONFIRMED
FAILED
EXPIRED
CANCELLED
```

State transitions are server-controlled. `CONFIRMED` is terminal for Cycle II except an administrative repair path that must be audited.

## Server verification checks

Given a submitted hash, confirm:

- transaction exists or remains explicitly pending during retry window;
- transaction sender equals settlement payer wallet;
- transaction recipient equals intended recipient wallet;
- transaction value equals exact expected Luna amount;
- transaction is included/confirmed according to the selected confirmation policy;
- hash has not already been consumed by another settlement;
- settlement has not already been confirmed;
- optional data reference matches where used.

## Required failure handling

- User rejects native wallet dialog.
- Provider unavailable.
- Network loses connectivity after approval.
- Client never receives hash despite transaction succeeding.
- RPC temporarily unavailable.
- Hash exists but fields do not match intent.
- Duplicate hash submission.
- Stale quote.
- Settlement plan changes before payment starts.

## Exit gate

At least five real Testnet settlement cycles succeed on physical Nimiq Pay devices, including one deliberately rejected payment and one retry after simulated API/RPC failure.

---

# Phase 6 — Product polish, resilience and physical-device QA

**Target:** 16–17 September 2026  
**Competition value:** functionality/reliability 45 + design/UX 10.

## UX acceptance rules

- Works at 375 px viewport width without horizontal scrolling.
- Primary tap targets at least 44 px high/wide.
- No wallet prompt on page load.
- Every asynchronous action has visible pending/success/error state.
- Empty states explain the next useful action.
- Retry is available for recoverable failures.
- Destructive actions require deliberate confirmation.
- Back navigation never loses a submitted payment state.
- Long wallet addresses are truncated visually but copyable in full where relevant.
- Currency formatting respects locale.
- Language reads `window.nimiqPay?.language` with browser/English fallback.

## Reliability work

- Request idempotency for expense creation and settlement submission.
- API timeout handling.
- Database indexes reviewed.
- Rate limiting.
- Structured server logs with request IDs.
- Client error boundary/global error handler.
- Sentry-like crash reporting only if privacy disclosure and implementation can be completed safely; otherwise omit rather than rush surveillance into the app.
- Dependency audit.
- Production CSP and security headers.

## Physical-device test matrix

At minimum:

- Android + current Nimiq Pay.
- iOS + current Nimiq Pay if access is available before submission.
- Testnet NIM.
- Mainnet provider initialization without performing unnecessary real transfers.
- Slow network.
- Offline during page load.
- Offline after transaction submission.
- Wallet permission rejection.
- Session expiry.
- Invite opened before authentication.
- Invite already used/revoked.

## Exit gate

A new tester who has not seen the app before completes create → invite → expense → settle without verbal guidance.

---

# Phase 7 — Real usage, launch and submission

**Target:** 17 September 2026; submission buffer 18 September 2026.

## Real-user target

Minimum useful target before judging:

- 20 distinct authenticated wallets.
- 8+ multi-member groups.
- 50+ real expenses.
- 10+ submitted NIM settlement attempts.
- Multiple returning users on a second session/day.
- At least 5 pieces of actionable tester feedback with resulting fixes documented.

These numbers are internal targets, not competition requirements. Quality and genuine use matter more than manufacturing meaningless traffic.

## Analytics events

Track product events, not private financial surveillance:

- app_opened
- auth_started
- auth_completed
- group_created
- invite_created
- invite_joined
- expense_created
- settlement_plan_viewed
- settlement_started
- settlement_submitted
- settlement_confirmed
- settlement_failed
- returning_session

Do not send raw wallet signatures, auth tokens, invite tokens, private notes or unnecessary transaction metadata to analytics.

## Submission assets

- Public repository.
- MIT License.
- Production app URL.
- Nimiq Pay deep link.
- 3–5 clean mobile screenshots.
- 45–90 second demo video.
- Max-250-word competition description.
- Architecture / security summary.
- Builder/team details and payout wallet as required by portal.
- Known-limitations section that does not undermine the core use case.
- Changelog / release tag.

## Promotion

- Build update with product problem and first flow.
- Nimiq integration demonstration.
- Public tester invitation.
- Feedback/fix update.
- Launch post with demo.
- Participation in remaining community call(s) where practical.

## Exit gate

Submission is complete and production remains available from a clean phone/session after deployment.

---

# Post-Cycle II roadmap

These items must not displace Cycle II core work.

## Phase 8 — USDT settlement

- Polygon account connection through `window.ethereum`.
- USDT 6-decimal-safe amount handling.
- EIP-1193 chain detection/switching.
- ERC-20 transfer creation.
- On-chain verification.
- Currency choice per settlement.

## Phase 9 — Better shared-finance features

- Recurring expenses.
- Expense categories.
- Receipt images.
- CSV export.
- Group templates.
- Multi-currency ledger with explicit FX lots.
- Settlement reminders.

## Phase 10 — Growth

- Public group templates.
- Merchant/group checkout integration.
- Travel mode.
- Household mode.
- PWA outside Nimiq Pay with clear provider limitations.

---

# Stop conditions

The following conditions immediately stop feature expansion and return effort to stabilization:

- Any incorrect balance calculation.
- Any settlement confirmed without server-side chain verification.
- Any possibility of a transaction hash settling two debts.
- Any leaked secret/client-side service credential.
- Any auth replay bug.
- Any user unable to recover after rejecting a wallet request.
- Any core flow failing on a physical Nimiq Pay device.
- Production build or CI failing.

The competition rewards a finished product. Tally therefore optimizes for boring correctness at the payment boundary and speed everywhere else.

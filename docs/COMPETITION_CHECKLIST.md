# Tally — Cycle II Competition Checklist

This checklist converts the official scoring rubric and rules into release evidence for Tally.

A checked box means evidence exists in the production app, tests, repository, analytics, screenshots, or submission package. It does not mean “we intended to do it.”

---

# Eligibility and submission blockers

- [ ] Repository visibility is **public**.
- [x] Project documentation exists.
- [ ] MIT `LICENSE` exists in repository root.
- [ ] Final code is original or properly attributed.
- [ ] No private keys, API secrets or sensitive credentials are committed.
- [ ] Production Mini App URL is live.
- [ ] App works inside Nimiq Pay.
- [ ] At least one qualifying NIM or USDT wallet interaction is core to the experience.
- [ ] Team/builder details ready for submission.
- [ ] Nimiq payout wallet ready.
- [ ] Submission description is <= 250 words.
- [ ] Final submission entered before 18 September 2026 deadline.

---

# 45 points — Functionality, reliability and usefulness

## Core feature

- [ ] Create group works.
- [ ] Invite another wallet works.
- [ ] Join group works.
- [ ] Add equal-split expense works.
- [ ] Add exact-split expense works.
- [ ] Add percentage-split expense works.
- [ ] Edit/delete expense recomputes balances correctly.
- [ ] Balance invariant tests pass.
- [ ] Optimized settlement plan works.
- [ ] NIM payment can be submitted.
- [ ] Server verifies NIM settlement on-chain.
- [ ] Confirmed payment updates outstanding balances.

## Error handling

- [ ] Missing Nimiq provider handled.
- [ ] Wallet account permission rejection handled.
- [ ] Signature rejection handled.
- [ ] Transaction rejection handled.
- [ ] Session expiry handled.
- [ ] Expired/revoked invite handled.
- [ ] Invalid split totals blocked with useful explanation.
- [ ] Stale expense edit handled.
- [ ] Stale settlement plan handled.
- [ ] Expired exchange-rate quote handled.
- [ ] RPC outage enters retryable confirmation state.
- [ ] API/server errors include a useful retry path/request ID.

## Speed

- [ ] Initial app shell feels immediate on physical phone.
- [ ] No oversized initial-route assets.
- [ ] Group/expense reads meet practical latency target.
- [ ] Mutations use optimistic/revalidation UX where safe.
- [ ] Settlement confirmation polling backs off.

## Stability

- [ ] Clean create → invite → expense → settle flow passes 10 consecutive times.
- [ ] Refresh during normal navigation preserves state.
- [ ] Refresh after transaction submission recovers settlement state from server.
- [ ] Double taps do not create duplicate expenses/settlements.
- [ ] Production logs show no recurring unhandled exception.

## Completeness

- [ ] Loading states exist.
- [ ] Empty states exist.
- [ ] Error states exist.
- [ ] Destructive confirmation states exist.
- [ ] Activity history exists.
- [ ] Privacy/data disclosure exists.
- [ ] App has no visible placeholder/TODO/demo-only content.

## Real need / target audience / originality / repeat value

- [ ] Landing copy explains the use case in one screen.
- [ ] New tester can identify target audience without explanation.
- [ ] Optimized settlement plan is clearly demonstrated.
- [ ] Wallet-backed identity is clearly demonstrated.
- [ ] On-chain settlement verification is clearly demonstrated.
- [ ] At least one household/trip/dinner-style repeat-use example is shown in demo/story.

---

# 25 points — Nimiq Pay and Nimiq integration

- [ ] Uses `@nimiq/mini-app-sdk` provider initialization.
- [ ] `listAccounts()` used only after explicit user action.
- [ ] `sign()` used for wallet-backed authentication.
- [ ] Server verifies signature ownership.
- [ ] NIM payment occurs inside Nimiq Pay.
- [ ] Settlement amount uses exact Luna integer representation.
- [ ] Transaction hash is persisted uniquely.
- [ ] Server independently queries Nimiq chain/RPC.
- [ ] Sender verified.
- [ ] Recipient verified.
- [ ] Value verified.
- [ ] Included/confirmed state verified.
- [ ] Transaction reference verified where enabled.
- [ ] Wallet rejection remains recoverable.
- [ ] Nimiq interaction is necessary to the product experience, not decorative.

Evidence to capture:

- [ ] Screenshot/video of wallet-backed sign-in.
- [ ] Screenshot/video of native payment approval.
- [ ] Screenshot/video of submitted → confirming → confirmed settlement.
- [ ] Architecture diagram explaining server verification.

---

# 15 points — Real usage

Internal targets:

- [ ] 20+ distinct authenticated wallets.
- [ ] 8+ groups with more than one member.
- [ ] 50+ genuine expenses.
- [ ] 10+ NIM settlement attempts.
- [ ] Multiple returning users.
- [ ] At least 5 actionable tester feedback items.
- [ ] Feedback changes documented in changelog/build post.

Evidence:

- [ ] Usage counts captured without exposing private group details.
- [ ] Tester quotes/feedback used only with permission.
- [ ] Screenshots of anonymous aggregate metrics prepared.

---

# 10 points — Design and UX

- [ ] 375 px width passes without horizontal scrolling.
- [ ] All primary tap targets >= 44 px.
- [ ] Works with Android Nimiq Pay.
- [ ] iOS Nimiq Pay tested if device access exists.
- [ ] Wallet prompts only follow explicit buttons.
- [ ] Payment sheet shows recipient, fiat debt, NIM amount and rate state before wallet prompt.
- [ ] Long addresses truncate safely and can be inspected/copied.
- [ ] Currency formatting is consistent.
- [ ] Nimiq Pay language is respected with fallback.
- [ ] Back navigation is safe during payment lifecycle.
- [ ] Success state is unmistakable.
- [ ] Failure state explains what happened and what to do next.
- [ ] Visual hierarchy makes “what do I do now?” obvious on every core screen.

---

# 5 points — Builder promotion / story

- [ ] Intro/build announcement published.
- [ ] First working flow shared publicly/community.
- [ ] Nimiq integration demo shared.
- [ ] Early-access testers invited.
- [ ] Feedback/fix update shared.
- [ ] Launch/submission post published.
- [ ] Remaining community event/call attended where practical.
- [ ] Demo video recorded.

---

# Security release audit

- [ ] `git grep`/secret scanner clean.
- [ ] `.env` excluded from git.
- [ ] No `VITE_` environment variable contains a secret.
- [ ] Auth challenges expire and are single-use.
- [ ] Session tokens stored hashed server-side.
- [ ] Mutation endpoints check Origin.
- [ ] Group authorization is always server-side.
- [ ] Invite tokens stored hashed.
- [ ] All API inputs schema validated.
- [ ] Transaction verification ignores client-decoded claims.
- [ ] One transaction hash cannot settle multiple intents.
- [ ] User-provided text is escaped/sanitized.
- [ ] Production is HTTPS.

---

# Physical Nimiq Pay acceptance log

Record each release candidate:

| Build | Device | Nimiq Pay version | Network | Sign-in | Invite | Expense | Pay | Reject/retry | Verify | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | Testnet | | | | | | | |

Do not mark a release provider-ready based only on desktop mocks.

---

# Submission package

- [ ] App name: Tally.
- [ ] One-line pitch finalized.
- [ ] <=250-word description finalized.
- [ ] Public GitHub URL.
- [ ] Production URL.
- [ ] Nimiq Pay direct/deep link tested.
- [ ] 3–5 screenshots.
- [ ] 45–90 second demo video.
- [ ] Real-usage evidence.
- [ ] Nimiq integration explanation.
- [ ] Known limitations stated accurately.
- [ ] Release tag created.
- [ ] Production re-tested from clean session after final deploy.

---

# Final no-go conditions

Do not submit a release candidate as final while any of these is true:

- incorrect balances;
- unverified payment marked settled;
- duplicate settlement possible;
- wallet auth replay possible;
- core flow requires manual DB repair;
- production URL fails in Nimiq Pay;
- repository remains private;
- MIT license missing;
- committed secret exists;
- build/test pipeline red.

# AGENTS.md — Tally Implementation Rules

This file defines non-negotiable implementation rules for coding agents and contributors working on Tally.

Read `README.md`, `docs/ROADMAP.md`, and `docs/TECHNICAL_BLUEPRINT.md` before changing application code.

---

## 1. Current objective

Ship the smallest complete, polished Cycle II product before adding optional scope.

Core flow:

```text
wallet auth → create group → invite → expense → balances → optimized settlement → NIM payment → server verification
```

If a proposed change does not improve that flow, its reliability, its UX, its testability, or competition evidence, defer it until after the core release gate.

---

## 2. No fake completion

Do not add:

- mock implementations presented as finished behaviour;
- TODO/FIXME placeholders in production paths;
- stub API responses;
- hardcoded demo balances;
- fake transaction confirmation;
- hidden fallback that marks settlements paid without chain verification;
- sample credentials or private keys.

If a dependency is unavailable, fail explicitly and leave the product in a recoverable state.

---

## 3. Money rules

- Persist fiat amounts as integer minor units.
- Persist NIM as integer Luna.
- Never use binary floating-point values as the source of truth for money.
- Expose bigint-like values over JSON as decimal strings.
- Every expense's shares must sum exactly to its expense amount.
- Every group's net balances must sum exactly to zero.
- Block settlement generation if accounting invariants fail.

---

## 4. Wallet rules

- Use `@nimiq/mini-app-sdk` for Nimiq Pay Mini App provider access.
- Never request account access or signatures automatically on page load.
- Every wallet prompt follows a clear explicit user action.
- Explain what the user will sign/pay before invoking the provider.
- Treat permission rejection as a normal recoverable outcome.
- Never request or handle private keys.

---

## 5. Authentication rules

- Wallet authentication uses one-time server challenges.
- Challenges expire.
- Challenges cannot be replayed.
- Verify signature server-side.
- Verify public key derives to claimed Nimiq address.
- Sessions use high-entropy opaque tokens.
- Store only hashed session tokens server-side.
- Do not use localStorage as the authoritative authentication secret when a secure HttpOnly same-origin cookie is available.

---

## 6. Settlement rules

A client-provided transaction hash is not proof of payment.

Before `CONFIRMED`, server must independently verify at least:

```text
hash exists
sender == intended payer wallet
recipient == intended recipient wallet
value == expected Luna amount
transaction state satisfies confirmation policy
hash has not been consumed by another settlement
optional reference matches where used
```

Never let a browser-supplied decoded transaction object bypass RPC verification.

RPC outage must result in retryable `CONFIRMING` state, not false success or premature failure.

---

## 7. Concurrency and idempotency

- State-changing financial/ledger actions must tolerate retries.
- Create-expense and settlement endpoints use idempotency keys.
- Expense edits use optimistic revision checks.
- Transaction hash is globally unique across settlement intents.
- Double taps must not create duplicate obligations or settlements.

---

## 8. Scope discipline

Before the Cycle II release gate, do not add:

```text
USDT
AI/OCR
chat
social feed
staking
NFTs
custom token
smart contracts
bank integrations
multi-currency ledger
native mobile app
```

USDT is the first post-core extension only after the NIM path is stable.

---

## 9. Code organization

- Keep domain calculations pure and testable.
- Do not bury money/split/settlement logic in Vue components.
- Do not trust route-handler input without schema validation.
- Share request/response schemas where practical.
- Prefer small focused modules over giant service files.
- Do not duplicate source-of-truth calculations client and server unless the client copy is presentation-only and validated against server results.

---

## 10. Tests required with changes

Changes to any of these require tests in the same change:

- money parsing/formatting;
- split algorithms;
- balance engine;
- settlement optimization;
- authentication verification;
- authorization;
- idempotency;
- settlement state transitions;
- blockchain verification.

Bug fixes require a regression test that fails before the fix and passes after it whenever technically practical.

---

## 11. Definition of done

A feature is done only when:

- implementation is complete;
- loading/success/error/rejection states exist;
- validation exists;
- authorization exists where needed;
- tests pass;
- TypeScript passes;
- build passes;
- mobile layout is correct;
- provider-sensitive flow has been tested in Nimiq Pay when applicable;
- documentation is updated if contract/architecture changed.

“Works on my desktop browser” is not sufficient for provider features.

---

## 12. Security

Never commit:

- `.env` files;
- database credentials;
- RPC credentials where secret;
- service-role keys;
- auth/session secrets;
- private keys;
- raw production cookies/tokens.

Log request IDs and structured failure metadata, not secrets.

User-generated descriptions/names are text, never trusted HTML.

---

## 13. UX minimums

- 375 px layout without horizontal overflow.
- Primary tap targets >= 44 px.
- Explicit loading state for wallet/network actions.
- Recoverable error state wherever retry is possible.
- Payment screen shows recipient + wallet address + ledger amount + NIM amount before wallet prompt.
- Navigation/reload after transaction submission must recover status from server.

---

## 14. Development workflow

Before claiming completion, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run test:integration
npm run build
```

Run E2E and physical Nimiq Pay checks as appropriate to the change.

Do not suppress failing tests to get a green pipeline.

---

## 15. Architectural changes

If a change conflicts with `docs/TECHNICAL_BLUEPRINT.md`:

1. identify the concrete constraint;
2. choose the smallest safe deviation;
3. update the blueprint in the same change;
4. preserve the domain/security invariants.

Architecture is allowed to evolve. Financial correctness and verification are not optional.

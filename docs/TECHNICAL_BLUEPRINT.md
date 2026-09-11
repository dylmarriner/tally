# Tally — Technical Blueprint

This document defines the Cycle II production architecture for Tally. It is intentionally opinionated. Deviations should be made only when an implementation constraint is demonstrated, not because a library looked shiny at 1:30 AM.

---

# 1. Product boundary

Tally is a shared-expense ledger with wallet-backed identity and NIM settlement.

The core domain consists of four things:

1. **People** — represented by authenticated Nimiq wallets.
2. **Groups** — collections of people sharing expenses.
3. **Expenses** — immutable-accounting inputs that create obligations.
4. **Settlements** — payments that reduce those obligations after independent chain verification.

The blockchain is a settlement and identity rail. It is not the ledger database.

---

# 2. Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Nimiq Pay mobile app                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Tally WebView                      │  │
│  │                                                       │  │
│  │  Vue 3 + TypeScript + Vite                           │  │
│  │                                                       │  │
│  │  UI / Router / Query Cache / Pinia                   │  │
│  │             │                  │                      │  │
│  │             │                  └──── Nimiq provider   │  │
│  │             │                         via SDK         │  │
│  └─────────────┼──────────────────────────┼──────────────┘  │
└────────────────┼──────────────────────────┼─────────────────┘
                 │ HTTPS                    │ native bridge
                 ▼                          ▼
      ┌──────────────────────┐      ┌───────────────────────┐
      │   Tally API / Node   │      │    Nimiq Pay host     │
      │                      │      │ wallet approvals/keys │
      │ auth                 │      └───────────┬───────────┘
      │ groups               │                  │
      │ expenses             │                  ▼
      │ settlement intents   │             Nimiq network
      │ chain verification   │                  ▲
      └──────────┬───────────┘                  │
                 │                              │ RPC verify
                 ▼                              │
      ┌──────────────────────┐                  │
      │     PostgreSQL       │                  │
      │ ledger + sessions    │                  │
      └──────────────────────┘                  │
                 ▲                              │
                 └──────────────────────────────┘
```

## Deployment principle

Prefer same-origin frontend and API:

```text
https://tally.example/          web app
https://tally.example/api/...  API
```

This avoids unnecessary CORS complexity and allows secure HttpOnly session cookies in the WebView.

---

# 3. Stack

## Frontend

- Vue 3
- TypeScript strict mode
- Vite
- Vue Router
- Pinia for session/UI state
- TanStack Vue Query or equivalent query cache for server state
- Zod for API payload validation
- CSS tokens + utility classes or Tailwind, provided final bundle and styling remain controlled
- `@nimiq/mini-app-sdk`

## Backend

- Node.js 22+
- TypeScript
- Small HTTP framework suitable for serverless deployment (Hono/Fastify-equivalent)
- Zod shared request/response schemas
- PostgreSQL
- Drizzle ORM and SQL migrations
- `@nimiq/core` for server-side Nimiq address/signature operations where required
- Nimiq JSON-RPC for settlement verification

## Tests

- Vitest for domain/unit tests
- API integration tests against isolated test database
- Playwright for web flows where provider calls can be simulated
- Physical-device Nimiq Pay tests for every provider-sensitive release

---

# 4. Repository shape

Target structure:

```text
/
├── api/
│   └── index.ts                 # serverless/API entry
├── server/
│   ├── app.ts                   # routes + middleware
│   ├── auth/
│   │   ├── challenge.ts
│   │   ├── verify.ts
│   │   └── session.ts
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── repositories/
│   ├── domain/
│   │   ├── money.ts
│   │   ├── splits.ts
│   │   ├── balances.ts
│   │   └── settlements.ts
│   ├── nimiq/
│   │   ├── verify-signature.ts
│   │   ├── rpc.ts
│   │   └── verify-transaction.ts
│   └── routes/
│       ├── auth.ts
│       ├── groups.ts
│       ├── expenses.ts
│       └── settlements.ts
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── groups/
│   │   ├── expenses/
│   │   └── settlements/
│   ├── lib/
│   │   ├── api/
│   │   ├── money/
│   │   └── nimiq/
│   ├── router/
│   ├── stores/
│   └── styles/
├── shared/
│   ├── contracts/
│   ├── constants/
│   └── types/
├── drizzle/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/
├── AGENTS.md
├── .env.example
├── package.json
└── vite.config.ts
```

No business logic should live only in Vue components or route handlers. Calculation logic belongs in pure domain functions so it can be exhaustively tested.

---

# 5. Domain model

## 5.1 User

A Tally user is a wallet-backed profile.

```ts
interface User {
  id: string
  nimiqAddress: string
  publicKeyHex: string
  displayName: string
  createdAt: string
  updatedAt: string
}
```

Rules:

- `nimiqAddress` unique.
- Public key must derive to address.
- Display name is presentation only; identity remains wallet address.

## 5.2 Group

```ts
interface Group {
  id: string
  name: string
  currency: string // ISO 4217 for ledger, e.g. NZD
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}
```

Cycle II supports one ledger currency per group. Multi-currency accounting is deferred.

## 5.3 GroupMember

```ts
interface GroupMember {
  id: string
  groupId: string
  userId: string
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
  leftAt: string | null
}
```

Unique active membership per `(groupId, userId)`.

## 5.4 Expense

```ts
interface Expense {
  id: string
  groupId: string
  description: string
  amountMinor: bigint
  currency: string
  paidByMemberId: string
  splitMethod: 'EQUAL' | 'EXACT' | 'PERCENTAGE'
  createdByUserId: string
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
```

## 5.5 ExpenseShare

```ts
interface ExpenseShare {
  id: string
  expenseId: string
  memberId: string
  amountMinor: bigint
  percentBps: number | null
}
```

Invariant:

```text
sum(active shares for expense) == expense.amountMinor
```

## 5.6 SettlementIntent

```ts
type SettlementStatus =
  | 'DRAFT'
  | 'QUOTED'
  | 'AWAITING_WALLET'
  | 'SUBMITTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

interface SettlementIntent {
  id: string
  groupId: string
  payerMemberId: string
  recipientMemberId: string
  ledgerAmountMinor: bigint
  ledgerCurrency: string
  nimAmountLuna: bigint
  quoteId: string
  ledgerFingerprint: string
  txHash: string | null
  status: SettlementStatus
  createdAt: string
  expiresAt: string
  confirmedAt: string | null
}
```

A settlement intent becomes immutable once it reaches `AWAITING_WALLET` except for its state, transaction hash, failure metadata and confirmation metadata.

## 5.7 ExchangeRateQuote

```ts
interface ExchangeRateQuote {
  id: string
  baseAsset: 'NIM'
  quoteCurrency: string
  quotePerNim: string // decimal string, never JS float persistence
  source: string
  observedAt: string
  expiresAt: string
}
```

The final Luna amount is computed once and stored in the settlement intent.

---

# 6. PostgreSQL schema

Suggested tables and important columns:

```text
users
  id uuid pk
  nimiq_address text unique not null
  public_key_hex text not null
  display_name text not null
  created_at timestamptz not null
  updated_at timestamptz not null

auth_challenges
  id uuid pk
  wallet_address text not null
  nonce_hash text unique not null
  message text not null
  expires_at timestamptz not null
  used_at timestamptz null
  created_at timestamptz not null

sessions
  id uuid pk
  user_id uuid fk users
  token_hash text unique not null
  expires_at timestamptz not null
  revoked_at timestamptz null
  created_at timestamptz not null

groups
  id uuid pk
  name text not null
  currency char(3) not null
  created_by_user_id uuid fk users
  archived_at timestamptz null
  created_at timestamptz not null
  updated_at timestamptz not null

group_members
  id uuid pk
  group_id uuid fk groups
  user_id uuid fk users
  role text not null
  joined_at timestamptz not null
  left_at timestamptz null

invites
  id uuid pk
  group_id uuid fk groups
  token_hash text unique not null
  created_by_user_id uuid fk users
  expires_at timestamptz not null
  revoked_at timestamptz null
  max_uses int not null
  use_count int not null
  created_at timestamptz not null

expenses
  id uuid pk
  group_id uuid fk groups
  description text not null
  amount_minor bigint not null
  currency char(3) not null
  paid_by_member_id uuid fk group_members
  split_method text not null
  created_by_user_id uuid fk users
  revision int not null
  deleted_at timestamptz null
  created_at timestamptz not null
  updated_at timestamptz not null

expense_shares
  id uuid pk
  expense_id uuid fk expenses
  member_id uuid fk group_members
  amount_minor bigint not null
  percent_bps int null

settlement_intents
  id uuid pk
  group_id uuid fk groups
  payer_member_id uuid fk group_members
  recipient_member_id uuid fk group_members
  ledger_amount_minor bigint not null
  ledger_currency char(3) not null
  nim_amount_luna bigint not null
  quote_id uuid fk exchange_rate_quotes
  ledger_fingerprint text not null
  tx_hash text unique null
  status text not null
  failure_code text null
  expires_at timestamptz not null
  confirmed_at timestamptz null
  created_at timestamptz not null
  updated_at timestamptz not null

exchange_rate_quotes
  id uuid pk
  base_asset text not null
  quote_currency char(3) not null
  quote_per_nim numeric not null
  source text not null
  observed_at timestamptz not null
  expires_at timestamptz not null

activity_events
  id uuid pk
  group_id uuid fk groups
  actor_user_id uuid fk users null
  event_type text not null
  entity_type text not null
  entity_id uuid null
  metadata jsonb not null default '{}'
  created_at timestamptz not null

idempotency_keys
  id uuid pk
  user_id uuid fk users
  route text not null
  key text not null
  request_hash text not null
  response_status int null
  response_body jsonb null
  expires_at timestamptz not null
```

Important indexes:

- `users(nimiq_address)` unique
- active group membership on `(group_id, user_id)`
- `expenses(group_id, created_at desc)` where `deleted_at is null`
- `expense_shares(expense_id)`
- `settlement_intents(group_id, status)`
- `settlement_intents(tx_hash)` unique where not null
- `activity_events(group_id, created_at desc)`
- `sessions(token_hash)` unique
- `invites(token_hash)` unique

---

# 7. Money representation

## 7.1 Fiat ledger

All ledger amounts are integer minor units.

```ts
// NZD 123.45
const amountMinor = 12345n
```

Do not persist `123.45` as a float.

## 7.2 NIM settlement

The provider accepts Luna:

```text
1 NIM = 100,000 Luna
```

Use integer Luna everywhere after the rate conversion.

## 7.3 JSON boundary

JavaScript `bigint` is not JSON serializable. API contracts expose integer money as decimal strings:

```json
{
  "amountMinor": "12345",
  "nimAmountLuna": "1843000"
}
```

Client converts only at the domain edge:

```ts
const amountMinor = BigInt(payload.amountMinor)
```

Formatting functions accept bigint, currency and locale.

---

# 8. Authentication protocol

## 8.1 Start

Client explicitly initializes the provider:

```ts
import { init } from '@nimiq/mini-app-sdk'

const nimiq = await init({ timeout: 10_000 })
```

The exact timeout option must be confirmed against the installed SDK version. If unsupported, wrap initialization with an application timeout rather than inventing provider behaviour.

The app does not call `listAccounts()` until the user taps the sign-in button.

## 8.2 Obtain address

```ts
const accounts = await nimiq.listAccounts()
```

If multiple addresses are returned, the UI asks the user which account should represent them in Tally.

## 8.3 Challenge request

```http
POST /api/auth/challenge
Content-Type: application/json

{
  "address": "NQ..."
}
```

Response:

```json
{
  "challengeId": "uuid",
  "message": "Tally sign-in\nDomain: tally.example\nAddress: NQ...\nNonce: ...\nExpires: 2026-09-12T...Z"
}
```

Canonical message fields are newline-delimited and generated only by the server.

## 8.4 Sign

```ts
const { publicKey, signature } = await nimiq.sign(message)
```

## 8.5 Verify

```http
POST /api/auth/verify
Content-Type: application/json

{
  "challengeId": "uuid",
  "address": "NQ...",
  "publicKey": "hex",
  "signature": "hex"
}
```

Server verification sequence:

1. Read challenge in a transaction.
2. Reject if missing, used or expired.
3. Reject if requested address differs.
4. Parse public key.
5. Derive Nimiq address from public key and compare normalized address.
6. Recreate the exact signed-message payload required by Nimiq's message signing semantics.
7. Verify signature.
8. Atomically mark challenge used.
9. Upsert user/public key.
10. Create opaque session token.
11. Store only SHA-256 session token hash.
12. Set secure HttpOnly cookie.

The Nimiq signed-message prefix/verification implementation must be validated with an actual Mini App SDK signature during Phase 1 before authentication is considered complete.

## 8.6 Session

Default duration: 7 days.

Cookie name example:

```text
__Host-tally_session
```

Production attributes:

```text
HttpOnly
Secure
SameSite=Lax
Path=/
```

Use the `__Host-` prefix only when all browser requirements are met.

---

# 9. Authorization

Every group API call resolves membership server-side.

Never trust a client-provided role or membership ID.

Authorization matrix:

| Action | Owner | Member | Non-member |
|---|---:|---:|---:|
| View group | yes | yes | no |
| Add expense | yes | yes | no |
| Edit own expense | yes | yes | no |
| Edit another user's expense | yes | optional/no for Cycle II | no |
| Delete own expense | yes | yes | no |
| Create invite | yes | optional; default no | no |
| Revoke invite | yes | no | no |
| Rename group | yes | no | no |
| Archive group | yes | no | no |
| Leave group | yes* | yes | n/a |

`*` Owner cannot leave while they are the only owner. Cycle II can simply prohibit owner departure instead of implementing ownership transfer under deadline pressure.

---

# 10. Split engine

All split functions are pure and return validated shares.

## Equal

```ts
function splitEqual(amountMinor: bigint, memberIds: string[]): Share[]
```

- Sort member IDs deterministically.
- `base = amount / count`.
- `remainder = amount % count`.
- First `remainder` sorted members receive +1 minor unit.

## Exact

```ts
function splitExact(
  amountMinor: bigint,
  inputs: Array<{ memberId: string; amountMinor: bigint }>
): Share[]
```

Reject unless total equals expense amount exactly.

## Percentage

```ts
function splitPercentage(
  amountMinor: bigint,
  inputs: Array<{ memberId: string; percentBps: number }>
): Share[]
```

Requirements:

```text
sum(percentBps) = 10,000
0 <= percentBps <= 10,000
```

Initial amounts use integer floor division. Remaining minor units are assigned deterministically based on largest fractional remainder, then stable member ID. This is preferable to blindly assigning all rounding remainder to arbitrary member order.

---

# 11. Balance engine

For each non-deleted expense:

- payer is credited `expense.amountMinor`;
- every share participant is debited `share.amountMinor`.

Pseudo-code:

```ts
for (const expense of expenses) {
  balance[expense.paidByMemberId] += expense.amountMinor

  for (const share of expense.shares) {
    balance[share.memberId] -= share.amountMinor
  }
}
```

Then apply confirmed settlements:

```ts
for (const settlement of confirmedSettlements) {
  balance[settlement.payerMemberId] += settlement.ledgerAmountMinor
  balance[settlement.recipientMemberId] -= settlement.ledgerAmountMinor
}
```

Interpretation:

- positive balance = group owes this member;
- negative balance = this member owes the group;
- zero = square.

Hard invariant:

```ts
sum(Object.values(balance)) === 0n
```

If not zero, API returns calculation error and does not generate a settlement plan.

---

# 12. Settlement optimization

Function signature:

```ts
interface SettlementTransfer {
  fromMemberId: string
  toMemberId: string
  amountMinor: bigint
}

function calculateSettlementPlan(
  balances: Record<string, bigint>,
): SettlementTransfer[]
```

Algorithm:

```text
creditors = positive balances
debtors   = negative balances

sort creditors by amount desc, memberId asc
sort debtors by abs(amount) desc, memberId asc

while both non-empty:
  debtor   = first debtor
  creditor = first creditor
  amount   = min(abs(debtor), creditor)
  emit debtor -> creditor for amount
  reduce both
  remove zeros
  re-sort or maintain priority ordering
```

Correct product wording: **optimized settlement plan** / **reduced transfers**.

Do not claim guaranteed globally minimal transfer count unless a later exact algorithm and proof/test suite are implemented.

## Ledger fingerprint

Settlement plans become stale when the ledger changes.

Create a canonical representation of the active accounting state:

```text
expense IDs + revisions + amounts + shares + confirmed settlement IDs
```

Sort deterministically and hash with SHA-256.

Store this `ledgerFingerprint` on each settlement intent. Before a wallet request begins, recompute and reject stale plans.

---

# 13. Exchange-rate boundary

The ledger debt remains fiat. A NIM payment therefore needs a quote.

Provider interface:

```ts
interface NimRateProvider {
  getQuote(currency: string): Promise<{
    quotePerNim: DecimalString
    source: string
    observedAt: Date
  }>
}
```

Preferred first implementation: Nimiq-supported exchange-rate utility/API if its production behaviour and supported fiat currency meet requirements.

Quote rules:

- cache briefly server-side;
- settlement quote expiry target: 2–5 minutes;
- display source time/expiry in payment sheet;
- once payment sheet opens, expected Luna amount cannot mutate silently;
- expired quote requires user-visible refresh.

Conversion must use decimal/integer arithmetic, not binary floats.

Example conceptual calculation:

```text
fiat debt = 3,160 NZD cents
NIM/NZD rate = decimal quote
NIM amount = fiat debt / quote
Luna = rounded according to explicit settlement rounding rule
```

Define and test the rounding rule once. Do not scatter conversions around UI code.

---

# 14. NIM payment integration

Provider adapter:

```ts
interface NimiqWalletAdapter {
  connect(): Promise<string[]>
  sign(message: string): Promise<{ publicKey: string; signature: string }>
  getBlockNumber(): Promise<number>
  isConsensusEstablished(): Promise<boolean>
  pay(input: {
    recipient: string
    valueLuna: bigint
    reference?: string
  }): Promise<{ txHash: string }>
}
```

Implementation uses `@nimiq/mini-app-sdk` and converts bigint to a provider-supported safe number only after checking `<= Number.MAX_SAFE_INTEGER`. If the installed SDK accepts only `number`, values outside safe integer range are rejected rather than silently rounded.

Prefer:

```ts
nimiq.sendBasicTransactionWithData({
  recipient,
  value,
  data: `TALLY:${shortRef}`,
})
```

Fallback:

```ts
nimiq.sendBasicTransaction({ recipient, value })
```

The backend verification remains authoritative in either case.

---

# 15. Chain verification

The API talks to Nimiq RPC, not the browser, to confirm submitted transactions.

Interface:

```ts
interface NimiqChainVerifier {
  getTransaction(txHash: string): Promise<ChainTransaction | null>
}
```

Verification procedure:

```ts
async function verifySettlement(intent, tx) {
  assert(tx.hash === intent.txHash)
  assert(normalize(tx.sender) === normalize(payer.nimiqAddress))
  assert(normalize(tx.recipient) === normalize(recipient.nimiqAddress))
  assert(BigInt(tx.value) === intent.nimAmountLuna)
  assert(txIsIncludedAccordingToPolicy(tx))
  if (intent.expectedReference) assert(tx.data === intent.expectedReference)
}
```

RPC failures produce `CONFIRMING`, not `FAILED`, until retry policy is exhausted.

Recommended retry schedule after submission:

```text
0 sec
2 sec
5 sec
10 sec
20 sec
30 sec
60 sec
then background/manual refresh
```

Server verification endpoint must be idempotent.

A transaction hash may be attached to at most one settlement intent.

---

# 16. API contract

All endpoints are versioned under `/api/v1`.

## Auth

```text
POST   /api/v1/auth/challenge
POST   /api/v1/auth/verify
POST   /api/v1/auth/logout
GET    /api/v1/me
PATCH  /api/v1/me
```

## Groups

```text
GET    /api/v1/groups
POST   /api/v1/groups
GET    /api/v1/groups/:groupId
PATCH  /api/v1/groups/:groupId
POST   /api/v1/groups/:groupId/archive
GET    /api/v1/groups/:groupId/activity
```

## Invites

```text
POST   /api/v1/groups/:groupId/invites
DELETE /api/v1/groups/:groupId/invites/:inviteId
POST   /api/v1/invites/:token/join
GET    /api/v1/invites/:token/preview
```

Preview returns only safe group metadata needed for the join screen.

## Expenses

```text
GET    /api/v1/groups/:groupId/expenses
POST   /api/v1/groups/:groupId/expenses
PATCH  /api/v1/groups/:groupId/expenses/:expenseId
DELETE /api/v1/groups/:groupId/expenses/:expenseId
```

## Balances

```text
GET    /api/v1/groups/:groupId/balances
GET    /api/v1/groups/:groupId/settlement-plan
```

## Settlements

```text
POST   /api/v1/groups/:groupId/settlements
POST   /api/v1/settlements/:settlementId/start
POST   /api/v1/settlements/:settlementId/submit
POST   /api/v1/settlements/:settlementId/verify
GET    /api/v1/settlements/:settlementId
```

## Response envelope

Success:

```json
{
  "data": {}
}
```

Error:

```json
{
  "error": {
    "code": "SETTLEMENT_STALE",
    "message": "The group changed. Refresh the settlement plan before paying.",
    "requestId": "..."
  }
}
```

Stable error codes are part of the client contract.

---

# 17. Idempotency and concurrency

Financial-ish systems become embarrassing when double taps create duplicate state.

Use an `Idempotency-Key` header for:

- create expense;
- update expense where retry ambiguity exists;
- create settlement intent;
- submit transaction hash.

Rules:

- key scoped to authenticated user + route;
- identical replay returns original response;
- same key with different request body returns `409 IDEMPOTENCY_CONFLICT`.

Expense updates use `revision` optimistic concurrency:

```http
PATCH /expenses/:id
{
  "expectedRevision": 3,
  ...
}
```

If current revision is 4, return `409 EXPENSE_STALE`.

Settlement intent creation occurs in a database transaction after recalculating current balances and ledger fingerprint.

---

# 18. Activity model

Activity history is not blockchain history. It is the product audit trail.

Event examples:

```text
GROUP_CREATED
MEMBER_JOINED
EXPENSE_CREATED
EXPENSE_UPDATED
EXPENSE_DELETED
SETTLEMENT_CREATED
SETTLEMENT_SUBMITTED
SETTLEMENT_CONFIRMED
SETTLEMENT_FAILED
```

Activity events are append-only from application code.

Metadata contains presentation-safe values only. Never place session tokens, signatures, raw invite tokens or secrets into event metadata.

---

# 19. Frontend screens

Keep Cycle II navigation tiny.

## 19.1 Boot / provider state

Responsibilities:

- initialize ordinary app shell;
- detect Nimiq Pay environment;
- load existing session;
- never trigger wallet confirmation automatically.

## 19.2 Sign in

- value proposition;
- explicit Continue with Nimiq Pay;
- permission denial explanation;
- retry.

## 19.3 Home

Cards per group:

```text
Home
You are owed NZ$82.10

Taupō Weekend
You owe NZ$31.00
```

Primary action: New group.

## 19.4 Group

- current user net balance;
- member balances;
- recent expenses;
- Add expense;
- Settle.

## 19.5 Expense editor

- description;
- amount;
- payer;
- participants;
- Equal / Exact / Percentage tabs;
- immediate validation that split totals equal expense.

## 19.6 Settlement plan

- explains reduced transfer plan;
- prominently shows the current user's required payments;
- receiving transfers shown separately;
- plan stale state refreshes cleanly.

## 19.7 Payment sheet

Before wallet prompt display:

- recipient display name;
- recipient abbreviated wallet address;
- ledger debt in group currency;
- NIM amount;
- rate timestamp/expiry;
- one explicit `Pay with NIM` button.

After hash:

- submitted state;
- confirmation progress;
- tx hash/view details;
- confirmed state.

---

# 20. Frontend state rules

Server state belongs in query cache, not duplicated indefinitely in Pinia.

Pinia stores only app/session concerns such as:

```text
provider readiness
selected wallet account
current session profile
pending invite token
UI preferences
```

Groups, expenses, balances and settlements are fetched/cached server state.

After mutation, invalidate the narrowest affected queries.

Settlement/payment state must survive navigation/reload by reading intent state from the server rather than relying on component memory.

---

# 21. Error taxonomy

Client should map stable error codes to helpful UX.

```text
AUTH_CHALLENGE_EXPIRED
AUTH_SIGNATURE_INVALID
AUTH_PERMISSION_DENIED
SESSION_EXPIRED
GROUP_NOT_FOUND
NOT_GROUP_MEMBER
INVITE_EXPIRED
INVITE_REVOKED
EXPENSE_STALE
SPLIT_TOTAL_INVALID
LEDGER_INVARIANT_FAILED
SETTLEMENT_STALE
QUOTE_EXPIRED
WALLET_REJECTED
TRANSACTION_MISMATCH
TRANSACTION_ALREADY_USED
RPC_UNAVAILABLE
RATE_UNAVAILABLE
RATE_LIMITED
INTERNAL_ERROR
```

`INTERNAL_ERROR` displays a request ID, never raw stack trace.

---

# 22. Security controls

## Browser / WebView

- strict CSP compatible with deployed assets and Nimiq host requirements;
- no inline secrets;
- no dynamic remote script injection;
- dependencies pinned through lockfile;
- sanitize/escape all user-generated text;
- no HTML rendering from expense descriptions;
- secure headers;
- HTTPS production only.

## API

- Origin validation on mutations;
- schema validation for every input;
- rate limits on auth/invite/payment endpoints;
- parameterized DB access only;
- no service credentials returned to browser;
- production logs redact cookies, auth headers and signatures;
- transaction verification never trusts client-provided decoded fields.

## Wallet

- private keys never touch Tally;
- wallet prompts only after explicit user action;
- UI tells user what they are signing/paying before prompt;
- settlement recipient is server-derived from group membership, not arbitrary form input.

---

# 23. Privacy and data handling

Collect only what Tally needs:

- Nimiq wallet address;
- public key used for authentication verification;
- display name;
- group membership;
- expense and settlement records;
- operational logs with limited retention.

Do not require:

- email;
- phone number;
- legal name;
- contacts access;
- device advertising ID;
- location.

Provide a clear privacy page before submission explaining stored data and purpose.

Wallet addresses and transaction hashes are public blockchain identifiers, but Tally still treats their association with group-expense data as application data that should not be sprayed into analytics.

---

# 24. Analytics

Use first-party or privacy-conscious analytics if possible.

Required product metrics can be generated from application events/database without external analytics:

```text
distinct authenticated users
groups created
invites joined
expenses created
settlements started/submitted/confirmed
return sessions
```

Do not measure success by pageviews alone. Competition real-usage evidence should emphasize completed product loops.

---

# 25. Testing strategy

## Unit

Highest priority domain tests:

- equal/exact/percentage splits;
- money formatting/parsing;
- balances;
- settlement optimization;
- fingerprinting;
- state transition guards.

Use property-based testing where practical for monetary invariants.

## Integration

Test against a real temporary PostgreSQL database:

- auth challenge single-use;
- memberships;
- expense transactions;
- optimistic concurrency;
- idempotency;
- settlement creation;
- tx hash uniqueness;
- authorization.

## E2E browser

Provider is replaced by a deterministic fake only for general UI automation. Fake provider tests do **not** count as provider acceptance.

## Physical provider acceptance

Mandatory test on Nimiq Pay:

- `init()`;
- `listAccounts()`;
- `sign()`;
- rejected sign;
- Testnet `sendBasicTransaction` / WithData;
- rejected transaction;
- tx hash receipt;
- server chain verification.

---

# 26. CI gates

Every push/PR should run:

```text
install from lockfile
typecheck
lint
unit tests
integration tests where environment permits
production build
```

Main branch must never intentionally contain a red build.

Pre-release manual gate additionally requires physical Nimiq Pay test results recorded in the release notes/checklist.

---

# 27. Performance targets

Competition scoring explicitly values speed and stability, so use practical budgets:

- first meaningful UI on modern phone: target < 2 s on normal network;
- no multi-megabyte decorative media on initial route;
- route-level lazy loading where useful;
- API p95 reads target < 500 ms excluding external chain/rate calls;
- ordinary mutations target < 800 ms excluding wallet approval;
- no polling faster than necessary;
- settlement confirmation polling uses backoff.

Do not ship a 3D animated receipt because someone discovered WebGL on deadline week.

---

# 28. Local development

Official Nimiq local testing expects a LAN-accessible web server.

Typical flow:

```bash
npm install
npm run dev -- --host
```

Open the network URL inside Nimiq Pay Custom URL.

For NIM testing, use Nimiq Pay's developer network switch/Testnet and test funds.

Secure-context-only APIs may behave differently on `http://<LAN-IP>`, so code must feature-detect APIs such as `crypto.randomUUID()` and have safe fallbacks.

Backend development must also be reachable from the phone. The preferred same-origin dev arrangement proxies `/api` through the Vite dev server to the local API process so the phone only needs one LAN origin.

---

# 29. Deployment

Production requirements:

- HTTPS;
- same-origin `/api`;
- PostgreSQL connection suitable for serverless pooling;
- database migrations run deliberately, never opportunistically on request startup;
- environment secrets configured only in host;
- `NIMIQ_RPC_URL` configurable;
- rate provider configurable;
- production health endpoint.

Health endpoints:

```text
GET /api/health/live   process alive
GET /api/health/ready  DB reachable; external dependencies optionally summarized
```

Readiness must not require a blockchain write.

---

# 30. Release checklist gate

A release candidate cannot become competition production unless all are true:

- authentication works in Nimiq Pay;
- two-wallet invite flow works;
- all split modes work;
- balance invariant tests pass;
- settlement optimization tests pass;
- at least one real Testnet settlement is confirmed by server verification;
- wallet rejection is recoverable;
- RPC outage does not falsely fail/confirm payment;
- page works at 375 px;
- no horizontal overflow;
- all core tap targets >= 44 px;
- clean clone builds;
- no secret in git history/current tree;
- privacy disclosure exists;
- MIT license exists;
- repository is public for submission;
- production link opens successfully inside Nimiq Pay.

---

# 31. Deliberate non-goals for Cycle II

Do not implement these until the release gate passes:

```text
USDT
smart contracts
staking
NFTs
custom token
AI/OCR
messaging
bank feeds
merchant marketplace
complex debt graph optimization proof
recurring billing
multi-currency accounting
native mobile app
```

A boringly correct debt of NZD 31.60 that becomes one verified NIM settlement is worth more to this product than fifteen unfinished Web3 features.

---

# 32. External references

- Mini Apps overview: https://nimiq.dev/mini-apps
- Mini App API: https://nimiq.dev/mini-apps/api-reference
- Nimiq Provider API: https://nimiq.dev/mini-apps/api-reference/nimiq-provider
- Load local Mini App: https://nimiq.dev/mini-apps/development/load-local-mini-app
- Nimiq RPC: https://nimiq.dev/rpc
- RPC methods: https://nimiq.dev/rpc/methods
- Nimiq Utils / exchange rates: https://nimiq.dev/nimiq-utils
- Competition scoring: https://miniappscompetition.com/scoring
- Competition rules: https://miniappscompetition.com/rules

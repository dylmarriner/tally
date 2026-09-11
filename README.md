# Tally

**Share expenses. Settle cleanly.**

Tally is a Nimiq Pay Mini App for groups that share real-world expenses. It keeps a simple shared ledger, calculates who owes whom, reduces the result to a minimal practical set of settlements, and lets members settle directly with NIM inside Nimiq Pay.

Tally is intentionally not a generic crypto wallet, payment dashboard, marketplace, or accounting suite. The product loop is narrow:

> Create group → invite people → add expenses → calculate balances → optimize settlements → pay with NIM → verify on-chain → close the debt.

## Competition target

Tally is being built for **Nimiq Mini Apps Competition Cycle II**. The submission must be a finished Mini App, use the Nimiq Pay framework meaningfully, be public on GitHub under the MIT License, and work for a real user on first launch.

The build is optimized around the competition rubric:

- Functionality, reliability and usefulness: **45 points**
- Nimiq Pay / Nimiq integration: **25 points**
- Real usage: **15 points**
- Design and UX: **10 points**
- Builder promotion: **5 points**

Internal release target: **17 September 2026**. Competition submission buffer: **18 September 2026**.

## Core product

### Required for Cycle II

- Nimiq Pay wallet connection
- Wallet-backed sign-in using a signed challenge
- Groups and invite links
- Group membership
- Equal, exact-amount and percentage expense splits
- Integer-safe money calculations
- Per-member balances
- Deterministic optimized settlement plan
- NIM settlement through the Nimiq Mini App SDK
- Settlement reference attached to the NIM transaction where supported
- Server-side transaction verification before a debt is marked settled
- Activity history
- Mobile-first Nimiq Pay WebView UX
- Error, retry, rejection, offline and empty states
- Basic privacy controls and data deletion path
- Production analytics for product usage without storing sensitive wallet data beyond what the app needs

### Explicitly deferred until the Cycle II build is stable

- USDT settlement
- Receipt OCR
- AI assistant
- Chat
- Social feed
- Rewards token
- NFTs
- Staking
- Escrow / smart contracts
- Bank integrations
- Subscription billing
- Advanced accounting exports

## Technical direction

- **Frontend:** Vue 3 + TypeScript + Vite
- **State:** Pinia for client/session state; query cache for server state
- **Validation:** Zod schemas shared at API boundaries
- **Backend:** TypeScript API running on a Node 22 serverless runtime
- **Database:** PostgreSQL
- **DB access:** Drizzle ORM / migrations
- **Wallet:** `@nimiq/mini-app-sdk`
- **Blockchain verification:** Nimiq RPC from the server
- **Deployment:** same-origin web + API deployment to keep cookies, CORS and WebView behaviour simple
- **Testing:** Vitest + API integration tests + Playwright/browser tests + mandatory physical-device testing inside Nimiq Pay

The official Mini App provider is accessed with:

```ts
import { init } from '@nimiq/mini-app-sdk'

const nimiq = await init()
```

Sensitive wallet actions are always initiated by an explicit user action. Tally never prompts for wallet permissions automatically on page load.

## Running locally

The web app and the API are separate processes in dev:

```bash
npm install
npm run dev:api   # Node HTTP API on :4000 (in-memory stores if DATABASE_URL is unset)
npm run dev       # Vite dev server on :5173, proxying /api → :4000
```

Set `DATABASE_URL` to use PostgreSQL-backed stores instead of the dev in-memory
fallback; run `npm run db:migrate` after wiring credentials.

Auth endpoints:

```text
POST /api/v1/auth/challenge
POST /api/v1/auth/verify
POST /api/v1/auth/logout
GET  /api/v1/me
PATCH /api/v1/me
```

## Documentation

- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phased execution plan, dates, gates and acceptance criteria
- [`docs/WORKBOARD.md`](docs/WORKBOARD.md) — one task per phase with dependencies and exit-gate checklists
- [`docs/TECHNICAL_BLUEPRINT.md`](docs/TECHNICAL_BLUEPRINT.md) — architecture, data model, APIs, auth, settlement engine, security and deployment
- [`docs/COMPETITION_CHECKLIST.md`](docs/COMPETITION_CHECKLIST.md) — rubric-driven release and submission checklist
- [`AGENTS.md`](AGENTS.md) — implementation rules for coding agents and contributors

## Product principles

1. **The ledger is the source of truth.** Blockchain settlement closes debts; it does not replace the shared expense model.
2. **Money is stored as integers.** Never use floating-point values for balances, splits or settlement obligations.
3. **Server verifies settlement.** A client-reported transaction hash is evidence to check, not proof.
4. **Wallet prompts are intentional.** Every signature or payment request follows a user tap and explains why it is needed.
5. **No hidden crypto complexity.** The user sees people, expenses and balances first; blockchain details are available when useful.
6. **Finish before expanding.** No secondary feature may delay the complete create → split → settle flow.

## Official references

- Nimiq Mini Apps: https://nimiq.dev/mini-apps
- Mini App API: https://nimiq.dev/mini-apps/api-reference
- Nimiq provider: https://nimiq.dev/mini-apps/api-reference/nimiq-provider
- Local Mini App testing: https://nimiq.dev/mini-apps/development/load-local-mini-app
- Nimiq RPC: https://nimiq.dev/rpc
- Competition scoring: https://miniappscompetition.com/scoring
- Competition rules: https://miniappscompetition.com/rules

## License

MIT. Competition submission code must remain open source under the MIT License.

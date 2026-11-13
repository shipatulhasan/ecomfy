# Ecomfy

A grocery storefront with an admin panel. Built with Next.js 16 (App Router, Cache Components), Prisma 7 + PostgreSQL, Better Auth, Tailwind v4 and shadcn/ui. Project conventions live in `CLAUDE.md`; design data lives in `designs/`.

## Setup

```bash
pnpm install
cp .env.example .env      # fill in DATABASE_URL, DIRECT_URL, BETTER_AUTH_SECRET, SEED_PASSWORD
pnpm db:migrate
pnpm db:seed              # demo catalog, users, orders, cart, store settings
pnpm dev
```

The seed prints the demo accounts. All of them use `SEED_PASSWORD`:

- `admin@ecomfy.test`
- `dianne.russell@ecomfy.test` (has a cart and orders)
- `arif.hossain@ecomfy.test` (email not verified)

## Money

- Every amount is **BDT in integer poisha** (1/100 ৳): in the DB, in code and at the gateways. Fields keep the `*Cents` name.
- The topbar currency switcher shows USD at `Settings.usdToBdtRate` (seeded at 123). This is display only; orders are always charged in BDT.
- Each order stores what the customer saw (`displayCurrency`, `fxRate`, `displayTotalCents`) next to the charged `totalCents`.

## Checkout and payments

`/checkout` offers three independent payment methods. Each has its own provider in `lib/payments/`, its own routes, env vars and log tag.

| Method | Provider | Callbacks | Log tag |
|---|---|---|---|
| bKash (Tokenized Checkout, direct) | `lib/payments/bkash.ts` | `GET /api/payments/bkash/callback` | `[bkash]` |
| Card / online banking (SSLCommerz v4, no bKash in its gateway) | `lib/payments/sslcommerz.ts` | `POST /api/payments/sslcommerz/{success,fail,cancel,ipn}` | `[sslcz]` |
| Cash on Delivery | `lib/payments/cod.ts` | none | `[cod]` |

### Flow

1. **`placeOrder`** (`lib/actions/checkout.ts`) re-reads the cart and recomputes every price, discount, shipping rate and COD fee on the server (`lib/checkout/pricing.ts`). In one transaction it then creates:
   - the order;
   - item price snapshots and the address snapshot;
   - the stock reservation (`Variant.reserved`);
   - the first `Payment` attempt.

   The form's idempotency key is unique, so a double submit creates one order.
2. **Hand-off:**
   - Gateways redirect the customer.
   - COD lands on `/checkout/success` straight away, with status `PENDING_CONFIRMATION`.
3. **Payment confirmation:**
   - bKash is confirmed by Execute (or Query, after a timeout or error), with amount and invoice checks.
   - SSLCommerz is confirmed only by the Validation API (`val_id`), with `tran_id`, amount and currency checks. The success redirect and the IPN race, and the first to arrive wins.
   - Repeated callbacks are no-ops.
4. **Outcomes:**
   - Paid → `PROCESSING` / `PAID`. The reserved stock is committed and the ordered lines leave the cart.
   - Failed or cancelled → stock released, cart kept. `/checkout/failed` offers "Try again" or "Change method", and either starts a new attempt on the same order.
5. **Expiry:** `PENDING_PAYMENT` orders unpaid after 30 minutes become `EXPIRED` and release their stock. This runs from `GET /api/cron/expire-orders` with `Authorization: Bearer $CRON_SECRET`; `vercel.json` schedules it every 5 minutes, which needs a Vercel plan that allows that frequency. It also runs lazily when a result page is opened.

Store settings come from the DB (`Settings` and `ShippingZone`, read through `getStoreSettings()` with `cacheTag("settings")`). They cover the COD switch, fee, maximum order and allowed districts, the per-phone daily COD limit, the bKash and SSLCommerz switches, the shipping zones and the USD rate.

COD protection:

- COD orders are rate-limited per phone number.
- Phones with earlier cancelled COD orders are flagged (`Order.codFlagged`), not blocked.

### Environment

```bash
APP_URL=https://<public-https-origin>   # gateways call back here; must be https in production
CRON_SECRET=<random 24+ chars>

BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v2/tokenized-checkout
BKASH_APP_KEY=…  BKASH_APP_SECRET=…  BKASH_USERNAME=…  BKASH_PASSWORD=…

SSLCZ_STORE_ID=…  SSLCZ_STORE_PASSWORD=…  SSLCZ_IS_LIVE=false
```

- A missing or invalid gateway env only disables that gateway. The customer sees "unavailable, try again or choose another method".
- No keys are kept in code. Gateway requests and responses are logged with secrets redacted, and also stored in `Payment.raw`.
- bKash allows only 2 Grant Token calls per hour, so the token is cached in the DB (`GatewayToken`) and refreshed shortly before it expires.

### Testing locally (tunnel)

Gateways must reach your machine over public https. Start a tunnel, then point `APP_URL` at it:

```bash
pnpm dev
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
# put the printed https URL in .env as APP_URL (and BETTER_AUTH_URL if you sign in through it), restart dev
```

Open the site through the tunnel URL.

- **bKash sandbox:** use the sandbox app credentials and test wallets from the bKash developer portal.
  - To test the "execute timed out → query" path, set `BKASH_SIMULATE_EXECUTE_TIMEOUT=1` (dev only).
- **SSLCommerz sandbox:** register a sandbox store at developer.sslcommerz.com and use its test cards.
  - The gateway list is restricted by `SSLCZ_CHANNELS` in `lib/payments/sslcommerz.ts` (cards + internet banking). Check on the sandbox page that bKash isn't offered.
- **IPN-before-redirect:** in the SSLCommerz sandbox panel, set the IPN URL to `<APP_URL>/api/payments/sslcommerz/ipn`. Close the tab before the success redirect fires; the IPN alone marks the order paid.

## Commands

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:studio` · `pnpm tokens` · `pnpm assets:crop` · `pnpm icons`

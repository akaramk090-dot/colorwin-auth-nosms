# Color Win + YouPI PC test setup

Current gateway: https://ensure-exp-registered-revisions.trycloudflare.com
Private phone pairing: http://127.0.0.1:7101
Local admin: http://127.0.0.1:6001
Receiving UPI: akaramk090-1@oksbi
Payee: Color Win
Color Win site: https://9bk0d38n-5173.inc1.devtunnels.ms/

Android has not been paired yet. Automatic deposits remain disabled until the bank observer is checked.

## Phone setup

Open the private pairing page on this computer. Download the supplied APK on the Android bank-alert phone, install it, choose Pair/Scan QR, then scan the QR on the computer. Allow SMS/notification access and background running. The page checks phone connection every ten seconds. Do not share the pairing QR.

## Running processes

From integrations/youpi/gateway:

- node scripts/colorwin-run.mjs: API 6100, checkout 7000, admin 6001, bound to loopback.
- node scripts/colorwin-proxy.mjs: public-facing filtered proxy on 7100, bound to loopback.
- node scripts/colorwin-phone-setup.mjs: private phone setup on 7101.
- cloudflared tunnel --url http://127.0.0.1:7100 --no-autoupdate

The temporary tunnel URL changes when restarted. Update COLORWIN_GATEWAY_ORIGIN in gateway .env and the private Supabase youpi_configuration URLs, restart services, then refresh Android pairing. Keep the computer and services running during testing.

## Integration and security

- Upstream ZIP extracted to gateway; dependencies installed with npm ci --ignore-scripts.
- .env and data/.secrets contain generated private secrets. Never publish them or move them into dist.
- Developer simulation is disabled (NODE_ENV=production; YOUPI_ALLOW_DEV_TOOLS=false). Only UPI is enabled. Admin and generic ingestion endpoints are blocked by the tunnel proxy.
- The Edge Function verifies the user's JWT for checkout creation. A server-reserved order supplies the authoritative amount/order ID.
- A wallet is credited only after raw-body HMAC validation AND querying the configured gateway API for SUCCESS, INR, UPI, verificationLevel >= 1, matching order/payment identity and amount.
- COD/counter payments, wrong amounts and unverified payments cannot credit a wallet. Duplicate callbacks cannot double credit.
- Private config uses RLS default deny and service-role-only access. Configuration supports Edge environment secrets as overrides.
- Existing deposit ledger, promotion records and deposit notification flows are preserved.
- Upstream's webhook implementation omits UTR; Color Win stores youpi:<payment-id> as the bank reference.
- Enable payment-config.js youpiEnabled only after phone/verification setup is complete and private settings.enabled is true.

Webhook endpoint:
https://lwzqbhmdfkbycdizieff.supabase.co/functions/v1/youpi-payments

Environment overrides: YOUPI_API_URL, YOUPI_CHECKOUT_ORIGIN, YOUPI_MERCHANT_ID, YOUPI_WEBHOOK_SECRET, COLORWIN_PUBLIC_ORIGIN. Keep all signing secrets server-side.

## Validation

YouPI contract tests pass (signature integrity, bank verification, amount, method and redirect checks). Rollback-only SQL tests check idempotent wallet/promotion credit and private permissions. A setup-only INR 1 checkout was created/rendered to verify HTTPS and branding; no payment was made and no wallet was credited. Full physical-phone bank verification is pending.

The supplied ZIP package metadata says Commercial. Public source availability does not establish an open-source license; review licensing before redistribution/commercial hosting.

Upstream: https://github.com/youpi-pg/YouPI-PG

## Berry native dependency repair

The initial install skipped lifecycle scripts. Berry requires the better-sqlite3 native binding; repaired using `npm rebuild better-sqlite3 --foreground-scripts`. Native SQLite initialization and the live authenticated WhatsApp reconnect endpoint now return `QR_READY` with QR data.


## Embedded Color Win checkout (19 October 2026)

Customers use their existing Color Win login. Deposit creation now stays inside the original QR / 12-digit UTR / Submit UI; no YouPI customer signup, WhatsApp OTP, or hosted-checkout redirect is used. The existing Submission successful alert and Account redirect remain.

The authenticated Supabase Edge service signs timestamped requests to `/api/v1/colorwin/payment`. Only this merchant-authenticated bridge activates the gateway slot for the embedded checkout. The QR uses the gateway receiving-account snapshot and authoritative expiry; queued customers wait until their own slot is ACTIVE. The Android bank observer and signed, independently verified SUCCESS webhook remain the authority for wallet credit. Entering a UTR alone never credits the wallet.

Database additions: `supabase/youpi-embedded-checkout.sql` (owner-scoped order lookup, service-only receiver/expiry synchronization). Edge function `youpi-payments` version 3 is deployed. Existing gateway WhatsApp sender configuration is retained but is not required by Color Win deposits.

Validation: root `npm test`; gateway `node --test scripts/colorwin-checkout.test.mjs`; rollback SQL tests `tests/youpi-embedded.sql` and `tests/youpi-wallet.sql`. A physical bank payment and wallet credit still need to be tested by the owner.


## Delayed notification fix (19 October 2026)

The first embedded UTR test revealed that the upstream 30-second PROCESSING window failed an order 23 seconds before its genuine Android payment notification arrived. Color Win now uses a five-minute processing window. Trusted Color Win metadata carries the display order reference and submitted UTR. Persisted bank observations can reconcile ACTIVE/PROCESSING/FAILED/EXPIRED orders only with the same receiver, exact paise, bounded payment time, and a matching bank UTR or strong order reference. An amount match alone never recovers a failed checkout. Observation claims and verification are atomic; normal signed SUCCESS webhooks still credit the wallet idempotently.

The affected ₹100 deposit was reconciled against its existing Android notification. The SUCCESS webhook returned 200; the Color Win deposit is complete and its ledger contains exactly one ₹100 credit. Edge version 4 is deployed. Regression checks cover delayed notifications, mismatched amount/reference/UTR, replayed observations, and the five-minute window.


## Concurrent QR checkout (20 October 2026)

Color Win orders now activate independently; they no longer acquire the shared receiving-account slot. Every authenticated deposit gets an ACTIVE QR immediately, with its own expiry and verification timer. Existing trusted INITIATED/QUEUED orders are activated at boot. Other upstream merchant checkout modes keep their original queue behavior.

Automatic Color Win credit requires a persisted bank observation with a uniquely matching order reference, exact amount, receiver and bounded payment timestamp. A sufficiently long truncated RC reference is accepted only when it uniquely identifies an eligible order. UTR conflicts fail closed; UTR alone or amount/time alone cannot settle a Color Win order. Missing/ambiguous references remain unattributed for review. The legacy cross-account/amount-only fallback cannot settle Color Win sessions. Observation claims and reuse checks for a bank UTR execute in the verification transaction. Signed SUCCESS webhooks and the existing idempotent wallet-credit RPC remain unchanged.

Regression: all 97 frontend/application tests and 24 gateway DB/core/concurrency tests passed. Concurrent scenarios cover 10 same amounts, 10 different amounts, and mixed amounts; reverse-order notifications, duplicates, wrong receiver/amount/reference, ambiguous truncated references and reused bank UTRs. These concurrency scenarios use isolated in-memory fixtures, not real transfers.


## SMS replay and same-minute notification fix (20 October 2026)

Cross-channel fingerprints formerly selected the first source every time, so an SMS followed by Android notifications was repeatedly inserted during background sweeps. Lookups now prefer an existing same-source record and replay sweeps select a bounded, distinct set of source/fingerprint pairs. Fingerprint/source lookups are indexed. Raw notification titles/text are included in normalization, and order-bearing notifications without a bank UTR use their order reference rather than amount/minute as the fingerprint. This prevents distinct same-amount orders in one minute from suppressing each other.

A bank SMS without an order reference can also verify a uniquely matched order when its owner-submitted UTR equals the received bank UTR, with the same receiver, exact amount and bounded original payment time. Missing both order reference and submitted UTR remains unresolved. The latest ₹100 test was linked to the existing bank SMS only after the owner explicitly confirmed this payment; its signed webhook completed the deposit with exactly one ledger credit. The association is separately recorded in the gateway audit.

Tests now normalize actual notification payloads in the 10-user scenarios rather than supplying random fingerprints; a 100-replay cross-channel regression confirms only two source observations are stored.


## Two-UPI pool and shared deposit channels (22 October 2026)

The Color Win receiving pool starts with akaramk090-1@oksbi and salmankhan.0786@ptyes. It is separate from upstream's single-active-VPA setting, so the upstream checkout invariant remains intact. Each new Color Win order is allocated atomically to the receiver with the fewest unexpired ACTIVE/PROCESSING orders; ties use the least-recently-assigned receiver. The receiver snapshot is pinned for that order and retry. Disabled/replaced pool members remain available to reconcile old orders.

Manage 1–10 unique UPI IDs at http://127.0.0.1:7101/receivers. This loopback-only page proxies to token-protected admin APIs; public tunnel proxy blocks those APIs. Pool edits affect only future orders. Device-authenticated Android notifications are routed to the assigned receiving account by their unique order reference or uniquely submitted bank UTR. Ambiguous bank-only messages are held unresolved; owner-submitted UTRs can resolve previously received messages without guessing from amount.

UPI-QR, UMoney (innate), and Paytm now use the same gateway reserve/verify/credit backend. Their saved method and checkout themes remain distinct. `supabase/youpi-deposit-channels.sql` adds an owner-scoped, method-validated reservation RPC; legacy UPI reservation remains available. Edge function version 5 is deployed. No wallet credit logic was loosened.

Public testing tunnel restarted at https://munich-engineers-celebrities-allocation.trycloudflare.com. The phone must scan a fresh pairing QR to reach the new URL. Both receiving accounts send alerts to the same paired phone, as confirmed by the owner. Second-UPI real transfer verification remains untested; isolated pool/routing tests and rollback SQL channel tests passed.


## Second-UPI receiver pin and Paytm notification capture fixes (22 October 2026)

The upstream GET /api/v1/admin/queue fallback was rewriting an active checkout from the second receiver onto the globally active VPA. That GET now selects the actual receiver for display without changing the order. Startup restores non-success Color Win sessions from validated merchant-owned receiving-account snapshots, with an audit entry. Legacy public checkout POST routes cannot mutate trusted Color Win sessions; authenticated Color Win actions remain available.

The owner reported Paytm's title format `Received 100 rs from Sender`, followed by a deposited-to-bank message without an order reference or UTR. The supplied Android APK parsed only currency prefixes, so this suffix-currency title was skipped. A separate signed app, Color Win Bank Observer 1.1.0 (package com.colorwin.observer), now supports both formats, preserves expanded notification text and original posting time, rechecks active notifications on pairing/listener connection, and limits notifications to the listed payment/banking/message apps. It is built with scripts/build-colorwin-observer.py using a persistent private signing key. Original upstream APKs are backed up under data/colorwin-android-build; the new APK is served by the existing pairing page download link. Phone installation, pairing, SMS and notification access are required; this cannot update the already installed app remotely.

The second-UPI payment has NOT been credited merely from the owner's message. Its received Paytm notification was not present in server observations. Receiver pins are repaired, but automatic credit still needs an authenticated order-reference match or exact bank-SMS UTR proof; amount/sender/account-ending alone do not identify a deposit. Backend HTTP/pool regressions (22 tests), six native Java amount-parser cases, compilation and APK v2/v3 signature verification passed. Physical phone validation remains pending.

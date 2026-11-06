# Separate lottery status admin

Open `/lottery-status.html` on the Color Win server. This is a separate mobile dashboard; the existing `admin.html` and player application are not changed.

The owner-supplied access key has been configured on the current Supabase project. Its plaintext is not present in the frontend, migration files, browser storage, or this document. Access uses a salted SHA-256 verifier in a private table. The dashboard stores only its random, revocable session token in this tab's sessionStorage; sessions expire after eight hours. Sign out revokes the server session.

## Dashboard

- WinGo: 30 seconds, 1 minute, 3 minutes, 5 minutes.
- K3, 5D, TRX: 1, 3, 5, 10 minutes.
- Current-round counts for every duration, server-clock countdown, recent rounds with bets, total amount, distinct players and orders.
- Big/Small, color, number, Odd/Even, K3 combination and 5D position breakdowns.
- Amount mode: selection stake / total stake × 100.
- Bet-count mode: selection lines / total selection lines × 100.
- Multi-bets count once per selection in the bet total, and once per grouped submission in the order total. Categories are mutually exclusive wager selections, not inferred exposure to every possible outcome.
- Five-second refresh; hidden tabs stop polling and refresh on return. No sample bets appear in the live dashboard. Empty selections show zero.
- The **Demo result picker** is a separate, local-only simulator: WinGo/TRX use one 0–9 digit, K3 uses three dice faces (1–6), and 5D uses five 0–9 digits. It does not call an API or persist results, and cannot change live rounds, wagers, settlements, or balances.

## Backend

Apply `supabase/lottery-status-admin.sql`, then deploy `supabase/functions/lottery-status/index.ts` as `lottery-status` with JWT verification disabled: this endpoint performs its own key/session authentication. The incremental `lottery-status-session-cap-fix.sql` contains the corrected access function and is already reflected in the base migration. Existing deployments received that fix separately.

The Edge Function keeps the service-role key in the server environment. Only the service role can execute `public.colorwin_lottery_status`; anon/authenticated roles cannot call that RPC or read the private configuration/session tables. The browser talks to the Edge Function with the public project key. Responses contain aggregate statistics, not player identities or individual orders. The only actions are login, status and logout. No bet, wallet, payout, schedule or result-setting operations exist in this panel.

Login is bounded to fifteen failed attempts per minute. A single private configuration row serializes verification; failures return structured errors so the attempt counter commits. At most twenty sessions are retained. Increasing the key version revokes previously issued sessions. Provision or rotate the verifier through a trusted backend/operator connection; never put the raw key in a migration or frontend file.

## Verification

- `tests/lottery-status-admin.sql`: rolled-back temporary fixtures covering all sixteen game/duration combinations, totals reconciliation, ownership-free aggregate responses, invalid key, unsupported writes, future-round rejection, logout and login throttling. No production user balances or results are modified.
- `node reference-home/check-lottery-status-percentages.cjs`: isolated browser fixture verifies 70/20/10 amount percentages and 50/30/20 bet-count percentages.
- `LOTTERY_STATUS_TEST_KEY=<key> node reference-home/check-lottery-status-live.cjs`: real gateway login, sixteen filters, past-round view, session reload/logout, write-action rejection, and 320–1366px layout checks. Supply the test key through the process environment; it is not recorded in the test source.

Current deployment was verified with the owner's key, and the test session was signed out afterward. The served frontend responds with HTTP 200 at port 5174.

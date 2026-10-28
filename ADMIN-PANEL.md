# Color Win admin panel

Open `/admin.html` on the same server as the user website. Local URL: `http://127.0.0.1:5173/admin.html`.

The panel now opens directly on an access-key form. The configured key grants owner access through a server-issued panel session. It does not require a phone number or account password. The key owner remains a registered, active owner account for server authorization and audit attribution. `/preview` remains a layout preview and cannot submit financial requests. No service-role key is shipped to the browser.

## Controls

| Section | Controls |
| --- | --- |
| Overview | Live user count, pending queues, verified deposits, paid withdrawals, wallet liabilities |
| Users | Search phone / UID / name, invitation relationship, balance, suspend / restore, nickname, audited wallet adjustments |
| Deposits | Order, user, amount, receiver, UTR, verified bank reference; approve once or reject |
| Withdrawals | Immutable beneficiary snapshot, reserve amount, processing, paid reference, reject and refund once |
| Wallet ledger | Searchable immutable transaction references and sources |
| Support | Customer details and evidence, signed attachment links, reply/status; verified bank name/IFSC correction or deactivate requested bank/UPI beneficiary |
| Feedback | Read customer feedback and mark reviewed/resolved |
| Tournaments | Create draft/open matches, fees, prize budget, capacity, schedule, rules, banners, room/password, live/completed/cancelled; cancellation refunds entry fees |
| Players & rewards | Game UID, registration, rank; publish verified results and credit rewards once within the prize pool |
| Promotion | Publish/archive campaigns, descriptions and banners; verified deposit totals feed existing referral statistics |
| Announcements | Publish, edit or hide notices visible in the account Information tab |
| Gifts | Create limited cash gifts or coupons, expiry, minimum deposit, claim count; view generated codes |
| Game controls | Enable/hide the existing catalog games |
| Settings | Receiver UPI pool, receiver name, deposit/withdrawal limits, payment availability, maintenance, support/tournament availability, promotion/Telegram |
| Admin access | Owner / finance / support / tournaments / content roles; revoke staff access |
| Audit | Actor, before/after record, action, reason and timestamp |

The direct panel key grants owner control over every section. Do not share it with staff who should have limited access. Existing authenticated staff-role RPC permissions remain scoped separately. Financial ledger writes and role assignment are checked on the server.

## Operating flows

1. A signed-in user creates a server deposit order. The receiver and amount are fixed on that order. Submitting a 12-digit UTR adds it to the admin review queue. Compare the UTR, exact amount and receiver with the bank statement; record the verified bank reference before approving. Approval credits the wallet and referral deposit totals in one transaction. Both UTR and verified bank reference are unique.
2. A user saves a server beneficiary and submits a withdrawal. The amount is immediately reserved in the ledger. Complete the external transfer yourself, then mark Paid with its real transaction reference. Processing does not transfer money. Rejection returns the reserved amount once. Existing requests retain the beneficiary snapshot even after later corrections.
3. Review appeal evidence before applying a change. Bank/IFSC corrections use the account named in the ticket. Rebind appeals deactivate that beneficiary so the customer can add a replacement. They do not silently substitute a new payout address into an existing withdrawal. Passwords are handled by the existing verified customer password-change flow, not displayed to admins.
4. Publish a Free Fire tournament as Open. Users register with game UID/name; entry fees are debited atomically and slots are protected against overbooking. Set room details and Live to expose the room only to registered players. Enter verified ranks and rewards in Players & rewards. Reward credits are final and cannot be submitted twice. PUBG remains Coming soon, as requested.
5. Promotion campaign banners appear on Home and descriptions on Promotion. Commission rates/provider gameplay are not invented: the existing catalog still contains game interface placeholders and no external game-provider or bank-payment API is configured.

The panel records manual payment decisions. UTR submission alone never credits cash, and the panel does not initiate external bank/UPI transfers. USDT withdrawals remain disabled until their actual payout integration and rates are defined.

Old browser-only demo orders and local beneficiaries are not imported as verified financial records. Users must save beneficiaries again in their signed-in account. New requests persist across devices and appear in the panel.

## Database deployment

The changes have been applied to project `lwzqbhmdfkbycdizieff`. For a fresh project with the existing account/promotion/support schema already installed, apply these files in order, as database administrator:

1. `supabase/admin-control.sql`
2. `supabase/admin-hardening.sql`
3. `supabase/admin-service-gates.sql`
4. `supabase/admin-idempotency.sql`
5. `supabase/admin-bank-reference.sql`
6. `supabase/admin-room-details.sql`

The small `admin-wallet-fix.sql` and `admin-tournament-fix.sql` files record development repairs already incorporated into `admin-control.sql`; they are not additional fresh-install steps.

To assign the first owner, replace the placeholder below with the exact registered phone after verifying the account identity. Run in the Supabase SQL editor as project administrator. Never put this query or a service-role key in frontend JavaScript.

```sql
insert into colorwin_private.admin_members(user_id,role,active)
select id,'owner',true from public.profiles where phone='REGISTERED_OWNER_PHONE'
on conflict(user_id) do update set role='owner',active=true;
```

## Validation

`npm test` runs the existing account/navigation/support/VIP/tournament tests plus DOM tests for admin authorization, verified deposit submission, failed UTR behavior, withdrawal routing and account-switch isolation. No browser screenshots are generated.

`tests/admin-services.sql` checks normal-user denial, RLS ownership, deposit approval once, withdrawal retry idempotency/reserve/refund, overdraft prevention, tournament registration/reward once and audit records. `tests/admin-support-content.sql` checks every admin section, role separation, support corrections, content/settings and suspended accounts. Both create fixtures inside a transaction and finish with ROLLBACK.

Database advisory notes for private tables with RLS and no policies are intentional: browser roles have no direct table privileges, and authorized private functions perform operations. Existing public account service functions are caller-scoped; admin endpoints use security-invoker wrappers around explicitly authorized private implementations.

## Direct access key

Apply `supabase/admin-token.sql`, then `supabase/admin-key-access.sql` after the other migrations on a fresh installation. Deploy `supabase/functions/admin-key-access/index.ts` as the `admin-key-access` Edge Function with `verify_jwt = false`: this function implements custom access-key/session authentication before allowing any admin operation. These changes are already deployed to the current project. The database gateway is callable only by the Edge Function's service role, never directly by anonymous or ordinary authenticated clients.

The current panel asks only for the access key. Supabase service credentials remain in the Edge Function environment. The key is stored only as a bcrypt hash. After verification, the server returns a separate random session capability; only its SHA-256 hash is stored in the database. The browser retains this capability in sessionStorage so that page reload works. The original access key is never saved in browser storage, URLs or audit records.

Use **Access token** in the header or **Change token & sign out** in the sign-out dialog to rotate the key. Rotation requires the current key and invalidates other panel sessions. **Sign out without changing token** revokes this session. Sessions expire after 12 hours and remain valid only while their owner account is active and unblocked. Key verification is limited to 20 attempts per minute across the panel; current-key rotation verification blocks after five failures for 15 minutes per session.

Actions are attributed to the configured key owner and include a key-session identifier in audit reasons. The shared owner key grants full owner authority; it does not distinguish multiple people using the same key. Keep it private.

The Node suite verifies the direct key form, DOM interactions, payment safeguards and logout ordering. `tests/admin-key-access.sql` verifies the service-only gateway, key validation, records/mutations, audit-reason validation, owner identity isolation, rotation, logout, expiry, hashing and throttling inside a rolled-back transaction. A live Edge Function smoke check also verified unlock, dashboard access, unauthenticated denial and logout revocation. `tests/admin-token.sql` covers the separately retained authenticated-account token RPC path.

## Simplified admin interface

The Promotion campaigns menu and editor have been removed from the panel. Previously published campaigns remain stored. The last menu item is **Admin changes history**, backed by the existing immutable change records. It shows readable action names, time in IST, reason, and a before/after comparison.

Tournament scheduling and gift expiry now use a custom calendar with separate hour, minute and AM/PM controls, quick shortcuts, and a readable IST confirmation. Values are converted from IST to UTC before submission, independent of the computer timezone. Empty and invalid calendar dates are rejected. Game/status/banner choices use readable labels.

## Player identifiers

Apply `supabase/admin-player-uids.sql` after the key-access migration on a fresh installation (already deployed here). Player, inviter and admin identifiers display as Color Win public UIDs throughout the panel; request and tournament references display readable numbers/names. Internal database UUIDs remain intact for joins and updates. Admin access is assigned by entering the registered player's Color Win UID, resolved and permission-checked on the server. `tests/admin-player-uids.sql` verifies inviter mapping and UID-based role assignment transactionally.

## Deposit submission and confirmation

UTR submission shows a success message and immediately routes the customer to Account only after the server accepts the UTR. The deposit remains pending until bank verification. Background refresh failure cannot misreport an accepted submission as failed. Admin approval credits the wallet and creates a single **Deposit successful** notification thanking the customer with the credited amount and order number. Apply `supabase/deposit-confirmation-notice.sql` after `admin-player-uids.sql` on a fresh installation (already applied here).
# Tournament templates and daily management

Tournament timing is informational: passing the scheduled time does not close registrations. Registrations stop when non-cancelled entries reach capacity, the admin chooses **Close registration**, or the match moves out of open status. **Reopen registration** allows remaining slots to fill. Closing preserves existing registrations and does not refund them; **Cancel & refund** is a separate action. Player screens refresh joined counts every five seconds while visible.

Player accounts allow one active Color Win session. A successful real login claims the server-issued session ID; a later login replaces it. Auth initialization shares one client and preserves all subscribers. Foreground clients check every second and on focus, show the standard Color Win alert when replaced, then sign out locally and redirect after five seconds. Server RPC and RLS checks deny the replaced session immediately. Existing unclaimed sessions are enrolled on their next load. Password verification clients do not claim a session. This is per login/browser session, not hardware fingerprinting; copied credentials/tokens cannot reliably identify physical hardware. Layout preview and the separate admin access-key gateway are not player login sessions.

The Tournaments screen includes ready Free Fire Solo, Duo and Squad templates with banners, formats and rules. Choose **Use this template**, update the title, entry fee, reward budget and date, then type a time such as `7:30 PM` (IST) and choose **Publish tournament**. **Save draft** keeps it unpublished.

Published matches accept registrations. At match time, choose **Start match** and enter the room ID and password; starting is a manual admin action, not an automatic timer. Use **Players & rewards** to manage verified results, and **Finish match** when play ends. **Copy as new** reuses a previous match's settings without copying its identity, schedule or room credentials. PUBG remains coming soon.

# Attendance rewards

Admin Deposit / UTR approvals and Withdrawals auto-refresh every three seconds while the panel is unlocked and visible. Polling preserves search and pagination, updates only when rows/counts change, and pauses while a review dialog or editable field is active. Focus/visibility and closing a dialog also refresh the list. Late responses are discarded after route, account, search, page or permission changes. Temporary refresh failures retain the visible records and retry on the next poll.

Transaction History is available at `#/account/transactions` from Account → Transaction. It reads every wallet ledger source via the protected `colorwin_transaction_history` RPC, in pages of 100 with a stable timestamp/ID cursor. Filters support all entries, credits, debits, individual sources and India calendar dates. Each card shows the signed transaction amount and running wallet balance after that entry. Running balances are computed before type/date filtering. There are no sample transactions for live users. Install `supabase/transaction-history.sql`; rollback SQL checks and frontend checks are in `tests/transaction-history.sql` and `tests/transaction-history.test.cjs`.

Welcome Bonus: first approved deposit must exactly match ₹300/₹500/₹1,000/₹2,000/₹5,000 for ₹28/₹58/₹88/₹108/₹288 respectively. The authoritative first deposit comes from approval-written `promotion_deposits` ordered by completion time and ID. Pending deposits and sums are excluded; later deposits never rescue a mismatch. There is no automatic bonus credit. A matched user presses Claim in the popup or Activity → Welcome Bonus. The active-session RPC atomically records a unique per-user claim and wallet ledger credit, with an advisory lock and unique reference preventing repeats. Apply `supabase/first-deposit-status.sql` then `supabase/first-deposit-claim.sql` for new installations. Already-approved matching first deposits can be claimed once as well. Rollback-only SQL tests are in `tests/first-deposit.sql`.

Attendance uses that day's total approved deposits (approval timestamp, Asia/Kolkata), not pending requests or lifetime deposits. Seven steps: ₹300→₹5; ₹1,000→₹18; ₹10,000→₹100; ₹50,000→₹200; ₹1,00,000→₹400; ₹5,00,000→₹3,000; ₹10,00,000→₹7,000. One step per calendar day, in order; missed days retain progress. Each step is claimable once; the seven-step programme does not automatically repeat. `supabase/attendance-setup.sql` installs the protected claim table and RPC. Server checks the active account/session, locks claims per user, and atomically credits the wallet ledger. Unique user/day and user/date constraints prevent duplicates. Claim history is user-specific. The final-day gift is `dist/assets/web images/colorwin-attendance-gift.png`.


# Account pages

The account menu now opens Notifications, Gifts, Coupons, Game Statistics,
Language, Feedback, Beginner’s Guide, About and Settings. Announcement opens
the Information tab. All pages use the existing Color Win neon theme.

`supabase/account-setup.sql` has been applied to the configured Supabase project.
It adds account records with owner-only read policies and server-controlled
mutations. `dist/account-pages.js` uses these RPCs for signed-in accounts.
The `/preview` route has no real session: it never redeems money, submits
feedback, changes a password or sends verification email.

## Admin operations

From a trusted server using the service role, or the SQL editor as its owner:

```sql
-- A ₹10 cash gift, one claim, valid for seven days.
select public.colorwin_create_gift(10);

-- A ₹20 coupon with a ₹100 minimum deposit, valid for seven days.
select public.colorwin_create_gift(20, 1, now() + interval '7 days', 'coupon', 100);

-- Feedback submitted by users. An admin dashboard can consume this queue.
select id, user_id, message, status, created_at
from public.account_feedback order by created_at desc;
```

The sample code in the reference is not seeded. Gift value comes only from the
private server record. Redemption locks that record, enforces expiry/claim
limits, records one claim per user and credits the wallet ledger atomically.
Coupon claims appear under Coupons without cash credit. The existing deposit
processor must record verified money in `account_wallet_ledger`; the UI does
not infer spendable funds from a payment form. Coupon consumption must also
be implemented by that trusted processor; this change provides their display.

Trusted game processors write settled records to `account_game_records`.
Statistics are aggregated by the server using Asia/Kolkata day/week/month
boundaries. No mock betting history is presented as real activity.
Withdrawal processors can write status notices to `account_notifications`.
Last-login and verified-deposit notifications use the existing profile and
`promotion_deposits` data.

## Settings and email configuration

Nicknames persist in the profile. Avatar selections persist per user in this
browser. Password changes verify the current password in a separate temporary
session before updating the signed-in user, and close only that temporary session.
Version checks show the requested up-to-date alert.

Email binding uses Supabase email-change verification. Numeric codes require
the Email Change template to include `{{ .Token }}`. The user can also confirm
an email link and return to tap Bind. A verified server response is required
before the page reports success.

Following explicit user approval, `supabase/phone-mailbox-setup.sql` has been
applied as migration `phone_login_mailbox_lookup` and the `account-phone-login`
Edge Function has been deployed. Phone login first tries the original internal
alias. If it fails, the server resolves the current mailbox and validates the
password using Supabase Auth. The browser installs only the authenticated
session; it never receives a separate mailbox lookup or any service-role key.
The lookup RPC is inaccessible to both anonymous and signed-in browser clients.
The public login endpoint authenticates credentials in its handler, so platform
JWT verification is disabled specifically for this function.

Email-provider configuration remains unverified because access to the Supabase
dashboard was denied by browser permissions. For phone aliases, the old address
is non-deliverable: enable confirmation of the NEW address only (disable Secure
email change) in the project's Email provider. Configure SMTP for user email
delivery, and put `{{ .Token }}` in the Email Change template for the code UI.
Do not disable verification of the new address. Real inbox delivery has not
been tested and must be checked after this configuration.

`tests/account-services.sql` passed after user approval. Synthetic users and
financial fixtures were rolled back; a subsequent query confirmed zero test
users remain. Cash credit, duplicate rejection, coupon behavior, wallet RLS,
feedback cooldown, nickname updates and statistics passed. Ten local auth tests
passed, including the phone-login fallback and rejection of failed credentials.
The deployed endpoint rejected invalid credentials without disclosing an email.

Security advisors report the intentional signed-in, owner-checked RPCs
([RPC advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable))
and the intentionally closed private gift table
([RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).
They also report the project's existing disabled
[leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

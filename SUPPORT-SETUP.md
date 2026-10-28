# Color Win customer service

Open Account → Customer Service (`#/support`). The supplied ZIP banner and icons are bundled in `dist/assets/support`. The pages retain the Color Win neon theme.

Implemented topics: FAQ, deposit issues, withdrawal issues, IFSC correction, bank/UPI/USDT rebind, password recovery, bank name correction, game issues and official announcements. Progress Query lists the signed-in user's latest 100 work orders, supports status filters and number search, and shows the administrator's response.

## Backend

`supabase/support-setup.sql` was applied to the connected project. `colorwin_support_submit` validates requests and returns a unique work-order number. `colorwin_support_data` returns only the caller's tickets and verified deposit records. Tickets cannot be edited by ordinary users. Requests are limited to one per minute.

Attachments use the private `cw_support_files` bucket with account-specific paths. JPG/PNG/WEBP images are limited to 10 MB and supported videos to 50 MB. Uploaded evidence is retained once a ticket is submitted. Unsubmitted uploads can be removed during error cleanup. Attachment viewing uses a two-minute signed URL, consistent with [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

## Administrator review

There is no separate admin dashboard in this project. Authorized administrators can review requests through the Supabase dashboard or a trusted server using the service role. Never add a service-role key to the browser.

```sql
select id, number, user_id, category, details, attachments, status,
       admin_reply, created_at
from public.support_tickets
order by created_at desc;
```

After reviewing a specific request, update its status and reply using its actual UUID:

```sql
update public.support_tickets
set status = 'reviewing',
    admin_reply = 'We are reviewing your request.',
    updated_at = now()
where id = '<actual-ticket-uuid>'::uuid;
```

Available statuses: `pending`, `reviewing`, `resolved`, `rejected`. Replies appear when the user reopens Progress Query. A ticket does not itself update payout details, change passwords or perform a payment; those actions must use the appropriate authorized account/payment workflow after review.

## Pending integrations and verification

- SMS verification is disabled in the connected Auth configuration. The Can Receive page shows the reference phone/OTP layout, explains this limitation and offers manual verification. It cannot send or confirm an OTP until a provider and the corresponding verification backend are configured.
- The support password option opens the existing Settings form to verify the old password and save a new password. It does not open an OTP or document-upload flow.
- Deposit history uses verified deposit records. Withdrawal history currently has no connected server ledger; users can enter an order number and submit a request manually.
- Official Channel shows Telegram, Instagram, X, YouTube and Facebook cards. Telegram reuses the project's existing channel URL and opens in a new tab. Other cards stay inactive until their official URLs are supplied in `dist/social-config.js`. Platform announcements remain available below the cards.
- Preview mode does not create fake tickets or send uploads. Sign in through the production route to submit.
- Live visual and upload API verification are pending because the saved browser permission blocks localhost. Reference inspection also ended when the reference site's login expired.

Validation: `npm test`; `node --test tests/support.test.cjs`; and the rollback-only `tests/support-services.sql`. SQL checks cover owner isolation, submission, required proofs, field validation, password-field rejection and rate limiting. Storage upload/deletion API calls require a separate signed-in integration check; direct storage-table deletion is prohibited by Supabase.

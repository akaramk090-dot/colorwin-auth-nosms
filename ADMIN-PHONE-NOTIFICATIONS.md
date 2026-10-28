# Android admin notifications

Open https://9bk0d38n-5173.inc1.devtunnels.ms/admin.html in Android Chrome and unlock the panel. Tap **Notifications → Enable phone notifications → Allow**, then **Send test notification**. Optionally install Color Win Admin using Chrome's Add to Home screen menu.

New submitted deposits (pending review) and pending withdrawals generate native notifications. Tapping one opens the corresponding admin list. A closed tab does not stop server delivery. Signing out disables notifications for that device; enabling them again reconnects it. Browser/Android notification permissions, battery settings and connectivity determine actual delivery. A new login may be required when opening an alert after the admin session expires.

The dev tunnel must continue serving the admin site. Its current target port is 5173. If the HTTPS hostname changes, update the private push configuration's origin and enable notifications again at the new origin. Never put the private signing key, worker secret or service credentials in frontend files.

## Implementation

- `admin-phone-push.js`: explicit permission/subscription controls and test message.
- `admin-push-sw.js`: native notification display and safe same-origin admin navigation; it does not cache account pages or tokens.
- `admin-key-access`: validates the owner access-key session before registering, removing or testing a device.
- `admin-push-worker`: authenticates its private webhook secret, encrypts VAPID push payloads and acknowledges delivery.
- `admin-phone-push.sql`: private configuration, devices, deduplicated events, delivery queue and request triggers. Signing keys and webhook secret have been provisioned privately in the deployed database, not included in this repository.
- Requests wake the worker after their database transaction commits. A minute-based retry task recovers transient failures; invalid/expired subscriptions are disabled. Old key versions and suspended owners do not receive delivery.

Verification covers authentication, private-key access restrictions, request deduplication, encrypted payload generation, permission consent and notification-click navigation. Physical phone delivery remains to be verified through the Test button after permission is granted.

Supabase's extension-location advisor flags this project's non-relocatable `pg_net` extension metadata in `public`; push tables remain in the private schema with direct client access revoked. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).

[Push API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)

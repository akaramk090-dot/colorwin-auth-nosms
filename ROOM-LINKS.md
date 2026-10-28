Admin → Tournaments → Edit settings → Room details & match rules → Room invite link (HTTPS). Paste the actual invite copied from Free Fire, save, then Start match. Link-only rooms are supported; Room ID/password remain optional fallback details.

Registered players see Join room on match details. It enables when the match becomes live, including through the existing five-second status refresh. Clicking retrieves the private room link after a fresh server authorization check, then opens that exact HTTPS link in the same tab so Garena can hand it to the installed game. Actual game entry depends on the invite being valid and the phone/game handling Garena's link.

Links stay in the private tournament_rooms table and are never included in public tournament lists. Unregistered/cancelled players and non-live matches cannot retrieve room access. Copy as new clears the prior room link and credentials.

Migration: supabase/tournament-room-links.sql. Server checks: tests/tournament-room-links.sql (rollback). UI checks: tests/admin-ui.test.cjs and tests/tournaments.test.cjs.

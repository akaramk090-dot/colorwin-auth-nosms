# ColorWin Aviator

The local Aviator page is a ColorWin crash-game implementation based on the user-provided screen recording. It is not connected to SPRIBE. The existing wallet RPC is retained.

## Runtime

- `dist/games/aviator.html`, `aviator.css`, `aviator.js`: interface and animation.
- `dist/games/arcade-client.js`: authenticated parent RPC bridge and HTTP-compatible cryptographic request IDs.
- `dist/games/aviator-audio.js`: independent effects/music controls, first-gesture audio unlock, and music ducking during effects.
- `dist/games/aviator-audio/reference-audio.json`: provenance and trim times for reference recording audio. The recording contains a mixed music/effects track, not isolated studio stems. It has no wager-loss example, so loss uses the fly-away sample.

## Server

`public.colorwin_arcade` dispatches to the private shared Aviator implementation. The shared flight has one ID, start time, immutable crash result and per-flight growth rate. Newly generated flights use 0.06 exponential growth to match the reference pace; older active flights retain 0.18. Never change an active flight to change its result or duration.

`colorwin-aviator-shared-tick` runs every five seconds, maintains the shared timeline and settles pending users, including offline users. Private tables and future crash data remain inaccessible to players. Snapshots include finished round history and masked public live/Top bet rows. Only the requesting player's own bet details are returned in `round.bets`.

Next-round queue is an explicit in-page intent. No wallet deduction happens until the next betting phase accepts the server request. It is cancelled when this game page is closed. Server request IDs prevent duplicate debits.

The canonical schema changes were applied in this order:
1. `supabase/aviator-shared-rounds.sql`
2. `supabase/aviator-shared-history-fix.sql`
3. `supabase/aviator-reference-experience.sql`
These are migration records, not a startup script; do not rerun them blindly.

## Checks

- `tests/aviator-shared-rounds.sql`: rollback-only synthetic-player tests for shared timing, private bets, duplicate protection, refunds, auto settlement, masked live data and per-flight growth.
- `reference-home/check-aviator-flight.cjs`: browser flow test with an isolated mock wallet.
- `reference-home/check-aviator-shared-audio.cjs`: reference layout, history grid, independently controlled audio, queue, win/loss details and media decoding.
- User recording and analysis frames remain local and are excluded from Git.

Flight polish: apply `supabase/aviator-five-second-pause.sql` after the reference-experience migration. Finished rounds remain visible for five seconds, followed by a ten-second betting countdown. Existing flight times and wallet results are preserved. Motion uses continuous server time and animation frames independently of the displayed rounded coefficient. Verify with `node reference-home/check-aviator-smooth-motion.cjs`.

Presentation: the opening progress lasts at least ten seconds and waits for initial data. Between rounds, the supplied PNG has a native shrinking bar tied to the shared ten-second waiting deadline, with no numeric seconds label. The outer Aviator catalog header is omitted; the internal Aviator home control remains. The supplied SVG is inline so only its propeller group animates, respecting the Animation switch. Verify with `node reference-home/check-aviator-live-bar.cjs`.

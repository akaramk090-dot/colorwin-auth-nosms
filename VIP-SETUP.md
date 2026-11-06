# Color Win VIP page

Account → VIP opens `#/vip`. The page recreates the inspected reference structure with Color Win neon styling, ten horizontally swipable level cards, previous/next controls, tier selectors, experience progress, selected-level benefits, and History/Rules tabs. View All opens `#/vip/history`. Existing shared SVG back navigation applies.

The reference was inspected through the browser on 5 October 2026. All ten experience thresholds, level-up rewards, monthly rewards and rebate rates were read from rendered tier cards. No reference account name, experience, private history or account identity was copied into this project. Existing project crown assets provide the visuals.

The settlement countdown uses Asia/Kolkata calendar dates; the reference schedule is 2:00 AM IST on the first day of each month.

## VIP experience and rewards

Apply `supabase/vip-rewards.sql` after `supabase/account-setup.sql` and the game wallet setup scripts. Every successful, server-recorded wager inserts one `account_game_records` row; a database trigger credits its stake as VIP experience (₹1 = 1 EXP). Failed/rejected wagers do not earn EXP because their database transaction does not commit. Existing recorded stakes are backfilled once during setup.

`public.colorwin_vip_data()` returns the signed-in user's experience, claimed levels and reward history. `public.colorwin_vip_claim(level)` checks the experience threshold on the server, permits one claim per level, and writes the claim and wallet ledger entry in the same transaction. The browser never supplies an experience amount or reward amount. Level-up rewards use the amounts shown in the VIP tier list; monthly rewards are informational and are not claimable in this feature.

Preview accounts remain isolated and cannot claim real wallet rewards. The backend uses private tables with RLS enabled and no client table grants; only authenticated users may execute the two public RPCs.

Verification: run `tests/vip-rewards.sql` in a transaction-capable Supabase SQL session; its synthetic accounts, wagers and wallet entries are rolled back. Run `node --test tests/vip.test.cjs` for VIP UI tests.

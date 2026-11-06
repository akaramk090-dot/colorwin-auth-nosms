# Promotion: TashanWin APK reference

## Source and evidence

User supplied `C:/Users/salman/Downloads/Telegram Desktop/tashanwin.apk`, SHA-256 `e3b1a2121a3de911a901f67bbbd6ea45ebe99c215b8f84ff0fff7908bcfacc30`.

REA opened the APK and inventoried 4,486 archive files: inventory summary `ev_164b20b7b527aa3cfbc33461f9a1daa6fbbdd034f24266b51ae6c3a719c1328a`, complete inspection parent `ev_1b791a14c65f76ee511cfad53c51610c7872e80196f1a2d89410a891995c9b7e`. Full REA extraction correctly refused Windows case collisions (`res/9n.9.png` versus `res/9N.9.png`). Only the non-colliding public HTML/JS/CSS/JSON/SVG subset was then extracted with path validation to a fresh temporary directory. APK/native code was not installed or executed.

Focused REA JavaScript analyses: parent `ev_633a34ef4af1a1986097eea5f00c6ddbad3935ad343be5d8f06830f91c1924d4` for Subordinate/RebateRatio/CommissionDetail/root loader; parent `ev_8c55f0a6c257cca235f1d14aecd765a38f1cf00075ea801cb8f7f0bc2f15e19e` for TeamReport and the promotion overview. Analyses are partial outside the selected modules and do not establish original runtime/server behavior. Complete session evidence was exported to `C:/Users/salman/AppData/Local/Temp/colorwin-tashan-promo-uapf6l7w/rea-promotion-evidence.json`; REA session closed.

Observed module mappings:

| Feature | Packaged module | Observed contract |
|---|---|---|
| Subordinate data | `page-promotion-TeamReport-d0abbfe0.js` | UID search, All/Tier 1–6, selected day, six activity metrics, UID copy, level/deposit/bet/commission/time cards |
| New subordinates | `page-promotion-Subordinate-1a2f4e7b.js` | Today/Yesterday/This month registration list |
| Rebate ratio | `page-promotion-RebateRatio-d6c6cb6f.js` | Lottery/live/sports/chess/slots tabs; lower-level percentage rows |
| Promotion overview | `page-promotion-index.vue_vue_type_script_setup_true_lang.ts-1142229f.js` | Direct/team header icons; menu icons; commission and invitation metrics |
| Rebate source | `page-activity-ActivityDetail-4954cf73.js` exports `xM as cK` | RebateRatio requests `PromotionTutorial`; response fields `rebateratelist`, `dianzilist`, `shixunlist`, `tiyulist`, `chesslist`; nested `rebate_Lv`, `rebateLevels[].levelId/amount` |

No numeric rebate matrix was recovered from the selected static modules. The user explicitly agreed to supply rates later and requested SVG/UI work first. Old placeholder lottery percentages were removed. Pending rows show dashes. No rates, commission crediting, settlement schedule or wallet operation was invented or activated.

## Implementation

19 actual APK SVG geometries are imported under `dist/assets/promotion-icons/apk-*.svg`, with ColorWin palette substitutions only. `reference-home/tashan-promotion-assets.json` records source filenames/hashes and outputs. Nested CSS variables were resolved; browser CSS validation checks every fill/stroke. These SVG files do not retain network links or executable handlers.

`promotion-report.js` handles subordinate data and rebate presentation; other existing subpage functions remain available. `promotion-report.css` adapts their surfaces/spacing to ColorWin purple. Main promotion icons and metrics retain the existing application routes. Rebate categories use APK SVGs, with connected lower-level markers. The verified seven-level rate matrix is rendered consistently for every rebate category. This presentation does not independently credit wallets or settle commission payouts.

## Authenticated daily data

Applied migrations `promotion_daily_subordinate_report` and `promotion_report_historical_membership`; reproducible SQL in `supabase/promotion-daily-report.sql`.

Public RPC `colorwin_promotion_report(p_day,p_tier,p_uid,p_page)` delegates to an authenticated, session-checked private implementation. It accepts no owner ID and follows only the caller's invitation tree, capped at six levels with cycle protection. Returned rows contain public UID, level, registration time and selected-day aggregates; no phone, internal UUID, wallet credentials or raw bets.

Activity uses half-open India-time day boundaries. Deposits are verified records in `promotion_deposits`. First deposits use the earliest lifetime verified deposit and count it only on its actual day. Accepted WinGo, K3, 5D, TRX, Aviator/Limbo and Mines wagers are included; cancelled arcade bets excluded. Number of bettors is distinct members with wagers, not selection count. Summaries cover the entire filtered team; rows page 20 at a time. Members registered after the selected day are excluded. Selecting a date never substitutes lifetime amounts for daily data.

RPC is read-only, with no balance changes or result/settlement calls. Commission is null until verified rules are configured. The browser guards stale filter responses and supports loading/error/retry/empty states, pagination and copy UID. Filtering does not require fetching the entire lifetime promotion payload first.

## Validation

- `tests/promotion-daily-report.sql`: live-database transaction rolled back. Synthetic seven-tier network plus unrelated user, IST boundaries, all supported wager sources, cancelled wager exclusion, true first-deposit day, distinct bettors, UID/tier filtering, pagination, anonymous denial, no foreign team access, no wallet writes.
- `node reference-home/check-promotion-apk.cjs`: isolated browser fixtures, not real member balances. Actual SVG fills/strokes validated, summaries/pagination, tier search, numeric validation, date cancel, error/retry, stale-response ordering, all promotion subpages at 320/390/430/768px, no horizontal overflow, no broken images/page errors.
- 13 existing auth/account-auth/navigation tests passed serially. The broader pre-existing welcome-popup test process exhausted memory; welcome-popup implementation was not modified.
- Security advisors checked after migration: no new table or RLS policy added. Existing private-schema RLS-without-policy informational findings and existing platform advisories remain outside this change.

Screenshots `reference-home/promotion-apk-{main,subordinates,rebate}.png` use synthetic browser fixtures solely for layout QA; they are not screenshots of real user data or original APK runtime screens.

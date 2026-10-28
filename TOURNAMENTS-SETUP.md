# Tournaments UI

The middle navigation button is now Tournaments, using the generated transparent PNG at dist/assets/tournaments/characters.png. The same character duo appears in the esports hero. New native JS/CSS modules are dist/tournaments.js and tournaments.css.

Routes: #/tournaments, #/tournaments/my-matches and four event detail routes. All/Free Fire/PUBG filters and Upcoming/Live/Completed tabs work. Match previews include game, team format, entry/prize placeholders, room availability information and registration-coming-soon controls. No fees, prize guarantees, real schedules, registrations or results are invented. My Matches has an empty state. Real-user tournament logic, administration, payment, room distribution and result processing will be defined separately, as requested.

Turntable frontend modules, assets and tests were removed. Legacy reward URLs redirect to #/tournaments. Its Supabase functions were disabled by retire_turntable_rewards; authenticated and anonymous callers cannot use the old reward API. Historical wheel tables and existing wallet credits are retained as financial audit records. The old setup SQL and SQL rollback tests remain historical source; do not reapply them to re-enable rewards. Retire script: supabase/retire-turntable.sql.

Validation: JS syntax, filter/routing/assets and registration-gating tests, plus Supabase privilege checks. Local visual verification remains blocked by the saved browser permission.

Tournament polish: fixed header with safe-area spacing on every tournament route, wallet shortcut loading the existing account balance, and guarded asynchronous updates after account changes. Unknown balances stay ₹—. Removed the broad button font shorthand that overrode footer sizes. Hero artwork now uses contain sizing without negative crop, and the shared centre character icon has revised size/position. Cards, spacing and controls use the same responsive phone container. Validation: 26 unit checks, 21 application script syntax checks, no missing entry JS/CSS assets. Live browser visual inspection is still blocked by the saved localhost permission.

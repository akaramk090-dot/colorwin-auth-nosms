Withdrawals accept integer multiples of ₹100 within the configured minimum/maximum. All rounds down to the largest allowed ₹100 multiple. Client validation improves feedback; the private wallet RPC enforces both rules independently.

Every positive wallet ledger credit adds 1× turnover, except withdrawal_refund and tournament_refund, which return existing funds. Trusted account_game_records.bet values reduce the outstanding requirement chronologically, with a floor of zero after each bet. Excess historical betting cannot cover future credits. Same-timestamp credits precede bets. Successful paid tournament entry fees count as bets, including existing registrations. Entries with a matching tournament refund are excluded; free registrations do not reduce need. Applied by supabase/withdrawal-tournament-bets.sql; verified by tests/withdrawal-tournament-bets.sql.

The wallet load response includes betting_need. Missing live requirement fails closed. Need must equal zero before a new withdrawal request can reserve money. Existing request IDs remain idempotent. Credits and game-record mutations share the withdrawal advisory lock to serialize the eligibility check and money reservation.

The game provider/backend must persist authentic bet records in account_game_records. Players have SELECT only and cannot report their own turnover. This change does not create a provider settlement integration. Without recorded bets the requirement stays outstanding.

Migration: supabase/withdrawal-turnover.sql. Regression fixtures: tests/withdrawal-turnover.sql (rollback only) and tests/withdrawal.test.cjs.

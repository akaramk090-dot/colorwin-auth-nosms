# Color Win VIP page

Account → VIP opens `#/vip`. The page recreates the inspected reference structure with Color Win neon styling, ten horizontally swipable level cards, previous/next controls, tier selectors, experience progress, selected-level benefits, and History/Rules tabs. View All opens `#/vip/history`. Existing shared SVG back navigation applies.

The reference was inspected through the browser on 5 October 2026. All ten experience thresholds, level-up rewards, monthly rewards and rebate rates were read from rendered tier cards. No reference account name, experience, private history or account identity was copied into this project. Existing project crown assets provide the visuals.

The settlement countdown uses Asia/Kolkata calendar dates; the reference schedule is 2:00 AM IST on the first day of each month.

## Data integration

This implementation is the VIP UI and programme preview. It does not implement a verified betting ledger, level maintenance, downgrade jobs, rebate accounting, monthly settlement or reward claims. Preview mode shows zero experience. Live accounts show unavailable experience rather than inventing account progress; the programme preview note explains that claiming is pending launch.

When the trusted VIP backend is ready, supply `window.ColorWinVIPProvider.load()` to return the authenticated user's `{experience, history}`. History records have `title`, `amount`, `created_at`. Any claim implementation must validate eligibility and duplicates on the server and credit the wallet atomically; it must not trust the displayed tier or experience from the browser.

Validation: syntax checks, VIP route/assets/escaping tests and the existing regression suite. Live visual verification remains pending the saved localhost browser permission.

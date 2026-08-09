# Life Hub — Improvement Spec (for Kiro)

**Scope:** `kaiiamar/Life-Hub` (PWA frontend) + `kaiiamar/lifehub-notifications` (Vercel backend / Telegram bot).
**Goal:** Make Life Hub the daily go-to. Fix guilt-triggering UI, cut notification noise, refresh the visual design, and add a small number of proactivity features. Zero guilt UI is non-negotiable throughout: no red warnings, no "missed/overdue" framing, no streak-loss pressure. Re-entry after a gap must cost nothing.

**Priority key:** 🔴 P1 do first · 🟠 P2 high value · 🟢 P3 when convenient

---

## Part 0 — Ops fixes (do these BEFORE any code changes)

These are deploy/config issues, not code. They explain most of the current bad Telegram experience.

### 0.1 🔴 Wipe stale QStash schedules
The live bot is sending messages at times (09:00, 11:00, 14:00) and with copy ("Boom…", "Quick AM check", duplicate water prompts) that **do not exist in the current codebase**. `schedule.js` defines 8:00 / 8:05 / 12:30 / 15:00 / 17:00 / 22:00 + Sunday jobs. Conclusion: QStash still holds schedules registered by an older deploy, firing old endpoints/payloads alongside the new ones.

**Action:** `POST /api/telegram/schedule?secret=<TELEGRAM_SETUP_SECRET>` on the current deployment. The handler deletes every schedule whose body has `__telegram: true` and recreates the current set. Then check the Upstash QStash console for any leftover schedules *without* the `__telegram` marker (registered before that marker existed) and delete them manually.

### 0.2 🔴 Verify Firestore rules are deployed with the real UID
`firestore.rules` in the repo still contains `REPLACE_WITH_KAI_UID`. If the deployed rules are the temporary "any signed-in user" bootstrap rule, any account created in the Firebase project could read/write the `users/kai` doc. Confirm the deployed rules use the real UID; if not, publish the locked version.

### 0.3 🟠 Fix notification icon path bug
`sw.js` references `/Life-Hub/icon-192.png` (three places) but the repo file is `icon-192.jpg`. Push notifications currently render with a broken/default icon. Either rename the asset to `.png` or fix the paths in `sw.js` (and check `manifest.json` matches).

---

## Part 1 — `lifehub-notifications`: tone + noise fixes

### 1.1 🔴 Rewrite the hype reply pools in `api/telegram/webhook.js`
The scheduled prompts are tone-compliant, but the **interactive reply pools** (`REPLIES`, ~line 62) bypass `TONE_RULES`/`sanitizeGuilt` and contain exactly the hollow hype that undermines trust. Rewrite to calm, specific, fact-first phrasing. Keep the pool structure (variety is good), change the copy:

- `habitTicked`: remove `'Boom. {h} is yours.'` and `'{h} ✓ — keep going.'`. Replace with neutral confirmations, e.g. `'{h} ✓'`, `'{h} logged.'`, `'Done — {h}.'`
- `moodLogged[5]`: remove `'Yes! Glow day {e} 🎉'`, `'{e} — riding high. Logged.'`, `'Top-tier energy. {e} ✓'`. Replace with e.g. `'{e} logged — good day.'`, `'{e} ✓'`
- `moodLogged[1]` and `[2]`: keep gentle, but drop anything that presumes ("Hope it lifts" is fine; keep these mostly as-is).
- `sleepLogged`: `'Got {n}h. Hope it was decent.'` reads flat/judgey when n is low. Replace pool with facts + optional context, e.g. `'{n}h logged.'`, `'Sleep: {n}h ✓'`. **Add one state-aware variant:** if a training session is scheduled today and n < 6, append a *supportive adjustment*, not a judgement: `'Lighter session is a fine call on {n}h if you need it.'`
- `waterGoalHit`: `'…smashed your water goal'` / `'beautiful'` → tone down: `'Water goal hit ✓ — {ml}ml today.'`

### 1.2 🔴 Neutralise `streakSuffix()` (`webhook.js` ~line 28)
`'🔥 X days showing up — keep it rolling.'` creates loss-aversion pressure (the thing that makes you avoid the bot when a streak is at risk). Change to a pure positive statement with no continuation demand: `'X days showing up.'` — or remove the suffix entirely. Never mention the streak on a day it would read as "don't break it".

### 1.3 🔴 Make ALL water prompt variants progress-aware (`api/telegram/prompt.js`, `sendWaterPrompt`)
The 4-variant `greetings` pool includes `'💧 {remaining}ml left to hit goal. Add what you've drunk:'` — the exact "nagging without acknowledging what I logged" phrasing from the live bot, and `'Hydration nudge. Where are you at?'` which contains no state at all. Rule: **every variant must state current progress first, remaining second.** e.g.:
- `'💧 {currentMl}ml so far — {remaining}ml to go.'`
- `'💧 You're at {pct}%. {remaining}ml left.'`

Additionally: skip the send entirely if water was logged within the last 2 hours (store a `lastWaterLogAt` timestamp when the webhook handles `water:*` callbacks, check it here). Responding to a log with another prompt is the definition of nagging.

### 1.4 🟠 Consolidate the 8:00 + 8:05 double ping
`morning` (8:00) and `plan-day` (8:05) are two pings five minutes apart. Merge: fold the plan-day content (pick 1–3 focus tasks buttons) into `composeMorning` in `_messages.js` as an extra button row / line, delete the `plan-day` schedule from `SCHEDULES`. One morning message, everything in it.

### 1.5 🟠 Gate the 15:00 water prompt on actual need
Currently it only skips when the goal is fully hit. Change: skip if ≥ ~50% of target by 15:00 (on pace). Only nudge when genuinely behind pace — and per 1.3, phrase it as progress, never deficit.

**Resulting daily message budget:** morning (consolidated), midday, water (conditional), rut-check (conditional, only after 2+ quiet days), evening (conditional, skips if all done). Max ~4/day, typical 2–3. That's the right volume.

### 1.6 🟢 Add an "Open Today view" deep-link button
Add a URL button `{ text: '📋 Open Today', url: '<app URL>' }` as the last row on the morning message and the weekly digest. Bridges the "I don't think to open the app" gap — the bot becomes the doorway, not a replacement.

### 1.7 🟢 Weekly digest: guard the "one to nudge" line
`composeWeeklyDigest` includes `'One to nudge next week: <weakest habit (42%)>.'` The percentage makes it a score, and a score under ~50% reads as a grade. Keep the nudge but drop the percentage from the copy (strip the `(\d+%)` before composing, as the focus line already does).

---

## Part 2 — `Life-Hub`: zero-guilt UI enforcement 🔴

The app currently violates its own core principle in five places. All are small, targeted edits.

### 2.1 Dashboard streak — remove loss-pressure copy
`js/dashboard.js` line ~66: the hero streak appends `' · keep it alive today'` when today has no activity yet. Delete that conditional suffix. The streak may celebrate; it may never threaten.

### 2.2 Task lists — retire the red "⚠️ Overdue" section
`js/dashboard.js` ~1096–1097 renders `task-overdue-section` with a red label and ⚠️. Rename the section to **"Carried over"** with a neutral icon (e.g. ↪) and default text colour. `style-new.css` line 4063 (`.task-overdue-section .task-section-label{color:var(--red)}`) → change to `var(--text2)`.

### 2.3 Due-date pills — neutralise the `overdue` state
`style-new.css` line 4106: `.task-due.overdue` uses red background/text. Restyle to the neutral pill (same as default `task-due`), and change the label produced in `dashboard.js` (~434, ~1146–1149) and `planner.js` (`plannerFixedTasksCard`) from a red "overdue" state to plain relative wording, e.g. `'from Tue'` instead of a red `'2d overdue'`. `fmtDueRel` can gain a past-date branch that phrases without deficit.

### 2.4 Goals — replace "Overdue" badge and red countdown
`js/dashboard.js` ~253 (Up-next banner) and ~257–272: red border, ⚠️, `'X days overdue'`, `badge-risk "Overdue"`. Replace with neutral: badge text **"Past target date"** in the standard badge style; countdown text `'target was <date>'` in `--text3`; border stays `--gold`. A goal past its date is information, not an alarm.

### 2.5 Habit period tooltips — "missed" → neutral
`js/habits.js` line ~243: tooltip says `'— missed'` for unfilled periods. Change to `'— not logged'`. Same file ~199–204: streak badges are fine (positive-only) — keep.

### 2.6 🟢 Roadmap tab red dot
`style-new.css` ~834–835: `.rm-tab-btn.overdue` shows a red notification dot. Change `background:var(--red)` to `var(--gold)` or remove.

**Acceptance test for this whole part:** open the app after 5 days away → nothing red, nothing that says missed/overdue/behind, no streak loss framing. The Today tab shows a fresh today only.

---

## Part 3 — Today view & proactivity upgrades

The planner architecture is already right (Today default tab, 3-focus cap, inbox, quick capture, Week tab). These changes make it the reason to open the app.

### 3.1 🟠 Reorder the Today tab for "check habits & workouts first"
Kai's stated first actions when opening the app are checking habits and workouts. Current render order in `renderPlannerToday()` (`js/planner.js`): welcome → glance → focus → inbox → capture → water → habits. Change to: **welcome → training line (promoted, see 3.2) → habits → focus → glance → capture → water → inbox**. Habits and training above the fold; inbox last (it's the least "today" thing).

### 3.2 🟠 Promote today's training to its own card
`plannerTrainingLine()` currently renders one small line *inside* the glance card. Make it a standalone card directly under the welcome row: session name, exercise count or run description, plus **one-tap log buttons** reusing the existing `quickLogToday('Gym'|'Hyrox'|'Run'|'Rest')` and `openModal('logRun')` handlers from the Training page. Done state: if a workout is already logged today, the card shows `'<session> ✓ logged'` instead of buttons.

### 3.3 🟠 One-tap weight log on Today
Add a compact row/button on the Today tab (near water) opening `openModal('logMetric','weight')`. Weight logging is a daily recomp habit; it should never require navigating to Training → Body.

### 3.4 🟢 "Plan next week" flow on the Week tab
On the Week tab, when viewing the current week on/after Saturday, show a small **"Set up next week"** action that: (a) prompts for next week's intention, (b) lists this week's unfinished `weekPriority` tasks with checkboxes to carry forward (sets their `weekPriority` to next week's key — never labelled as failures, just "bring these along"). Pairs with the existing Sunday 9:00 `plan-week` Telegram prompt.

### 3.5 🟢 PWA app-icon badge for focus tasks
Use the Badging API where supported (`navigator.setAppBadge(n)`) with n = today's incomplete focus tasks; clear when zero. A quiet, ambient reminder that costs no notification.

### 3.6 🟢 Offline-first service worker
`sw.js` is network-first with no precache — the PWA won't open offline, which breaks trust in it as a go-to. Add an install-time precache of the app shell (`index.html`, `style-new.css`, all `js/*.js`, icons) with a versioned cache name (bump per deploy), serve cache-first for same-origin shell assets, network-first for everything else. This also removes the need for manual `?v=10` query-string cache busting on script tags (keep or drop those; the versioned cache supersedes them).

---

## Part 4 — Design refresh

### 4.1 Why it feels boring (diagnosis)
The current look — warm cream `#F8F5F1` base + terracotta `#D97B6C` accent + serif display (Fraunces) + glass cards — is currently the single most common "AI-generated app" aesthetic. It's pleasant but anonymous; every card is the same white rounded rectangle at the same elevation, and the giphy GIF headers fight the palette. The fix is not more decoration — it's a distinctive point of view plus stronger hierarchy.

### 4.2 Direction: **"Field Ledger"** — an athlete's data journal
Kai is a data analyst who trains. The identity should come from that: precise numbers, honest tracking, warmth without fluff. Think a beautiful training logbook, not a SaaS dashboard.

**Design tokens (replace in `:root` of `style-new.css`):**

```css
/* Palette — Field Ledger */
--bg:        #F6F3EC;   /* warm paper, slightly cooler than current */
--ink:       #1F241F;   /* near-black with a green undertone — replaces #1A1A1F */
--moss:      #3F5A44;   /* primary accent: deep field green (nav, primary buttons, rings) */
--moss-dim:  rgba(63,90,68,0.10);
--amber:     #C98A2D;   /* secondary accent: ochre — highlights, gold moments */
--clay:      #B0563C;   /* small doses only: heat/energy (training), never warnings */
--sky:       #6E93AE;   /* cool data accent: charts, water */
--paper2:    #EFEAE0;   /* recessed surfaces */
--card:      #FFFFFF;
/* Dark mode (night-mode class): */
--bg-dark:   #14170F;   /* deep olive-black, not grey */
--card-dark: #1D211A;
```

**Typography:**
- Display: keep **Fraunces** but use it *bigger and less often* — page titles and hero numbers only, `opsz` high, weight 550–600, tight letter-spacing. Everything else loses the serif.
- Body/UI: keep **DM Sans**.
- **New: a mono for numbers.** Add `'Spline Sans Mono'` (Google Fonts) as `--mono`, and use it for every metric: weights, ml, £, streak counts, times, chart axes. This one change gives the whole app its "data journal" character and makes numbers scan instantly.

**Signature element — data-inked numbers:** every key stat gets a tiny inline visualization in `--moss`/`--sky`: a 7-day sparkline under the weight number, a thin progress ring around habit checkmarks, a fill-bar under the water figure. The app's identity becomes "my numbers, alive" rather than "cards with emojis". (Chart.js is already loaded; sparklines can be tiny inline SVGs — cheaper than canvas per-stat.)

### 4.3 Component-level changes
1. **Kill the giphy GIF page headers** (7 instances in `index.html`: Goals, Habits, Finance, Relationships, Gratitude, Lists, Insights). They load third-party content (broken offline, inconsistent tone). Replace each with a 100×100 rounded tile: `--paper2` background, the page's emoji at 44px, and a 2px `--moss` left rule. Consistent, instant, offline.
2. **Card hierarchy in 3 tiers** instead of one: hero cards (Today training/habits — `--card`, shadow-md, 1px moss top rule), standard cards (shadow-sm), and quiet cards (inbox, archives — `--paper2`, no shadow). Elevation should encode importance.
3. **Hero blobs → texture.** Replace the pastel gradient blobs with a very subtle paper-grain noise on `body` (tiny tiled SVG/base64 PNG at 2–3% opacity) and one restrained `--moss`→transparent radial in the hero. Calmer, more distinctive.
4. **Checkmark micro-interaction:** habit/focus ticks get a ~180ms spring scale + moss ink fill (respect `prefers-reduced-motion`). One good interaction beats ambient animation everywhere.
5. **Dark mode:** re-derive from the olive-black tokens above rather than inverting greys; keep `--amber` as the accent that pops at night.
6. **Buttons:** primary = solid `--moss` white text; the terracotta gradient buttons go. `--clay` survives only as the training/energy accent (e.g. Hyrox chip).

### 4.4 Rollout order
Tokens + fonts first (one commit, whole app shifts), then GIF headers, then card tiers, then signature sparklines/rings, then micro-interactions. Each step ships independently.

---

## Part 5 — Housekeeping 🟢

1. **Delete `style.css`** — `index.html` only links `style-new.css`; the old file (423 lines) is dead weight and will confuse Kiro edits.
2. **`relationships.js` is 28 lines** — likely vestigial; confirm relationship rendering lives in `dashboard.js` and either fold it in or leave a header comment saying so.
3. **Lazy-load Chart.js** — it's loaded on every boot but only used on Insights/Training/Finance charts. Inject the script on first nav to a chart page. Meaningful on mobile data.
4. **`api/cron/send-notifications.js` + web-push path** — if the Telegram bot is now the notification channel and web push is unused, consider removing the VAPID/subscribe/cron path (or clearly mark it dormant) to shrink the surface area.
5. **`describePlanner` / recurring commitments parity** — backend `_planner.js` `todayCommitments()` matches only exact-date commitments; the frontend also matches weekly-recurring ones. Align the backend so bot summaries of "today" include recurring commitments.

---

## Part 6 — Open questions for Kai

1. **Firestore rules** — is the deployed ruleset UID-locked (0.2), or still on the bootstrap rule?
2. **Design direction** — happy with "Field Ledger" (moss/ochre/mono-numbers), or want a second option to compare before Kiro starts on Part 4? Parts 0–3 are direction-independent and can start immediately.
3. **Web push** — keep as a second channel or retire in favour of Telegram-only (Part 5.4)?
4. **Weekly digest timing** — Sunday 18:00 for reflection + Sunday 09:00 for planning: keep both, or merge into one Sunday-morning "close last week, open this week" message?

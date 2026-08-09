# Handoff: Life Hub — Mobile Today / This Week / Inbox

## Overview
An interactive mobile view for Kai's Life Hub personal-productivity PWA. Three tabs — **Today**, **This week**, **Inbox** — with tappable habits & focus items, a live water counter, quick-capture that files notes into the Inbox, and confetti/toast celebration moments. This is the **mobile** experience; the production app is a desktop PWA with a 230px sidebar, so screens must be re-laid-out for that shell (see "Responsive / shell" below).

## About the Design Files
The file in this bundle (`Life Hub Planner.dc.html`) is a **design reference created in HTML** — a prototype showing intended look and behavior, **not production code to copy directly**. It uses a custom component runtime (`support.js`) and an iOS device frame purely for previewing. The task is to **recreate this design inside the existing `kaiiamar/Life-Hub` codebase** using its established patterns (vanilla JS + CSS custom properties + localStorage, per the current app), not to ship the HTML.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions. Recreate the UI faithfully using the app's existing CSS variables and DOM patterns. Every hex value, font, and measurement below is exact.

## Design system alignment
The app already defines the tokens this design uses in its `style.css` (`--accent`, `--bg`, `--bg2`, etc.). Prefer the existing CSS variables over the literal hex values wherever they match. Literal hexes are listed so nothing is ambiguous. Fonts: **Lora** (serif headings, numbers, quotes — italic for quotes), **Source Sans 3** (UI/body), **Caveat** (handwritten accents: greeting, "just 3 things", capture placeholder). All three load from Google Fonts.

---

## Screens / Views

### Shared chrome (all tabs)
- **Top bar**: 🤎 + "Life Hub" (Lora 19px/600, letter-spacing -0.01em) on the left; "Mon 20 Jul" (12px/500, `#8a6545`) + an 8px green online dot (`#6b9e7a`, with `box-shadow:0 0 0 3px rgba(107,158,122,0.18)`) on the right.
- **Tab switcher**: pill container `background:#f2e8d8; border:1px solid rgba(160,110,60,0.15); border-radius:999px; padding:4px`. Three equal tabs. Active tab: `background:#c97b6e; color:#fffdf9; box-shadow:0 2px 6px rgba(201,123,110,0.35)`. Inactive: `color:#8a6545`. Font 13px/600. Transition `all 0.15s`.
- **Page background**: `#f7f0e8` with a subtle SVG fractal-noise overlay (140px tile, opacity 0.4) for a paper texture. Page padding `58px 15px 40px` (top accounts for the device status bar in the mock — use your app's real safe-area inset).
- Tab-switch animation: content wrapper plays `fadeIn` — `@keyframes { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`, 0.28s ease.

### Today
Purpose: the daily home — greeting, training, habits, schedule, focus, water/weight, capture.
Cards stack vertically, 14px gap, each `border-radius:16px`, `background:#fffdf9`, `border:1px solid rgba(160,110,60,0.15)`, `box-shadow:0 2px 12px rgba(160,82,45,0.06)`, padding ~16–20px.

1. **Welcome masthead** — a "washi-tape" span pinned top-left (78×21px, `rgba(155,123,138,0.4)`, rotated -4deg). Greeting "Good morning, {name} ✨" in Caveat 34px/600 `#6b3a1f`. Subtitle Lora italic 14px `#8a6545`. Three status chips (streak 🔥, training day 🏋️, focus 🎯) — pill chips, 12px/600, tinted backgrounds per category. Divider then a Lora-italic quote `#6b3a1f`.
2. **Today's training** — gradient card `linear-gradient(140deg,#fdeee4,#fbe2d1)`, border `rgba(212,132,90,0.28)`. Giant faded 🏋️ watermark top-right. Title bar with a 4px `#d4845a` accent tick + "Today's training" (Lora 16px `#b0563c`) and a "Training day" uppercase badge. 💪 + "Upper body" / "6 exercises · then easy run 20 min". Three buttons: **Log gym 💪** (primary `#b0563c` → turns `#6b9e7a` "Logged ✓" once tapped), Run, Rest (ghost).
3. **Habits** — top-accent border `2.5px solid #c97b6e`, stronger shadow `0 4px 18px rgba(160,82,45,0.1)`. Header "Habits" (Lora 16px `#6b3a1f`) + count "3 / 5" (Lora 14px `#c97b6e`). A hand-drawn underline SVG stroke. 5 rows, each: a 23px circle + label (with emoji prefix). Done → circle `#c97b6e` white ✓, label `#b89870` strikethrough. Undone → 2px `rgba(160,110,60,0.3)` ring, label `#2c1a0e`. Rows separated by `1px dashed rgba(160,110,60,0.14)`. Whole row is the tap target.
4. **Schedule** — vertical dashed timeline (`repeating-linear-gradient` dotted rail). Events with colored node dots; a Caveat "now · 11:20" divider line in `#c97b6e`.
5. **Daily focus** — lined-notebook background (`repeating-linear-gradient` 30px ruled lines + a `1.5px rgba(201,123,110,0.45)` margin rule at left 16px). Header + Caveat "just 3 things". 3 tappable items with 21px `border-radius:6px` checkboxes; done → `#6b9e7a`.
6. **Water + Weight** (side-by-side row). Water: a 38×48px glass outline that fills bottom-up (`linear-gradient(#8fb4c9,#6e93ae)`, `height` = count/8, transition 0.35s). "{n} / 8", "glasses · {pct}%", "+ glass" button (`#7a8fa6`). Weight: fixed card "72.4 kg", "↓ 0.3 this week", "Log".
7. **Quick capture** — dashed torn-note card `#fdf6e8`, rotated -0.5deg. Caveat 19px input "jot something down…" + a 38px `#a0522d` "+" button.

### This week
Purpose: weekly overview.
1. **Header + day strip** — "This week" (Lora 20px) + "20–26 Jul" italic. Seven day cells Mon–Sun (weekday label + Lora date number); today (Mon 20) filled `#c97b6e` white.
2. **Priorities this week** — top-accent `#d4a96a`. Uppercase label "⭐ Priorities this week". 3 tappable priorities, 22px round checkboxes, done → `#d4a96a`.
3. **Habit consistency** — header + "86%" (`#6b9e7a`). A 7-column dot grid: column letters M T W T F S S, then one row per habit (78px label + 7 dots). Filled dot 15px `#c97b6e`; empty 15px with `1.5px rgba(160,110,60,0.28)` ring.
4. **Training split** — Mon–Sun list. Today's row tinted `rgba(201,123,110,0.12)` with a "today" badge (`#d4845a`); rest days italic `#b89870` with a muted "rest" badge.

### Inbox
Purpose: capture and triage loose notes.
- Header "Inbox" (Lora 20px) + "{n} to sort" pill. Italic helper "Empty your head here — sort it out later."
- Capture input (same as Today's) at top.
- Empty state: centered 📥 + "All clear. Nothing to sort." (shown when list length is 0).
- Note cards (9px gap): 22px round check + text + a Caveat "done" tag when checked. Done → card `#f5efe4`, text strikethrough `#b89870`, check `#6b9e7a`. New captures prepend to the top.

---

## Interactions & Behavior
- **Tab nav**: sets active tab; content re-renders with the 0.28s fadeIn.
- **Toggle habit / focus / priority / inbox item**: flips `done`. Check mark plays a pop: `@keyframes { 0%{scale(0.6)} 60%{scale(1.15)} 100%{scale(1)} }` 0.25s.
- **Log gym**: one-way; button turns green "Logged ✓", fires celebrate + toast "💪 gym logged — nice work".
- **Add water**: `min(8, n+1)`, glass fill animates; at 8 → celebrate + toast "💧 hydrated — 8 / 8!".
- **Quick capture**: Enter key or "+" tap; trims input, prepends `{text, done:false}` to inbox, clears field, toast "📥 saved to inbox". Empty input does nothing.
- **Celebrate (confetti)**: fired when (a) all 5 habits become done, (b) all 3 daily-focus done, (c) gym logged, (d) water hits 8. 28 pieces, random x-position/size/delay, colors `[#c97b6e,#d4a96a,#6b9e7a,#9b7b8a,#a0522d]`, `@keyframes { to { translateY(920px) rotate(540deg); opacity:0 } }`, 0.9–1.7s. Full-viewport overlay, `pointer-events:none`, cleared after 1.5s.
- **Toast**: bottom-center pill `linear-gradient(135deg,#6b3a1f,#4a2713)`, cream text, slides up (`translate(-50%,14px)→0`), auto-hides after 1.9s.
- Celebration fires only on the **transition** into all-complete (guard against re-firing when already all-done).

## State Management
Per the app's existing localStorage pattern, persist:
- `activeTab` ('today' | 'week' | 'inbox')
- `habits: [{icon,label,done}]`, `focus: [{label,done}]`, `priorities: [{label,done}]`
- `inbox: [{text,done}]`
- `water` (0–8), `trained` (bool), `streak` (int)
- transient (not persisted): `capture` (input text), `toast` (message | null), `celebrate` (timestamp | false)

Suggested extension the user asked about: increment `streak` when the day's habits all complete, and count it up live.

## Design Tokens
- Colors: page `#f7f0e8`; card `#fffdf9`; tab-track/tape-adjacent `#f2e8d8`; capture note `#fdf6e8`; inbox-done `#f5efe4`. Ink `#2c1a0e`; heading `#6b3a1f`; muted `#8a6545`; faded `#b89870`. Accent/coral `#c97b6e`; sienna `#a0522d`; training `#b0563c` / `#d4845a`; green `#6b9e7a`; gold `#d4a96a`; mauve `#9b7b8a`; water blue `#7a8fa6`/`#8fb4c9`/`#6e93ae`. Borders `rgba(160,110,60,0.15)` / `rgba(160,110,60,0.3)`. Shadows are sienna-tinted `rgba(160,82,45,·)`.
- Radii: cards 16px; small boxes/checks 6–12px; pills/chips 999px.
- Type: Lora (headings/numbers/quotes), Source Sans 3 (UI, base 13–14px, labels 10–11px), Caveat (accents). Uppercase labels 10.5px/700, letter-spacing ~0.05–0.08em.
- Spacing: card gap 14px; card padding 16px (masthead 20px); page padding 15px sides.
- Transitions: 0.12–0.2s on states; fadeIn 0.28s; water fill 0.35s.

## Assets
- No image assets. All iconography is Unicode **emoji** (🤎 🏋️ 💪 🌅 💊 📖 🧘 💧 📥 ⭐ ⚖️ ✨), matching the app's emoji-only convention. `✓` and `↓ ↻ →` are Unicode glyphs.
- Fonts from Google Fonts CDN: Lora, Source Sans 3, Caveat.
- The paper-noise page texture is an inline SVG `feTurbulence` data-URI (no file).

## Files
- `Life Hub Planner.dc.html` — the interactive design reference (template markup + logic). Read the template for exact markup/styles and the logic class for the exact interaction rules. Ignore `support.js` and the iOS frame — they are preview-only scaffolding, not part of the design.

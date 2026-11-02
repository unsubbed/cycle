# Unsubbed Cycle — spec

A free alternative to Flo and Clue: a private period tracker that runs fully in the browser. Nothing leaves the device. **Not medical advice and not birth control**; the app says so plainly.

## 0. Decisions made by the agent (for Zabir to check at Gate 5)
- App color **Cobalt** `#2563eb` / dark `#7aa2ff`. Flo is pink, Clue is red-coral; blue avoids both and every earlier Unsubbed app (emerald, coral, violet).
- No reminders: browsers can't reliably notify without a server or an installed app. Listed as a known limit.
- No "pregnancy mode", no partner sharing, no AI chat, no content library. Core tracking only.
- Extra the incumbents don't offer: **passphrase-encrypted backup file**, **print a cycle summary for a doctor visit**, zero network and no account at all.

## 1. Who and why
People who want to track their period without handing intimate health data to a company. Open the page, tap days, see estimates. No sign-up.

## 2. KEEP (functional) vs CHANGE (expressive)
| Area | KEEP (how it works) | CHANGE (how it looks / what it's called) |
|---|---|---|
| Logging | Tap a day, mark flow, add symptoms, mood and a note | Our own day panel, chip shapes and wording ("How heavy?", "Body", "Mind") |
| Calendar | Month grid with logged, predicted and fertile days | Our marks: solid filled square = logged period, dashed outline = predicted period, diagonal hatch = estimated fertile days. Never pink/red |
| Today status | Cycle day number and days until next period | A horizontal **cycle strip** (a bar across the current cycle), not a big circle |
| Predictions | Average of recent cycles; next periods and fertile window | Shown as "about" ranges with an "estimate only" label |
| History | Past cycles with lengths | A plain table plus averages; printable |
| Data | Export/import | `.json` save/open (kit Save/Open), CSV export, encrypted backup, print summary |
| Settings | Typical cycle and period length, week start | In the kit's Settings dialog |

## 3. Layout (desktop ≥ 900 px)
- Left (wide): month calendar with previous/next month buttons and a "Today" button above it.
- Right column: **Today card** (cycle strip, "Day 12 of about 28", "Next period in about 16 days", "Fertile window: Nov 10 – Nov 16 (estimate)"), then the **Day panel** for the selected day, then **History**.
- Phone (< 900 px): Today card on top, calendar, then Day panel and History stacked. Tapping a day scrolls to the Day panel.

## 4. Day panel (for the selected date)
- Heading: the date in words ("Monday, 2 November").
- **How heavy?** single-choice: None · Spotting · Light · Medium · Heavy (radio buttons styled as pills). "None" clears flow.
- **Body** multi-choice chips: Cramps, Headache, Bloating, Tender breasts, Back ache, Acne, Tired, Nausea, Cravings, Trouble sleeping.
- **Mind** multi-choice chips: Calm, Happy, Low, Irritable, Anxious, Energetic.
- **Note**: textarea, saved as you type.
- Future dates can be selected but logging flow on a future day shows a toast "That day hasn't happened yet" and does not save.
- A day with nothing set is removed from storage.

## 5. Calendar
- 6×7 grid, week start Monday by default (setting: Monday/Sunday). Days outside the month are dimmed.
- Each cell is a button with an accessible label, e.g. "3 November, period, medium flow" or "14 November, estimated fertile".
- Marks: logged flow = filled square (spotting = small filled dot); predicted period = dashed outline; estimated fertile = diagonal hatch; ovulation estimate = small ring; today = bold number + underline; selected = thick outline. A legend sits under the grid.
- Days with symptoms/mood/note show a small dot.
- Keyboard: arrow keys move the selection, Enter selects. Page Up/Down change month.

## 6. Estimates (engine: `cycle.js`, pure functions, tested in `cycle.test.mjs`)
- **Period start**: a day with flow Light/Medium/Heavy where none of the previous 2 days has Light/Medium/Heavy. Spotting never starts a period.
- **Period length**: from a start, consecutive days (gaps of 1 day allowed) with Light/Medium/Heavy.
- **Cycle length**: days between consecutive starts. Ignore cycles shorter than 15 or longer than 60 days when averaging (likely missed logs).
- **Average cycle**: mean of the last 6 valid cycles, rounded; fall back to the setting (default 28) when fewer than 1 valid cycle.
- **Average period**: mean of the last 6 periods; fallback setting (default 5).
- **Next periods**: from the last start, add average cycle; predict the next 3. If the predicted date is already past and nothing logged, the next prediction is shown as "late by N days" on the Today card and the prediction rolls forward.
- **Ovulation estimate**: predicted start − 14 days. **Fertile window**: ovulation − 5 to ovulation + 1.
- No logs at all: Today card says "Tap the first day of your last period to start." and the calendar shows no predictions.
- Variability shown in history: shortest and longest valid cycle.

## 7. History
Table: Started · Cycle length · Period length (newest first, up to the last 12). Below: "Average cycle about N days · average period about N days · range A–B days". Empty: "Your cycles will show here after you log two periods."

## 8. Files and privacy
- State saved in `localStorage` via the kit (`Unsubbed.app`, id `cycle`).
- **Save** (kit): `unsubbed-cycle.json` (`{ app:'unsubbed-cycle', version:1, days, settings }`). **Open**: accepts that `.json`; it replaces current data after a `confirm()`. Invalid file → kit error toast, nothing changed.
- **Export CSV** (button in History): `date,flow,body,mind,note` one row per logged day; fields quoted per RFC 4180; cells starting with `=+-@` prefixed with `'` (spreadsheet formula safety).
- **Encrypted backup** (Settings): passphrase twice → AES-GCM 256 with PBKDF2-SHA-256 (310 000 iterations, random 16-byte salt, 12-byte IV) via Web Crypto → `unsubbed-cycle.locked.json` `{ app:'unsubbed-cycle-locked', v:1, salt, iv, data }` base64. Open recognises it and asks for the passphrase; wrong or cancelled passphrase → the kit's "Couldn't open" toast, nothing changed (kit shows it when `importFile` throws).
- **Print summary** (History): `window.print()` with a print stylesheet showing History table, averages, and the current + previous month calendar; header, buttons and Day panel hidden.
- Disclaimer in the Today card footer: "Estimates only. Not medical advice and not birth control."

## 9. Settings (inside kit dialog `#app-settings`)
Typical cycle length (21–45, default 28), typical period length (2–10, default 5), Week starts on (Monday/Sunday), Encrypted backup button.

## 10. Words (our own)
- App name: Unsubbed Cycle. Tagline: "The private period tracker you don't pay for."
- Empty state, labels, help text: as in this spec. Never "Flo" or "Clue" except in the footer legal line and README.

## 11. Errors
Bad file: kit error toast. Storage full: kit's existing handling. Crypto unavailable (non-secure context): button disabled with a title explaining it needs https or localhost.

## 12. Not in scope (known limits)
Reminders/notifications, pregnancy mode, birth-control pill tracking, temperature/ovulation-test charts, partner sharing, multiple profiles, cloud sync.

## 13. Tech
Files: `index.html` (main + settings), `app.css` (`:root { --app:#2563eb; --app-dark:#7aa2ff; }` + layout), `app.js` (UI), `cycle.js` (engine, ES module-free plain script that also works under Node via `module.exports` guard), `cycle.test.mjs`. No dependencies. Keep the kit CSP; no inline styles.

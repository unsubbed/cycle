# Unsubbed Cycle — clean-room log

Incumbents: Flo (Flo Health) and Clue (BioWink). Unsubbed Cycle is described only as "a free alternative to Flo and Clue".

## Rule 0: terms check (2026-11-02)
| Site | Terms URL | What we found | Decision |
|---|---|---|---|
| Flo | https://flo.health/terms-of-service | The page loaded only its navigation; the terms text did not load, so we could not confirm what it allows. | Treat as **forbidden**. No REA, no Playwright, no automation on flo.health. |
| Clue | https://helloclue.com/terms (last updated June 25, 2026) | No explicit scraping or bot clause in the part read word for word. Later sections (read only as a summary) say you may not decompile, change or copy any part of the app or website. | Treat as **forbidden** to be safe. No REA, no Playwright, no automation on helloclue.com. |

Result: **REA was not used for this app.** Only public help pages, the public homepage text and general knowledge were used.

## Sources used for SPEC.md
| Date | Source | How | What we took |
|---|---|---|---|
| 2026-11-02 | https://help.flo.health/hc/en-us/categories/360000870911-Using-Flo | Public help index, read once via a plain fetch | Which features exist: log period start/end and edit it, symptoms, predictions that update, fertile window, notifications, data copy |
| 2026-11-02 | https://helloclue.com/ and https://helloclue.com/articles/how-to-use-clue/clue-period-tracking-plus-explained | Public pages, read once via a plain fetch | Which features exist: calendar with predicted periods months ahead, tags, cycle history and analysis. Logo color seen in page markup: red #E13336 (to avoid) |
| — | How cycle estimates work (average cycle length; ovulation about 14 days before the next period; fertile window about 5 days before ovulation to 1 day after) | General public health knowledge, in many free guides | The estimate math |
| — | Flo's well-known brand color (pink) | General knowledge; their homepage did not load any color for us | Color to avoid |

## What we did NOT do
- No REA, no Playwright and no browser automation on either incumbent's site.
- No decompiling, unminifying, source-map recovery or binary tools. No JavaScript, CSS or other code files fetched or saved.
- No app installed, no account, no trial, no EULA accepted.
- No incumbent text, labels, help articles, symptom lists, illustrations, colors, logos, fonts or icons copied. Our symptom and mood list, labels and help text are written fresh.

## Raw captures
None. `.rea-private/` holds only the side-by-side image made for the difference check (never published).

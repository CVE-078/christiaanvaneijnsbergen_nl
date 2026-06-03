# Pulse UX Redesign Drafts (2026-06-03)

These are draft UX redesign directions for Pulse. Each one is a self-contained HTML file that shows both the mobile and desktop layouts for the core screens (Train, Progress, Plan). They were generated on 2026-06-03 to explore distinct visual and structural takes on the same app, so you can compare full directions side by side rather than isolated screens.

## How to view

Open any `.html` file in a browser. They are static files with no build step, no dependencies, and no server. Double-click or drag into a browser tab and it renders.

## Comparison

| Direction | Theme | Fonts | One-line pitch | File |
| --- | --- | --- | --- | --- |
| Command Deck | Dark | Sora / Chivo Mono | An instrument-grade control deck for serious lifters: tight grids, tabular numerals, one sharp pulse-green accent. | [command-deck.html](./command-deck.html) |
| Paper Athlete | Warm light | Fraunces / Archivo + Archivo Narrow | An ink-on-warm-paper sports-magazine spread with oversized tabular stats and editorial charts. | [paper-athlete.html](./paper-athlete.html) |
| Neon Gym | Dark | Anton + Barlow Semi Condensed / Archivo | A hype-poster training app: oversized condensed display type, electric lime on dark, a pulsing rest-timer ring. | [neon-gym.html](./neon-gym.html) |
| Quiet Focus | Warm light | Fraunces / Be Vietnam Pro | A calm, warm, tactile habit-app feel that stays dense where it matters, one clay accent. | [quiet-focus.html](./quiet-focus.html) |

## The directions

### Command Deck
Optimizes for fast, precise data entry and review. It treats the app like a control panel: near-black base, hairline borders, monospaced tabular numerals so figures line up cleanly in every set row and chart. Suits serious lifters who log every set and want zero visual noise between them and the numbers. The standout idea is the single sharp pulse-green accent against the dark instrument grid, which keeps the interface calm while making the one thing that matters pop.

### Paper Athlete
Optimizes for a confident, editorial reading experience around your stats. It renders the app like a printed training journal: warm paper background, Fraunces serif headlines, oversized numerals as the hero of each stat, hairline rules and packed multi-column grids. Suits people who enjoy a magazine feel and want their progress to look like a published record. The standout idea is the data-ink editorial charts paired with a single strong red accent, which gives the screens personality without clutter.

### Neon Gym
Optimizes for energy and hype during the workout itself. It uses oversized Anton condensed type packed into a dense grid, electric lime on a green-tinted black, a pulsing orange rest-timer ring, and live PR bursts. Suits lifters who want the app to feel loud and motivating mid-session, like a gym poster. The standout idea is the animated rest-timer ring and live PR bursts that turn the moment of a record into a visible event.

### Quiet Focus
Optimizes for a calm, low-pressure daily habit. It uses soft sand and cream surfaces, warm ink, and a single clay terracotta accent with supportive sage and gold, in a humanist serif and sans pairing. Suits people who want consistency over intensity and prefer a gentle tone, while still getting dense, efficient screens where the detail matters (streak calendar, e1RM line, per-muscle heat, weekly split). The standout idea is keeping a soft, tactile mood without sacrificing data density.

All four are built dense, with no empty space, per the no-empty-space requirement. The difference is tone and structure, not how much fits on screen.

## New features surfaced in these drafts

The drafts make room for features identified in the latest roadmap update, where Pulse trails competitors:

- Live PR detection. The Train screen now has space for an inline real-time PR badge or celebration the moment a set beats the record, not just on the post-workout share card.
- Per-muscle weekly volume. The Progress screen makes room for a per-muscle volume view or body-diagram heat map alongside the existing volume chart.
- Plate calculator. The set logger gets a compact affordance (icon or expandable row) to show the plate breakdown for the target weight without leaving the set.

## Next step

Review the four drafts and pick a direction to take forward, or call out elements to mix across them (for example, Command Deck structure with Quiet Focus warmth). Reply with your pick and any combinations you want, and we will refine from there.

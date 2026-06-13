# Plan page redesign, reviewer prompt

Paste the shared context block verbatim into both Claude.ai (science/UX/product lens) and Perplexity (architecture/maintainability + citable science). Then append the matching per-lens ask. Attach the mockup screenshots to Claude.ai (it reads intent, not pixels): open `docs/superpowers/designs/2026-06-13-21-17-54-plan-page-redesign-v2.html` and screenshot mobile + desktop.

---

## SHARED CONTEXT (paste to both, verbatim)

Pulse is an adaptive strength coach (installable PWA, Next.js 15 / React 19 / Supabase, dark "Slate" theme). Its moat is completion-paced periodized programs that adapt (ramp-back after layoffs, auto-deload on stalled lifts, adherence awareness). Design principle: "simple surface, ignorable intelligence", the UI stays calm and lets users ignore the smarts until they matter.

I am redesigning the **Plan** screen. It should answer, in order: what is my program, where am I in it, what do I lift next, how is the whole training block shaped, what is each session, and how do I change it.

Today's Plan page crams program settings (length selector, start-date picker) into the top hero, shows periodization as an abstract weekly-volume bar chart, and shows the routine rationale as a prose blob (with duress generation-warnings concatenated into it, so they read as permanent boilerplate). Per-session exercise lists are stacked full-length.

**Approved new design (from an iterated mockup):**
- **Program identity card**: routine name, an adherence **status pill** (On track / Behind / Lapsed / Paused, from the existing `ProgramPosition.status`), "Week N of M | Phase, subtitle", a block-progress bar, a stat row (RIR this week, next-deload countdown, days/week), and a **"Why this plan"** affordance where the rationale facts-chips stay inline but the prose collapses (default collapsed).
- **Next session**: the existing prefilled next-session preview (sets x reps + the working weights Train will load), enriched with a focus line + an estimated duration.
- **Training block arc** (the hero): one full-width bar per week of the repeating block, height = that week's planned volume. Bars are **grey with a faint 10% phase tint**; only the **current/selected week** shows full phase colour. The **deload week** is marked. Tapping a week shows a caption (week / phase / sets / RIR) plus a **plain-language phase description**, and the jargon ("RIR", "deload") are tap-for-definition glossary terms. Phases come from the program's periodization model (Accumulation -> Intensification -> Overreach -> Peak & Deload, with descending RIR and a deload at the block end).
- **This week**: a 7-day schedule strip (unchanged).
- **Sessions**: a **session selector (one session shown) on mobile/tablet**, and an **accordion (all sessions, collapsible) on desktop**. Each session row keeps a "why this exercise" line, equipment tags, swap, and how-to.
- **Program settings (collapsed)**: program length, start date, and a **"Change split or days"** entry that reuses the existing regenerate-in-place generation flow.
- **Generation-warning notice**: when a routine was built under equipment/restriction duress, the warning becomes a **distinct dismissible notice** instead of permanent rationale prose.
- **Desktop layout**: a **sticky summary rail** (identity / next session / block arc / this week pinned) beside a scrolling column (sessions + settings).

**Code-truth (already verified against the codebase, do not re-litigate):**
- All data exists; **no database migration** and **no change to the generation algorithm**. New code is presentational plus small pure helpers (block-arc assembler, estimated-session-duration, status-pill mapping, a rationale-warning splitter) and two additive glossary concepts in the shared explain-copy registry.
- The phase model, RIR per week, and volume per week are real program data (block lengths 8/10/12/16; the 12-week block: volume 12->20 then a deload to 10; RIR 3,3,2,2,2,1,1,1,0,1,0,3; four 3-week phases).
- Generation warnings are currently appended into the persisted rationale string; the redesign parses them out for the notice (v1, no migration) with a `warnings` column as a possible later upgrade.
- There is an existing on-demand "Why" explain affordance (popover on desktop, sheet on mobile) and a canonical reason registry; the new phase/RIR/deload explanations route through it, not ad-hoc strings.
- This is a single-user-plus-wife validation-stage app (not launched); favour long-term-sound design over quick wins. No em dashes in any copy.

**Phase descriptions drafted (plain language, for newcomers):**
- Accumulation: "Building your base. Higher volume at an easier effort, so your body adapts and recovers well."
- Intensification: "Turning up the intensity. Volume eases while the weights climb and you train closer to your limit."
- Overreach: "The hardest weeks, by design. Training near failure to drive new muscle and strength."
- Peak & Deload: "A final overload, then a lighter deload week so fatigue clears and you come back stronger."

**Open questions:** O1 warnings parsed-from-rationale + dismiss (no migration) vs a warnings column; O2 restructure entry reuse the tune-in-place panel vs the full setup flow; O3 does tapping a block-arc week become the page's week control (replacing a separate stepper); O4 is the compound flag available on the plan exercise rows for the duration estimate; O5 reuse the existing Progress status formatter vs a new one; O6 where the phase descriptions live (program data vs the explain registry); O7 are the phase descriptions accurate; O8 sticky-rail height trim.

---

## CLAUDE.AI ASK (append after the shared block)

Review as a **training-science + UX/product** lens. Specifically:
1. Are the four phase descriptions accurate and non-overclaiming for a hypertrophy/strength block, and is the RIR/deload glossary wording correct and beginner-safe? Rewrite any that mislead.
2. Does the information architecture serve the user's real questions in the right order? Is anything missing that a lifter genuinely needs on a Plan screen, or present-but-noise?
3. Is the "ignorable intelligence" principle preserved, is the on-demand explain layering (phase description + tap-for-definition) the right amount of coaching, or too much / too little?
4. The block arc greys all but the current week (faint 10% tint elsewhere). Does that still communicate periodization usefully, or does it hide the arc? Recommend.
5. Any product risk in the "Change split or days" entry living in Plan settings (vs onboarding only)?
Give a verdict per point: adopt / adjust (with the change) / reject (with why).

---

## PERPLEXITY ASK (append after the shared block)

Review as an **architecture / maintainability** lens, plus cite evidence for the science sub-questions.
1. O1: parsing duress warnings out of a persisted rationale string + localStorage dismissal (no migration) vs a dedicated `warnings text[]` column (migration). Which is the sounder long-term call for a pre-launch app, and what is the failure mode of the string-parse approach?
2. O5/O6: avoiding two drifting copies, one status-word mapper shared across Plan + Progress, and one canonical home for phase/RIR copy (program data vs the explain registry) given a planned i18n extraction. Recommend the home.
3. The responsive sessions pattern (one component, `mode: selector | accordion`, switched by breakpoint) vs two components. Maintainability call.
4. O2: reusing the regenerate-in-place tune panel from a second entry point vs opening the full setup flow at specific steps, coupling/reuse risk.
5. With web citations: are the four periodization phases (accumulation / intensification / overreach / peak+deload), descending RIR, and an end-of-block deload an accepted, defensible block-periodization model for hypertrophy/strength? Cite sources, and flag anything that is fringe vs consensus.
Give a recommendation per point with the tradeoff stated.

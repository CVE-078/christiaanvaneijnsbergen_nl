-- Bug 6 relabel: per-session focus labels for the quad/posterior lower-day
-- split. Adds a nullable descriptive label to routine_schedule, populated at
-- generation (focusLabelForEmphasis): "Lower (Quads)" for the quad day and
-- "Lower (Hamstrings & Glutes)" for the posterior day on every style that pairs
-- them (ul-classic-4, ul-aesthetic-4, ulppl-5, fb-ul-hybrid-5, ppl-x2-6). Null
-- for all other sessions, which keep their compact type+variant label.
--
-- Additive and non-destructive: existing routines keep label NULL and render
-- exactly as before until regenerated. RLS is row-level on routine_schedule,
-- so the existing policies cover the new column; no policy change needed.
--
-- Apply by hand against Supabase (no automated runner in this repo).

alter table routine_schedule
    add column if not exists label text;

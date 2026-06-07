-- Variety preference: how much generation rotates exercises across sessions.
-- Nullable; null means "never chosen" and resolves to 'varied' (identity, today's
-- behaviour) only at the generation boundary. Mirrors profiles.training_style.
-- Apply manually in the Supabase SQL editor (no automated runner in this repo).
alter table public.profiles
    add column if not exists variety_preference text
    check (variety_preference in ('consistent', 'varied'));

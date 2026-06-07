-- Training style: how the user wants to train, biases generation. Nullable, so
-- existing profiles (and "Balanced") are represented as NULL. No RLS change (the
-- profiles policies already scope by id). Apply manually in the Supabase SQL editor.
alter table public.profiles
  add column if not exists training_style text
  check (training_style in ('balanced', 'strength', 'bodybuilding', 'powerbuilding'));

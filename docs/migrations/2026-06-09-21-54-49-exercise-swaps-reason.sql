-- Smart substitution v2 (#8): optional reason a swap was made. null = unspecified
-- (treated as preference). Constraint swaps (pain/no_equipment/crowded) are
-- excluded from #7 behavior-learning's demote. Nullable, no default; null passes
-- the CHECK.
alter table exercise_swaps
  add column if not exists reason text check (reason in ('pain', 'no_equipment', 'crowded'));

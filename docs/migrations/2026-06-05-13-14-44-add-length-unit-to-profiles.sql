-- Add a length-unit preference to profiles so body measurements (waist, hips,
-- chest, arms) and the recomp waist delta can render in cm or inches. Values
-- stay stored canonically in cm; this only controls display + input parsing.
-- Mirrors the existing weight `unit` ('kg' | 'lbs') preference.
alter table profiles add column if not exists length_unit text not null default 'cm' check (length_unit in ('cm','in'));

-- Lighten this week (#11): allow the user-initiated 'manual_deload' adjustment
-- kind alongside the gap-driven ramp-back kinds. Widens the CHECK constraint that
-- 2026-06-05-18-45-27-adaptive-missed-workout-regen.sql created inline (auto-named
-- program_adjustments_kind_check). Without this, the first lightenThisWeek write
-- fails the CHECK. There is no automated runner in this repo; apply manually.
--
-- decision_events needs no migration: a manual lighten dual-writes a row of the
-- existing type 'ramp_back' with trigger 'manual', and trigger is a free text
-- column (validated only in application code), so no DB constraint changes.

alter table public.program_adjustments
    drop constraint if exists program_adjustments_kind_check;

alter table public.program_adjustments
    add constraint program_adjustments_kind_check
    check (kind in ('reentry_deload', 'reentry_dismissed', 'manual_deload'));

-- Raise the exercise_swaps.week cap from 12 to 52 to match set_logs week validation.
-- Programs now repeat in blocks up to 16 weeks and weeks run to 52, but swaps were
-- still capped at week 12 (a leftover from the static 12-week program), so a swap in
-- any week past 12 silently failed the CHECK. 52 matches the loggable week range.
alter table exercise_swaps drop constraint if exists exercise_swaps_week_check;
alter table exercise_swaps add constraint exercise_swaps_week_check check (week between 1 and 52);

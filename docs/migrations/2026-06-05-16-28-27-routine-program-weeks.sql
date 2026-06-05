-- Periodized block length per routine. The program repeats a block of this many
-- weeks indefinitely (deloading at each block end). Default 12 matches the prior
-- single static 12-week program, so existing routines are unchanged.
alter table workout_routines
    add column if not exists program_weeks int not null default 12
    check (program_weeks in (8, 10, 12, 16));

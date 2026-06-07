-- Session debrief: capture how a workout felt.
-- Adds an optional session RPE (1-10) and a free-text note to workout_sessions.
-- Both nullable so completing without them stays valid. RLS already scopes
-- workout_sessions by user_id, so no policy change is needed.
alter table public.workout_sessions
    add column if not exists session_rpe smallint
        check (session_rpe is null or session_rpe between 1 and 10),
    add column if not exists session_note text
        check (session_note is null or char_length(session_note) <= 1000);

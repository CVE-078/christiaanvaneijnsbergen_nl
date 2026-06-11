-- Migration: ON DELETE CASCADE foreign keys to auth.users (account deletion safety)
-- Date: 2026-06-11
-- Apply via Supabase SQL Editor (no automated runner in this repo).
--
-- ============================================================================
-- DRAFT, VERIFY BEFORE APPLYING. This was authored WITHOUT a confirmed schema
-- dump. The information_schema cascade audit returned no rows, which most likely
-- means there are NO foreign keys to auth.users at all (ownership is enforced by
-- RLS, not constraints). Without cascades, deleting an auth user via the admin
-- API would ORPHAN every user-owned row, a data-leak / GDPR problem and exactly
-- what the deleteAccount path depends on this migration to prevent.
--
-- BEFORE APPLYING, do two things:
--
--   1. Re-run the reliable cascade audit (pg_catalog, not information_schema) and
--      reconcile the table/column list below against reality:
--
--      SELECT cl.relname AS table_name, att.attname AS column_name,
--             fns.nspname AS ref_schema, fcl.relname AS ref_table,
--             CASE con.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
--               WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
--      FROM pg_constraint con
--      JOIN pg_class cl ON cl.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
--      JOIN pg_class fcl ON fcl.oid=con.confrelid JOIN pg_namespace fns ON fns.oid=fcl.relnamespace
--      JOIN unnest(con.conkey) AS ck(attnum) ON true
--      JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ck.attnum
--      WHERE con.contype='f' AND ns.nspname='public' ORDER BY cl.relname;
--
--   2. Check for ORPHAN values that would make ADD CONSTRAINT fail (each must
--      return 0 rows). Example for a user_id table:
--
--      SELECT count(*) FROM public.set_logs s
--      WHERE s.user_id IS NOT NULL
--        AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);
--
-- The block is idempotent and column-existence-guarded: it skips any listed
-- (table, column) that does not exist, discovers and drops any existing FK from
-- that column to auth.users, then adds an ON DELETE CASCADE FK. Adding the FK
-- fails loudly if orphans exist (run the pre-check above first).
-- ============================================================================

-- Directly user-owned tables: column references auth.users(id) directly.
do $$
declare
    t record;
    fk_name text;
begin
    for t in
        select * from (values
            ('profiles', 'id'),
            ('set_logs', 'user_id'),
            ('exercise_notes', 'user_id'),
            ('bodyweight_logs', 'user_id'),
            ('body_measurements', 'user_id'),
            ('workout_sessions', 'user_id'),
            ('workout_routines', 'user_id'),
            ('exercise_swaps', 'user_id'),
            ('program_adjustments', 'user_id'),
            ('program_pauses', 'user_id'),
            ('decision_events', 'user_id'),
            ('equipment_profiles', 'user_id'),
            ('user_exercise_preferences', 'user_id')
        ) as v(table_name, column_name)
    loop
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = t.table_name and column_name = t.column_name
        ) then
            raise notice 'skip %.% (column not found)', t.table_name, t.column_name;
            continue;
        end if;

        for fk_name in
            select con.conname
            from pg_constraint con
            join pg_class cl on cl.oid = con.conrelid
            join pg_namespace ns on ns.oid = cl.relnamespace
            join pg_class fcl on fcl.oid = con.confrelid
            join pg_namespace fns on fns.oid = fcl.relnamespace
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
            where con.contype = 'f' and ns.nspname = 'public'
                and cl.relname = t.table_name and att.attname = t.column_name
                and fns.nspname = 'auth' and fcl.relname = 'users'
        loop
            execute format('alter table public.%I drop constraint %I', t.table_name, fk_name);
        end loop;

        execute format(
            'alter table public.%I add constraint %I foreign key (%I) references auth.users(id) on delete cascade',
            t.table_name, t.table_name || '_' || t.column_name || '_auth_fk', t.column_name
        );
    end loop;
end $$;

-- Transitive tables: owned via workout_routines, so they cascade once their parent
-- FK is ON DELETE CASCADE and workout_routines cascades from auth.users (above).
do $$
declare
    t record;
    fk_name text;
begin
    for t in
        select * from (values
            ('routine_exercises', 'routine_id'),
            ('routine_schedule', 'routine_id')
        ) as v(table_name, column_name)
    loop
        if not exists (
            select 1 from information_schema.columns
            where table_schema = 'public' and table_name = t.table_name and column_name = t.column_name
        ) then
            raise notice 'skip %.% (column not found)', t.table_name, t.column_name;
            continue;
        end if;

        for fk_name in
            select con.conname
            from pg_constraint con
            join pg_class cl on cl.oid = con.conrelid
            join pg_namespace ns on ns.oid = cl.relnamespace
            join pg_class fcl on fcl.oid = con.confrelid
            join pg_namespace fns on fns.oid = fcl.relnamespace
            join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
            where con.contype = 'f' and ns.nspname = 'public'
                and cl.relname = t.table_name and att.attname = t.column_name
                and fns.nspname = 'public' and fcl.relname = 'workout_routines'
        loop
            execute format('alter table public.%I drop constraint %I', t.table_name, fk_name);
        end loop;

        execute format(
            'alter table public.%I add constraint %I foreign key (%I) references public.workout_routines(id) on delete cascade',
            t.table_name, t.table_name || '_' || t.column_name || '_cascade_fk', t.column_name
        );
    end loop;
end $$;

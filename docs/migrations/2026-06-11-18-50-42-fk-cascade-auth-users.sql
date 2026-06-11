-- Migration: ON DELETE CASCADE foreign keys to auth.users (account deletion safety)
-- Date: 2026-06-11
-- Apply via Supabase SQL Editor (no automated runner in this repo).
--
-- AUDITED against the live schema (2026-06-11, via pg_catalog). Result: foreign
-- keys to auth.users already exist on every user-owned table, and almost all are
-- already ON DELETE CASCADE. Exactly THREE were left as NO ACTION (the three
-- earliest, pre-migration tables): profiles.id, set_logs.user_id,
-- bodyweight_logs.user_id.
--
-- Why this matters: profiles.id is NO ACTION and every user has a profile row, so
-- deleting an auth user (auth.admin.deleteUser, the account-delete flow) currently
-- FAILS with a foreign-key violation rather than orphaning data. This migration
-- flips those three to ON DELETE CASCADE so deletion succeeds and removes the
-- user's profile, set logs, and bodyweight logs.
--
-- No orphan pre-check is needed: the FKs already exist (as NO ACTION), so the data
-- already satisfies referential integrity; changing only the delete rule cannot
-- fail on orphaned values. The block discovers the existing constraint name and
-- re-adds the same FK with ON DELETE CASCADE, so it is name-agnostic and idempotent.
-- The other user-owned tables (set_logs.routine_exercise_id -> routine_exercises,
-- workout_routines, exercise_notes, etc.) already cascade and are untouched.

do $$
declare
    t record;
    fk_name text;
begin
    for t in
        select * from (values
            ('profiles', 'id'),
            ('set_logs', 'user_id'),
            ('bodyweight_logs', 'user_id')
        ) as v(table_name, column_name)
    loop
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

-- Verify afterwards (all three should read CASCADE):
--   select cl.relname, att.attname,
--          case con.confdeltype when 'c' then 'CASCADE' else con.confdeltype::text end as on_delete
--   from pg_constraint con
--   join pg_class cl on cl.oid = con.conrelid
--   join pg_class fcl on fcl.oid = con.confrelid
--   join pg_namespace fns on fns.oid = fcl.relnamespace
--   join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
--   where con.contype='f' and fns.nspname='auth' and fcl.relname='users'
--     and cl.relname in ('profiles','set_logs','bodyweight_logs');

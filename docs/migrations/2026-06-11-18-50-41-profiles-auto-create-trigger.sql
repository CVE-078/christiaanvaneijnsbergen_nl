-- Migration: auto-create a profiles row when an auth user is created
-- Date: 2026-06-11
-- Apply via Supabase SQL Editor (no automated runner in this repo).
--
-- Replaces the fragile lazy "select-then-insert" that used to live in the login
-- server action. A trigger on auth.users guarantees every account-creation path
-- (self-serve signup, future OAuth, manual creation) gets a profile row with the
-- base defaults, exactly once. SECURITY DEFINER lets the trigger insert into
-- public.profiles regardless of the inserting role; search_path = '' forces fully
-- qualified names (the standard Supabase hardening). ON CONFLICT is a safety net
-- so a pre-existing row (e.g. the current two users) is never clobbered.
--
-- APPLY-ORDER NOTE: deploy this together with the auth feature. Once the login
-- action's lazy insert is gone (this PR), a new signup that does not hit this
-- trigger would have no profile row. Apply before/with the deploy.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, unit, onboarding_completed)
    values (new.id, 'kg', false)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

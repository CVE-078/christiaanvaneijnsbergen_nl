-- Persistent per-muscle training priority. The routine generator leans emphasis,
-- slot selection, and the weekly volume target toward this muscle; gender only
-- seeds its default in the UI (female -> glutes). Nullable: null means "never
-- chosen" (seed from gender in the picker); 'balanced' is an explicit no-priority.
alter table profiles
    add column if not exists priority_muscle text
    check (priority_muscle in ('glutes', 'legs', 'chest', 'back', 'shoulders', 'arms', 'balanced'));

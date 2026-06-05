-- User-selectable accent colour. Stores a preset key (see ACCENT_PRESETS in
-- src/lib/pulse/constants.ts); null = the default coral. Apply manually.
alter table public.profiles add column if not exists accent_color text;

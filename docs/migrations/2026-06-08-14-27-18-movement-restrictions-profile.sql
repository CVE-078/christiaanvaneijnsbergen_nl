-- Movement restrictions (Tier 2 #5): joint areas to avoid in generation.
-- Nullable text[]; null/empty means no restrictions (identity path).
-- Inherits the existing owner-scoped RLS on profiles (column add, no policy change).
alter table profiles
    add column if not exists movement_restrictions text[];

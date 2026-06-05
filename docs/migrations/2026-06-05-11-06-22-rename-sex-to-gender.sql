-- Rename the profiles.sex column to gender for consistent terminology across
-- the app. The values and check constraint are unchanged ('male' | 'female');
-- only the column name changes, so existing data is preserved.
alter table profiles rename column sex to gender;

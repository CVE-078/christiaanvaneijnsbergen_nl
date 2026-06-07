-- Add loading_lean column to profiles.
-- Stores the user's preferred loading modality for generation (barbell /
-- dumbbell / machine / cable). Acts as a secondary sort inside the slot filler:
-- preferred-equipment exercises float to the front so the fresh-preference logic
-- picks them first. null = no preference (identity, byte-identical to base).
-- Mirrors the pattern of training_style and variety_preference (both nullable).

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS loading_lean TEXT
    CHECK (loading_lean IN ('barbell', 'dumbbell', 'machine', 'cable'));

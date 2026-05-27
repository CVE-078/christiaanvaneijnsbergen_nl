-- ============================================================
-- Migration: profile-enhancements
-- 2026-05-29
-- ============================================================

-- STEP 1: Add goal_weight_kg to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS goal_weight_kg numeric(5,2);

-- STEP 2: Create body_measurements table
CREATE TABLE IF NOT EXISTS body_measurements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  waist_cm    numeric(5,1),
  hips_cm     numeric(5,1),
  chest_cm    numeric(5,1),
  arms_cm     numeric(5,1),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_select" ON body_measurements;
CREATE POLICY "body_measurements_select" ON body_measurements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "body_measurements_insert" ON body_measurements;
CREATE POLICY "body_measurements_insert" ON body_measurements
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "body_measurements_delete" ON body_measurements;
CREATE POLICY "body_measurements_delete" ON body_measurements
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- STEP 3: Allow logged_at override on bodyweight_logs
-- (no schema change needed — logged_at is already a timestamptz,
--  we just pass a custom value from the client)

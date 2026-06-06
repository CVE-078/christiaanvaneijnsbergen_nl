-- ============================================================
-- Migration: chest-fly-requires-bench
-- 2026-06-06
-- ============================================================
-- Fixes an equipment mis-tag surfaced during the validation block:
-- a "dumbbells only" (no bench) routine still generated Chest Fly.
-- A dumbbell chest fly is performed lying supine, so it genuinely
-- needs a bench; the 2026-06-04 equipment-correction seed put it in
-- the dumbbells-only group by mistake. Re-tag it dumbbells + bench so
-- the generator's hasEquipment filter excludes it for no-bench setups.
--
-- Scope note (intentionally NOT changed): Dumbbell Single-Arm Row
-- stays dumbbells-only. A single-arm row has a legit bench-free
-- variant (staggered stance, free hand on the knee), so requiring a
-- bench would wrongly exclude it from home dumbbell-only setups. Leave
-- it unless we decide every "supported" row should assume a bench.
--
-- Apply via the Supabase SQL Editor AFTER 2026-06-04-exercise-equipment-correction.sql.
-- Idempotent: a pure UPDATE scoped to the global row; re-running is safe.

UPDATE exercises SET equipment = ARRAY['dumbbells', 'bench']
WHERE user_id IS NULL AND name = 'Chest Fly';

-- Verification (should return one row: Chest Fly with {dumbbells,bench}).
SELECT name, equipment
FROM exercises
WHERE user_id IS NULL AND name = 'Chest Fly';

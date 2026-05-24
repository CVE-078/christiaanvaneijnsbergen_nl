/**
 * One-time migration: imports a Pulse JSON export into Supabase set_logs.
 *
 * Usage:
 *   bun run scripts/migrate-kv-to-supabase.ts <path-to-export.json> <supabase-user-id>
 *
 * Env vars required (read from .env.local automatically by bun):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Find your user ID in Supabase dashboard → Authentication → Users.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const [, , jsonPath, userId] = process.argv;
if (!jsonPath || !userId) {
  console.error('Usage: bun run scripts/migrate-kv-to-supabase.ts <export.json> <user-id>');
  process.exit(1);
}

const supabase = createClient(url, key);

async function migrate() {
  const raw: Record<string, { kg: number; reps: number; rir: number; saved: boolean }> =
    JSON.parse(readFileSync(jsonPath, 'utf-8'));

  const rows = Object.entries(raw)
    .filter(([, v]) => v?.saved)
    .map(([key, val]) => {
      const [week, workout_type, ex_idx, set_idx] = key.split('-');
      return {
        user_id: userId,
        week: Number(week),
        workout_type,
        ex_idx: Number(ex_idx),
        set_idx: Number(set_idx),
        kg: val.kg,
        reps: val.reps,
        rir: val.rir,
        saved: true,
      };
    });

  console.log(`Migrating ${rows.length} entries for user ${userId}…`);

  const { error } = await supabase
    .from('set_logs')
    .upsert(rows, { onConflict: 'user_id,week,workout_type,ex_idx,set_idx' });

  if (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }

  console.log('Done.');
}

migrate();

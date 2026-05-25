import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateLogs } from '@/lib/pulse/validation';
import type { Logs } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data, error } = await supabase
        .from('set_logs')
        .select('week, workout_type, ex_idx, set_idx, kg, reps, rir, saved')
        .eq('user_id', user.id);

    if (error) return NextResponse.json(null, { status: 500 });

    const raw: Record<string, unknown> = {};
    for (const row of data ?? []) {
        raw[`${row.week}-${row.workout_type}-${row.ex_idx}-${row.set_idx}`] = {
            kg: Number(row.kg),
            reps: row.reps,
            rir: row.rir,
            saved: row.saved,
        };
    }

    const logs: Logs = validateLogs(raw) ? (raw as Logs) : {};
    return NextResponse.json(logs);
}

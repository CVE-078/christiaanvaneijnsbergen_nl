import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { BodyweightEntry } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('bodyweight_logs')
        .select('id, logged_at, weight_kg')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(90);

    const entries: BodyweightEntry[] = (data ?? []).map((r: { id: string; logged_at: string; weight_kg: number }) => ({
        id: r.id,
        logged_at: r.logged_at,
        weight_kg: Number(r.weight_kg),
    }));

    return NextResponse.json(entries);
}

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/pulse/types';

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data } = await supabase
        .from('profiles')
        .select('display_name, unit, active_routine_id, onboarding_completed, goal_weight_kg')
        .eq('id', user.id)
        .single();

    const profile: Profile = {
        display_name: data?.display_name ?? null,
        unit: data?.unit === 'lbs' ? 'lbs' : 'kg',
        active_routine_id: data?.active_routine_id ?? null,
        onboarding_completed: data?.onboarding_completed ?? false,
        goal_weight_kg: data?.goal_weight_kg ? Number(data.goal_weight_kg) : null,
    };

    return NextResponse.json(profile);
}

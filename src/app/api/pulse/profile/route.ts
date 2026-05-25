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
        .select('display_name, unit')
        .eq('id', user.id)
        .single();

    const profile: Profile = {
        display_name: data?.display_name ?? null,
        unit: data?.unit === 'lbs' ? 'lbs' : 'kg',
    };

    return NextResponse.json(profile);
}

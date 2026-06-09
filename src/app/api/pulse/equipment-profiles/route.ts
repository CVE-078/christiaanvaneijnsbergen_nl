import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadEquipmentProfiles } from '@/lib/pulse/queries';
import type { EquipmentProfile } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let profiles: EquipmentProfile[] = [];
    try {
        profiles = await loadEquipmentProfiles(supabase, user.id);
    } catch {
        profiles = [];
    }
    return NextResponse.json(profiles);
}

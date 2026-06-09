import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadProfile } from '@/lib/pulse/queries';
import type { Profile } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let profile: Profile = {
        display_name: null,
        unit: 'kg',
        length_unit: 'cm',
        active_routine_id: null,
        active_equipment_profile_id: null,
        onboarding_completed: false,
        goal_weight_kg: null,
        gender: null,
        priority_muscle: null,
        training_style: null,
        variety_preference: null,
        loading_lean: null,
        movement_restrictions: null,
        timezone: 'UTC',
    };
    try {
        profile = await loadProfile(supabase, user.id);
    } catch {
        // Fall back to the default profile, matching the prior behaviour
        // where a failed query yielded the default-valued profile.
    }
    return NextResponse.json(profile);
}

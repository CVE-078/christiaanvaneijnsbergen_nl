import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadAdjustments } from '@/lib/pulse/queries';
import type { ProgramAdjustment } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let adjustments: ProgramAdjustment[] = [];
    try {
        adjustments = await loadAdjustments(supabase, user.id);
    } catch {
        adjustments = [];
    }
    return NextResponse.json(adjustments);
}

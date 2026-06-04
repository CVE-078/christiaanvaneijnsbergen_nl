import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadBodyMeasurements } from '@/lib/pulse/queries';
import type { BodyMeasurement } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let entries: BodyMeasurement[] = [];
    try {
        entries = await loadBodyMeasurements(supabase, user.id);
    } catch {
        entries = [];
    }
    return NextResponse.json(entries);
}

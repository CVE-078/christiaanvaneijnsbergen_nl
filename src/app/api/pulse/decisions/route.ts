import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadDecisionEvents } from '@/lib/pulse/queries';
import type { DecisionEventRow } from '@/lib/pulse/types';

// The user's unified DecisionEvent log, newest first. Feeds the Coach Decision
// Timeline (compact card + full overlay).
export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let events: DecisionEventRow[] = [];
    try {
        events = await loadDecisionEvents(supabase, user.id);
    } catch {
        events = [];
    }
    return NextResponse.json(events);
}

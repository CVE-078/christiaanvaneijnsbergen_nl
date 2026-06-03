import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadBodyweight } from '@/lib/pulse/queries';
import type { BodyweightEntry } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let entries: BodyweightEntry[] = [];
    try {
        entries = await loadBodyweight(supabase, user.id);
    } catch {
        entries = [];
    }
    return NextResponse.json(entries);
}

import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadSwaps } from '@/lib/pulse/queries';
import type { Swaps } from '@/lib/pulse/types';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    let swaps: Swaps = {};
    try {
        swaps = await loadSwaps(supabase, user.id);
    } catch {
        swaps = {};
    }
    return NextResponse.json(swaps);
}

import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { loadLogs } from '@/lib/pulse/queries';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    try {
        const logs = await loadLogs(supabase, user.id);
        return NextResponse.json(logs);
    } catch {
        return NextResponse.json(null, { status: 500 });
    }
}

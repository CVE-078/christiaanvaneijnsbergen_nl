import { NextRequest, NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;

    const { data, error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

    if (error || !data) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(data);
}

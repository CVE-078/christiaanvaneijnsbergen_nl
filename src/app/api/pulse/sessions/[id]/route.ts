import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
    _req: NextRequest,
    { params }: { params: { id: string } },
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });

    const { data, error } = await supabase
        .from('workout_sessions')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .is('completed_at', null)
        .select()
        .single();

    if (error || !data) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(data);
}

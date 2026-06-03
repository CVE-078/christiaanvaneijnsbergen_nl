import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';

export async function GET() {
    const { supabase, user, response } = await getUserOrUnauthorized();
    if (!user) return response;
    const { data } = await supabase.from('routine_templates').select('*').order('experience_level');
    return NextResponse.json(data ?? []);
}

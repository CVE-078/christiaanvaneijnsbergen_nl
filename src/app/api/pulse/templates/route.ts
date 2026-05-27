import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json(null, { status: 401 });
    const { data } = await supabase
        .from('routine_templates')
        .select('*')
        .order('experience_level');
    return NextResponse.json(data ?? []);
}

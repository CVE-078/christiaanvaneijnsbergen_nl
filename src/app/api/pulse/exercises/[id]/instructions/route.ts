import { NextResponse } from 'next/server';
import { getUserOrUnauthorized } from '@/lib/pulse/auth';
import { UUID_RE } from '@/lib/pulse/utils';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Invalid exercise ID' }, { status: 400 });
    }

    const { supabase, response } = await getUserOrUnauthorized();
    if (response) return response;

    const { data, error } = await supabase
        .from('exercise_instructions')
        .select('exercise_id, primary_muscles, secondary_muscles, cues')
        .eq('exercise_id', id)
        .maybeSingle();

    if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(data);
}

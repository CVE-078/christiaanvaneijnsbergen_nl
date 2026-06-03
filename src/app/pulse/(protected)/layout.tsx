import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import PulseLayout from '@/components/pulse/PulseLayout';

export const revalidate = 0;

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/pulse/login');

    // Data is fetched client-side via SWR (see PulseProvider hooks); the shell
    // renders immediately and each view shows skeletons until its slice arrives.
    return (
        <PulseLayout userId={user.id} email={user.email ?? ''}>
            {children}
        </PulseLayout>
    );
}

import type { Metadata } from 'next';
import AuthShell from '@/components/pulse/AuthShell';
import SignupForm from './SignupForm';

export const metadata: Metadata = {
    title: 'Create your Pulse account',
    robots: { index: false, follow: false },
};

export default function SignupPage() {
    return (
        <AuthShell>
            <SignupForm />
        </AuthShell>
    );
}

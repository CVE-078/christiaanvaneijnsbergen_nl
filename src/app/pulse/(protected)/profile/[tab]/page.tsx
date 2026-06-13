import ProfileView from '@/components/pulse/views/ProfileView';

// Deep-linkable profile tabs (/pulse/profile/training). The view reads the active
// tab from the pathname; an unknown tab falls back to You.
export default function ProfileTabPage() {
    return <ProfileView />;
}

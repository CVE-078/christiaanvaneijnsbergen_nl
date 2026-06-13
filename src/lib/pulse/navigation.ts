import type { View } from './types';

// Pulse uses path-based navigation: /pulse/<view>, with the segmented views
// (progress, profile) deep-linkable one level deeper (/pulse/progress/lifts).
// These helpers are pure so they unit-test without the client/font deps in
// PulseLayout, and they keep the URL <-> tab mapping in one place.

export type ProgressTab = 'overview' | 'lifts' | 'body';
export type ProfileTab = 'you' | 'training';

const SEGMENT_TO_VIEW: Record<string, View> = {
    train: 'train',
    plan: 'plan',
    progress: 'progress',
    profile: 'profile',
    library: 'library',
};

// The view is decided by the first segment after /pulse, so a deep-linked tab
// (/pulse/progress/lifts) still resolves to its parent view (progress).
export function resolveView(pathname: string | null | undefined): View {
    const segment = (pathname ?? '').split('/')[2] ?? '';
    return SEGMENT_TO_VIEW[segment] ?? 'train';
}

// /pulse/progress/<tab> -> tab (default overview for the bare path / unknown tab).
export function progressTabFromPath(pathname: string | null | undefined): ProgressTab {
    const seg = (pathname ?? '').split('/')[3];
    return seg === 'lifts' || seg === 'body' ? seg : 'overview';
}

export function profileTabFromPath(pathname: string | null | undefined): ProfileTab {
    return (pathname ?? '').split('/')[3] === 'training' ? 'training' : 'you';
}

// The default tab lives at the bare path (no /overview or /you suffix).
export function progressTabPath(tab: ProgressTab): string {
    return tab === 'overview' ? '/pulse/progress' : `/pulse/progress/${tab}`;
}

export function profileTabPath(tab: ProfileTab): string {
    return tab === 'you' ? '/pulse/profile' : `/pulse/profile/${tab}`;
}

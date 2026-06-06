import PageSkeleton from '@/components/pulse/PageSkeleton';

// Suspense fallback for the protected page segments (train / plan / progress /
// profile / library). It renders inside the persisted PulseLayout shell, so on a
// client navigation between tabs the nav chrome stays put and the content area
// shows a skeleton instantly during the server round-trip, instead of the old
// page freezing for a beat with no feedback. Each view still swaps to its own
// PageSkeleton (then live data, instant on a warm SWR cache) once it mounts.
export default function ProtectedLoading() {
    return <PageSkeleton />;
}

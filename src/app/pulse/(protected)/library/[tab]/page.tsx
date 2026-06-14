import LibraryView from '@/components/pulse/views/LibraryView';

// Deep-linkable library tabs (/pulse/library/routines). The view reads the active
// tab from the pathname; an unknown tab falls back to Exercises.
export default function LibraryTabPage() {
    return <LibraryView />;
}

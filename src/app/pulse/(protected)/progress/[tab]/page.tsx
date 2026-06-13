import HistoryView from '@/components/pulse/views/HistoryView';

// Deep-linkable progress tabs (/pulse/progress/lifts, /pulse/progress/body). The
// view reads the active tab from the pathname; an unknown tab falls back to Overview.
export default function ProgressTabPage() {
    return <HistoryView />;
}

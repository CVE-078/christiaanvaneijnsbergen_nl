'use client';
import { useCallback, useEffect, useState } from 'react';
import { saveLogs } from '@/app/pulse/actions';
import ProgramView from './views/ProgramView';
import LogView from './views/LogView';
import HistoryView from './views/HistoryView';
import type { Logs, LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

type View = 'log' | 'program' | 'history';

const MONO = "var(--pulse-mono, 'JetBrains Mono', 'Courier New', monospace)";
const ACCENT = '#ff6c2f';
const BG = '#0a0a0a';
const BORDER = '#1f1f1f';
const DIM = '#555';

const NAV: { id: View; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'program', label: 'Program' },
  { id: 'history', label: 'History' },
];

interface Props {
  initialLogs: Logs;
}

export default function TrackerClient({ initialLogs }: Props) {
  const [logs, setLogs] = useState<Logs>(initialLogs);
  const [activeWeek, setActiveWeek] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    return Number(localStorage.getItem('wt_week') ?? 1);
  });
  const [activeTab, setActiveTab] = useState<WorkoutType>('push');
  const [view, setView] = useState<View>('log');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('wt_week', String(activeWeek));
  }, [activeWeek]);

  const persist = useCallback(
    (newLogs: Logs) => {
      setLogs(newLogs);
      setSaveError(null);
      saveLogs(newLogs).catch(() => {
        setSaveError('Failed to save. Retrying…');
        setTimeout(
          () => saveLogs(newLogs).catch(() => setSaveError('Save failed. Check your connection.')),
          3000,
        );
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const updateLog = useCallback(
    (key: string, entry: LogEntry) => persist({ ...logs, [key]: entry }),
    [logs, persist],
  );

  const deleteLog = useCallback(
    (key: string) => {
      const newLogs = { ...logs };
      delete newLogs[key];
      persist(newLogs);
    },
    [logs, persist],
  );

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
      {/* Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: BG,
          borderBottom: `1px solid ${BORDER}`,
          padding: '0 1rem',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}
      >
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>
          Pulse<span style={{ color: ACCENT }}>.</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: DIM, letterSpacing: '0.05em' }}>
          WK <strong style={{ color: ACCENT, fontWeight: 700 }}>{String(activeWeek).padStart(2, '0')}</strong> / 12
        </span>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem' }}>
          {NAV.map(({ id, label }) => {
            const active = view === id;
            return (
              <button
                key={id}
                onClick={() => setView(id)}
                style={{
                  fontFamily: MONO,
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: active ? '#fff' : DIM,
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? `1px solid ${ACCENT}` : '1px solid transparent',
                  paddingBottom: '1px',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Save error */}
      {saveError && (
        <div
          role="alert"
          style={{ padding: '0.5rem 1rem', background: '#f43f5e18', borderBottom: '1px solid #f43f5e33', color: '#f43f5e', fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.04em', textAlign: 'center' }}
        >
          {saveError}
        </div>
      )}

      {/* Views */}
      {view === 'log' && (
        <LogView
          activeWeek={activeWeek}
          onSelectWeek={setActiveWeek}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          logs={logs}
          updateLog={updateLog}
          deleteLog={deleteLog}
        />
      )}
      {view === 'program' && (
        <ProgramView
          activeWeek={activeWeek}
          onSelectWeek={w => {
            setActiveWeek(w);
            setView('log');
          }}
        />
      )}
      {view === 'history' && <HistoryView logs={logs} />}
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { saveLogs } from '@/app/weight-tracker/actions';
import ProgramView from './views/ProgramView';
import LogView from './views/LogView';
import HistoryView from './views/HistoryView';
import type { Logs, LogEntry, WorkoutType } from '@/lib/weight-tracker/types';

type View = 'log' | 'program' | 'history';

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

  const updateLog = useCallback(
    (key: string, entry: LogEntry) => {
      const newLogs = { ...logs, [key]: entry };
      setLogs(newLogs);
      setSaveError(null);
      saveLogs(newLogs).catch(() => {
        setSaveError('Failed to save. Retrying…');
        setTimeout(
          () =>
            saveLogs(newLogs).catch(() =>
              setSaveError('Save failed. Check your connection and try again.'),
            ),
          3000,
        );
      });
    },
    [logs],
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#0f0f0f',
          borderBottom: '1px solid #1a1a1a',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontWeight: 700, fontSize: '1rem', flex: 1, color: '#fff' }}>PPL Tracker</span>
        {NAV.map(({ id, label }) => {
          const active = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                padding: '0.375rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: active ? '#fff' : 'transparent',
                color: active ? '#000' : '#888',
                border: `1px solid ${active ? '#fff' : '#2a2a2a'}`,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div
          role="alert"
          style={{
            padding: '0.625rem 1rem',
            background: '#f43f5e22',
            borderBottom: '1px solid #f43f5e44',
            color: '#f43f5e',
            fontSize: '0.8125rem',
            textAlign: 'center',
          }}
        >
          {saveError}
        </div>
      )}

      {/* Views */}
      {view === 'log' && (
        <LogView
          activeWeek={activeWeek}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          logs={logs}
          updateLog={updateLog}
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

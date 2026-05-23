'use client';
import { useState } from 'react';
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
  const [activeWeek, setActiveWeek] = useState(1);
  const [activeTab, setActiveTab] = useState<WorkoutType>('push');
  const [view, setView] = useState<View>('log');

  function updateLog(key: string, entry: LogEntry) {
    const newLogs = { ...logs, [key]: entry };
    setLogs(newLogs);
    saveLogs(newLogs).catch(console.error);
  }

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
                color: active ? '#000' : '#555',
                border: `1px solid ${active ? '#fff' : '#2a2a2a'}`,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

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

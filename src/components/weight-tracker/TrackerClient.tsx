'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveLogs, logout } from '@/app/pulse/actions';
import { computeStreak } from '@/lib/weight-tracker/utils';
import { MONO, ACCENT, BG, BORDER, DIM } from '@/lib/weight-tracker/theme';
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
    const stored = Number(localStorage.getItem('wt_week'));
    return stored >= 1 && stored <= 12 ? stored : 1;
  });
  const [activeTab, setActiveTab] = useState<WorkoutType>('push');
  const [view, setView] = useState<View>('log');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('wt_week', String(activeWeek));
  }, [activeWeek]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  // Close mobile menu on outside tap
  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  const persist = useCallback(
    (newLogs: Logs) => {
      setLogs(newLogs);
      setSaveError(null);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      saveLogs(newLogs).catch(() => {
        setSaveError('Failed to save. Retrying…');
        retryTimeoutRef.current = setTimeout(
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

  function handleExport() {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pulse-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function navigate(v: View) {
    setView(v);
    setMenuOpen(false);
  }

  const hamburgerLineStyle = {
    display: 'block',
    width: '18px',
    height: '1.5px',
    background: DIM,
    borderRadius: '1px',
    transition: 'transform 0.2s, opacity 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#d4d4d4' }}>
      {/* Header */}
      <div
        ref={menuRef}
        style={{ position: 'sticky', top: 0, zIndex: 10, background: BG }}
      >
        <div
          style={{
            borderBottom: `1px solid ${menuOpen ? 'transparent' : BORDER}`,
            padding: '0 1rem',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          {/* Brand */}
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', letterSpacing: '0.08em', color: '#fff', textTransform: 'uppercase', flexShrink: 0 }}>
            Pulse<span style={{ color: ACCENT }}>.</span>
          </span>

          {/* Week + streak */}
          <span style={{ fontFamily: MONO, fontSize: '0.75rem', color: DIM, letterSpacing: '0.05em', flexShrink: 0 }}>
            WK <strong style={{ color: ACCENT, fontWeight: 700 }}>{String(activeWeek).padStart(2, '0')}</strong> / 12
          </span>
          {streak > 0 && (
            <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: '#555', letterSpacing: '0.05em', flexShrink: 0 }}>
              · {streak}WK
            </span>
          )}

          {/* Desktop nav */}
          <nav
            style={{ marginLeft: 'auto', display: 'flex', gap: '1.25rem', alignItems: 'center' }}
            aria-label="Main navigation"
          >
            {/* Nav buttons — hidden on mobile via container query workaround using max-width inline trick */}
            <span style={{ display: 'contents' }} className="pulse-desktop-nav">
              {NAV.map(({ id, label }) => {
                const active = view === id;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
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
              <span style={{ color: '#2a2a2a', paddingBottom: '1px' }}>|</span>
              <button
                onClick={handleExport}
                style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 500, color: DIM, background: 'none', border: 'none', borderBottom: '1px solid transparent', paddingBottom: '1px', cursor: 'pointer', letterSpacing: '0.02em' }}
              >
                Export
              </button>
              <form action={logout} style={{ display: 'inline' }}>
                <button
                  type="submit"
                  style={{ fontFamily: MONO, fontSize: '0.75rem', fontWeight: 500, color: '#444', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.02em', paddingBottom: '1px' }}
                >
                  Sign out
                </button>
              </form>
            </span>

            {/* Hamburger — visible on mobile only */}
            <button
              className="pulse-hamburger"
              onClick={() => setMenuOpen(o => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}
            >
              <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none' }} />
              <span style={{ ...hamburgerLineStyle, opacity: menuOpen ? 0 : 1 }} />
              <span style={{ ...hamburgerLineStyle, transform: menuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none' }} />
            </button>
          </nav>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div
            style={{
              borderBottom: `1px solid ${BORDER}`,
              padding: '0.5rem 0 0.75rem',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {NAV.map(({ id, label }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  style={{
                    fontFamily: MONO,
                    fontSize: '0.9375rem',
                    fontWeight: active ? 700 : 400,
                    color: active ? '#fff' : DIM,
                    background: 'none',
                    border: 'none',
                    borderLeft: `2px solid ${active ? ACCENT : 'transparent'}`,
                    textAlign: 'left',
                    padding: '0.75rem 1.25rem',
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                  }}
                >
                  {label}
                </button>
              );
            })}
            <div style={{ height: '1px', background: '#1a1a1a', margin: '0.25rem 1rem' }} />
            <button
              onClick={() => { handleExport(); setMenuOpen(false); }}
              style={{ fontFamily: MONO, fontSize: '0.875rem', color: DIM, background: 'none', border: 'none', borderLeft: '2px solid transparent', textAlign: 'left', padding: '0.75rem 1.25rem', cursor: 'pointer', letterSpacing: '0.02em' }}
            >
              Export
            </button>
            <form action={logout}>
              <button
                type="submit"
                style={{ fontFamily: MONO, fontSize: '0.875rem', color: '#444', background: 'none', border: 'none', borderLeft: '2px solid transparent', textAlign: 'left', padding: '0.75rem 1.25rem', cursor: 'pointer', letterSpacing: '0.02em', width: '100%' }}
              >
                Sign out
              </button>
            </form>
          </div>
        )}
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
          logs={logs}
        />
      )}
      {view === 'history' && <HistoryView logs={logs} />}
    </div>
  );
}

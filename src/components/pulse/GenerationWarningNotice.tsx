'use client';
import { useLocalStorage } from '@/hooks/pulse/useLocalStorage';
import { WARNING_COPY } from '@/lib/pulse/constants';

interface Props {
    // The active routine id; scopes the per-warning dismiss state, so a freshly
    // regenerated routine surfaces its warnings again.
    routineId: string;
    // Generation warning KEYS from the routine's `warnings` column.
    warnings: string[];
}

// A distinct, dismissible notice for generation duress warnings (copy from
// WARNING_COPY), instead of the warning living forever inside the rationale
// prose. Renders nothing when there are no live (undismissed) warnings.
export default function GenerationWarningNotice({ routineId, warnings }: Props) {
    const [dismissed, setDismissed] = useLocalStorage<string[]>(`pulse:plan-warnings-dismissed:${routineId}`, []);
    const visible = warnings.filter((key) => !dismissed.includes(key));
    if (visible.length === 0) return null;

    return (
        <div className="mb-3 flex flex-col gap-2">
            {visible.map((key) => {
                const copy = WARNING_COPY[key] ?? {
                    title: 'Heads-up',
                    body: 'This plan was generated with a limitation from your equipment or restriction settings.',
                };
                return (
                    <div
                        key={key}
                        className="flex items-start gap-2.5 rounded-xl border p-3"
                        style={{
                            borderColor: 'color-mix(in srgb, var(--color-pulse-warn) 35%, transparent)',
                            background: 'color-mix(in srgb, var(--color-pulse-warn) 11%, var(--color-pulse-surface))',
                        }}>
                        <svg
                            className="mt-px h-4 w-4 shrink-0 text-pulse-warn"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden>
                            <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                        </svg>
                        <div className="min-w-0">
                            <div className="font-pulse text-[0.8rem] font-medium text-pulse-text">{copy.title}</div>
                            <div className="mt-0.5 font-pulse text-[0.76rem] leading-[1.45] text-pulse-dim">
                                {copy.body}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDismissed([...dismissed, key])}
                            aria-label="Dismiss"
                            className="ml-auto shrink-0 cursor-pointer border-none bg-transparent font-pulse text-[0.95rem] text-pulse-muted">
                            ✕
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

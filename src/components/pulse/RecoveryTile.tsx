import type { RecoveryReadout, RecoveryTone } from '@/lib/pulse/utils';
import Why from './Why';

// Dot color per tone. Only watch/easeoff leave green, so the glance stays honest.
const DOT: Record<RecoveryTone, string> = {
    fresh: 'bg-pulse-success',
    ready: 'bg-pulse-success',
    watch: 'bg-pulse-warn',
    easeoff: 'bg-pulse-error',
    none: 'bg-pulse-muted',
};

export default function RecoveryTile({ readout }: { readout: RecoveryReadout }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-pulse-surface p-3.5">
            <span className="inline-flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT[readout.tone]}`} aria-hidden />
                <span className="font-pulse-display text-[1.5rem] font-bold leading-none text-pulse-text">
                    <Why concept="recovery" variant="why">
                        {readout.word}
                    </Why>
                </span>
            </span>
            <span className="mt-1.5 text-center font-pulse text-[0.6rem] leading-tight text-pulse-dim">
                {readout.detail}
            </span>
            <span className="mt-1.5 font-pulse text-[0.6rem] uppercase tracking-[0.09em] text-pulse-muted">
                Recovery
            </span>
        </div>
    );
}

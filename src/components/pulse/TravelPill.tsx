import { usePulse } from '@/context/PulseContext';
import {
    activeTravelProfile,
    defaultProfile,
    travelDaysLeft,
    travelEndedRecently,
} from '@/lib/pulse/utils';
import GenerateRoutineButton from './GenerateRoutineButton';

// Travel mode (#322) Train surface. Two calm states:
//   active   ,a reverts-in-N-days reminder, tap to manage in Profile.
//   ended    ,the post-expiry nudge (the moment expiry matters): you are back
//             on your default gear, offer a one-tap regenerate, or dismiss
//             (which clears the lingering expiry via endTravel).
// Renders nothing the rest of the time.
export default function TravelPill() {
    const { equipmentProfiles, profile, endTravel, navigate } = usePulse();
    const tz = profile.timezone ?? 'UTC';
    const now = new Date().toISOString();
    const overlay = activeTravelProfile(equipmentProfiles, now, tz);
    const def = defaultProfile(equipmentProfiles, profile.active_equipment_profile_id, now, tz);
    const defName = def?.name ?? 'your default';

    if (overlay) {
        const daysLeft = travelDaysLeft(overlay, now, tz);
        return (
            <button
                type="button"
                onClick={() => navigate('profile')}
                className="mb-3 flex w-full items-center gap-2 rounded-2xl border border-pulse-accent/30 bg-pulse-accent/10 px-4 py-2.5 text-left font-pulse text-[0.8125rem] text-pulse-text">
                <span aria-hidden>✈</span>
                <span>
                    Travel mode · reverts to {defName} in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                </span>
            </button>
        );
    }

    const ended = equipmentProfiles.find((p) => travelEndedRecently(p, now, tz));
    if (ended) {
        return (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-pulse-accent/30 bg-pulse-surface px-4 py-2.5">
                <span className="font-pulse text-[0.8125rem] text-pulse-text">
                    <span aria-hidden>✈</span> Travel ended · regenerate your {defName} routine?
                </span>
                <div className="flex items-center gap-2">
                    <GenerateRoutineButton
                        label="Regenerate"
                        className="rounded-lg bg-pulse-accent px-3 py-1.5 font-pulse-body text-[0.8125rem] text-pulse-bg"
                    />
                    <button
                        type="button"
                        onClick={() => void endTravel()}
                        className="font-pulse text-[0.8125rem] text-pulse-dim">
                        Dismiss
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

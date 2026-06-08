import type { TrainingStyle, VarietyPreference, LoadingPreference, RestrictionFlag } from '@/lib/pulse/types';

export const TRAINING_STYLE_OPTIONS: { key: TrainingStyle; label: string; desc: string }[] = [
    { key: 'balanced', label: 'Balanced', desc: 'A bit of everything. Heavy days, hypertrophy days, and a pump day.' },
    { key: 'strength', label: 'Strength', desc: 'Lower reps and heavier loads on the big lifts. Still keeps one lighter day each week.' },
    { key: 'bodybuilding', label: 'Bodybuilding', desc: 'Moderate-to-high reps for size, across every session.' },
    { key: 'powerbuilding', label: 'Powerbuilding', desc: 'A blend: heavy, low-rep work on the main lifts, higher-rep work on the accessories.' },
];

export const VARIETY_OPTIONS: { key: VarietyPreference; label: string; desc: string }[] = [
    { key: 'varied', label: 'Varied', desc: 'Rotate exercises across sessions for fresh stimulus.' },
    { key: 'consistent', label: 'Consistent', desc: 'Keep your main lifts the same each week, rotate the accessories.' },
];

export const LOADING_LEAN_OPTIONS: { key: LoadingPreference; label: string; desc: string }[] = [
    { key: 'barbell', label: 'Barbell', desc: 'Prioritise barbell work: squats, bench, rows, deadlifts.' },
    { key: 'dumbbell', label: 'Dumbbells', desc: 'Prioritise dumbbell exercises across all movement patterns.' },
    { key: 'machine', label: 'Machines', desc: 'Prioritise machine exercises for each slot.' },
    { key: 'cable', label: 'Cables', desc: 'Prioritise cable exercises where available.' },
];

export const RESTRICTION_OPTIONS: { key: RestrictionFlag; label: string; desc: string }[] = [
    { key: 'knee', label: 'Knees', desc: 'Avoid deep squats, lunges, and leg extensions.' },
    { key: 'lower_back', label: 'Lower back', desc: 'Avoid heavy deadlifts, good mornings, and bent-over rows.' },
    { key: 'shoulder', label: 'Shoulders', desc: 'Avoid overhead barbell presses, upright rows, and dips.' },
    { key: 'wrist', label: 'Wrists', desc: 'Avoid straight-bar presses, push-ups, and barbell curls.' },
];

import type { Phase, VolumeEntry, Workout, ScheduleDay, WorkoutType, ExerciseCategory } from './types';

export const PHASES: Phase[] = [
    { weeks: [1, 2, 3], label: 'Phase 1', subtitle: 'Accumulation', rir: [3, 3, 2], color: '#4ade80' },
    { weeks: [4, 5, 6], label: 'Phase 2', subtitle: 'Intensification', rir: [2, 2, 1], color: '#facc15' },
    { weeks: [7, 8, 9], label: 'Phase 3', subtitle: 'Overreach', rir: [1, 1, 0], color: '#f97316' },
    { weeks: [10, 11, 12], label: 'Phase 4', subtitle: 'Peak & Deload', rir: [1, 0, 3], color: '#f43f5e' },
];

export const VOLUME: VolumeEntry[] = [
    { week: 1, sets: 12 },
    { week: 2, sets: 14 },
    { week: 3, sets: 16 },
    { week: 4, sets: 14 },
    { week: 5, sets: 16 },
    { week: 6, sets: 18 },
    { week: 7, sets: 16 },
    { week: 8, sets: 18 },
    { week: 9, sets: 20 },
    { week: 10, sets: 18 },
    { week: 11, sets: 20 },
    { week: 12, sets: 10 },
];

// ── Periodized blocks ────────────────────────────────────────────────────────
// One block per supported length. The program repeats a block indefinitely
// (week 13 of a 12-week block = block 2, week 1), deloading at each block end.
// PROGRAMS[12] is the canonical legacy block (= PHASES / VOLUME above). Other
// lengths follow the same accumulation → intensification → overreach → peak/
// deload shape; 16 also gets a mid-block deload at week 8.
export const PROGRAM_LENGTHS = [8, 10, 12, 16] as const;
export type ProgramLength = (typeof PROGRAM_LENGTHS)[number];

const toVolume = (sets: number[]): VolumeEntry[] => sets.map((s, i) => ({ week: i + 1, sets: s }));

export const PROGRAMS: Record<ProgramLength, { phases: Phase[]; volume: VolumeEntry[] }> = {
    8: {
        phases: [
            { weeks: [1, 2, 3], label: 'Phase 1', subtitle: 'Accumulation', rir: [3, 3, 2], color: '#4ade80' },
            { weeks: [4, 5, 6], label: 'Phase 2', subtitle: 'Intensification', rir: [2, 1, 1], color: '#facc15' },
            { weeks: [7, 8], label: 'Phase 3', subtitle: 'Peak & Deload', rir: [0, 3], color: '#f43f5e' },
        ],
        volume: toVolume([12, 14, 16, 15, 17, 19, 18, 10]),
    },
    10: {
        phases: [
            { weeks: [1, 2, 3], label: 'Phase 1', subtitle: 'Accumulation', rir: [3, 3, 2], color: '#4ade80' },
            { weeks: [4, 5, 6], label: 'Phase 2', subtitle: 'Intensification', rir: [2, 2, 1], color: '#facc15' },
            { weeks: [7, 8, 9], label: 'Phase 3', subtitle: 'Overreach', rir: [1, 1, 0], color: '#f97316' },
            { weeks: [10], label: 'Phase 4', subtitle: 'Deload', rir: [3], color: '#f43f5e' },
        ],
        volume: toVolume([12, 14, 16, 15, 17, 19, 18, 20, 21, 10]),
    },
    12: { phases: PHASES, volume: VOLUME },
    16: {
        phases: [
            { weeks: [1, 2, 3, 4], label: 'Phase 1', subtitle: 'Accumulation', rir: [3, 3, 2, 2], color: '#4ade80' },
            { weeks: [5, 6, 7, 8], label: 'Phase 2', subtitle: 'Intensification', rir: [2, 1, 1, 3], color: '#facc15' },
            { weeks: [9, 10, 11, 12], label: 'Phase 3', subtitle: 'Overreach', rir: [2, 1, 1, 0], color: '#f97316' },
            {
                weeks: [13, 14, 15, 16],
                label: 'Phase 4',
                subtitle: 'Peak & Deload',
                rir: [1, 1, 0, 3],
                color: '#f43f5e',
            },
        ],
        volume: toVolume([12, 14, 16, 18, 16, 18, 20, 10, 16, 18, 20, 22, 18, 20, 22, 10]),
    },
};

// Resolve a block by length, falling back to the canonical 12-week block.
export function buildProgram(weeks: number): { phases: Phase[]; volume: VolumeEntry[] } {
    return PROGRAMS[weeks as ProgramLength] ?? PROGRAMS[12];
}

// Legacy push/pull/legs workout definitions used by the program view.
// New granular types (chest, back, shoulders, arms) fall back to their
// parent push/pull workout definitions.
export const WORKOUTS: Record<WorkoutType, Workout> = {
    push: {
        label: 'PUSH',
        icon: '△',
        color: '#f97316',
        description: 'Chest · Shoulders · Triceps',
        exercises: [
            {
                name: 'Dumbbell Bench Press',
                sets: '3–4',
                reps: '8–12',
                load: 'Start 18–20 kg per dumbbell',
                note: 'Primary chest compound. Full ROM, slow eccentric (3s down).',
            },
            {
                name: 'Incline Dumbbell Press',
                sets: '3',
                reps: '10–14',
                load: '14–16 kg per dumbbell',
                note: 'Upper chest emphasis. 30–45° incline on bench.',
            },
            {
                name: 'Dumbbell Lateral Raise',
                sets: '3–4',
                reps: '12–16',
                load: '7–9 kg per dumbbell',
                note: 'Slight forward lean, lead with elbows. Constant tension.',
            },
            {
                name: 'Dumbbell Overhead Press',
                sets: '3',
                reps: '8–12',
                load: '16–18 kg per dumbbell seated',
                note: 'Brace core. Stop just short of lockout.',
            },
            {
                name: 'Dumbbell Tricep Overhead Extension',
                sets: '3',
                reps: '10–15',
                load: '14–16 kg single dumbbell',
                note: 'Long-head stretch is key. Full extension at top.',
            },
            {
                name: 'Diamond / Close-Grip Push-Up',
                sets: '2–3',
                reps: 'To RIR',
                load: 'Bodyweight; add dumbbell on back to progress',
                note: 'Finisher. Elbows track back, not flared.',
            },
        ],
    },
    pull: {
        label: 'PULL',
        icon: '▽',
        color: '#38bdf8',
        description: 'Back · Biceps · Rear Delts',
        exercises: [
            {
                name: 'Dumbbell Bent-Over Row',
                sets: '3–4',
                reps: '8–12',
                load: '20–23 kg per dumbbell',
                note: 'Drive elbow back and up. Pause at top. Hinge hips to 45°.',
            },
            {
                name: 'Dumbbell Single-Arm Row',
                sets: '3',
                reps: '10–14',
                load: '23–24kg',
                note: 'Knee and hand on bench. Pull to hip, not armpit.',
            },
            {
                name: 'Dumbbell Reverse Fly',
                sets: '3',
                reps: '12–16',
                load: '7–9 kg per dumbbell',
                note: 'Rear delt isolation. Hinge forward, slight bend in elbows.',
            },
            {
                name: 'Dumbbell Bicep Curl',
                sets: '3',
                reps: '10–14',
                load: '14–16 kg per dumbbell alternating',
                note: 'Supinate at top. No swinging. Full eccentric.',
            },
            {
                name: 'Dumbbell Hammer Curl',
                sets: '2–3',
                reps: '10–14',
                load: '14–16 kg per dumbbell',
                note: 'Neutral grip targets brachialis. Keep elbows fixed.',
            },
            {
                name: 'Dumbbell Face Pull (Bent-Over)',
                sets: '2',
                reps: '15–20',
                load: '7–9 kg per dumbbell',
                note: 'External rotate at end. High-rep, light weight.',
            },
        ],
    },
    legs: {
        label: 'LEGS',
        icon: '◇',
        color: '#a78bfa',
        description: 'Quads · Hamstrings · Glutes · Calves',
        exercises: [
            {
                name: 'Dumbbell Goblet Squat',
                sets: '4',
                reps: '10–15',
                load: '24 kg dumbbell at chest',
                note: 'Primary quad compound. Chest up, depth below parallel.',
            },
            {
                name: 'Dumbbell Romanian Deadlift',
                sets: '3–4',
                reps: '8–12',
                load: '20–23 kg per dumbbell',
                note: 'Hip-hinge. Feel hamstring stretch. Soft knee bend.',
            },
            {
                name: 'Dumbbell Bulgarian Split Squat',
                sets: '3',
                reps: '10–12 per leg',
                load: '14–18 kg per dumbbell',
                note: 'Rear foot elevated. Most demanding exercise. Rest 2–3 min.',
            },
            {
                name: 'Dumbbell Sumo Squat',
                sets: '3',
                reps: '12–15',
                load: '24 kg single dumbbell',
                note: 'Wide stance, toes out. Targets inner quad and glutes.',
            },
            {
                name: 'Dumbbell Leg Curl (Lying)',
                sets: '3',
                reps: '12–15',
                load: '11–14kg between feet',
                note: 'Prone on bench. Slow eccentric. Squeeze at top.',
            },
            {
                name: 'Dumbbell Calf Raise',
                sets: '3',
                reps: '15–20',
                load: '18–20kg per hand on step',
                note: 'Full ROM. Pause at bottom. High reps for calf growth.',
            },
        ],
    },
    // Granular types alias into their parent push/pull definitions
    get chest() {
        return this.push;
    },
    get shoulders() {
        return this.push;
    },
    get back() {
        return this.pull;
    },
    get arms() {
        return this.pull;
    },
    // Upper/Lower/Full Body alias into push (placeholder until dedicated workouts are added)
    get upper() {
        return this.push;
    },
    get lower() {
        return this.legs;
    },
    get full_body() {
        return this.push;
    },
};

export const WEEK_NOTES: Record<number, string> = {
    1: "Focus on technique. Don't push RIR limits. Learn the movements.",
    2: 'Add 1–2 reps or small weight jumps vs week 1.',
    3: 'Last week of phase 1. Push to RIR 2 on final sets.',
    4: 'Phase 2 starts. Volume drops, intensity rises. Add weight to every lift.',
    5: 'Continue adding load. RIR 2 is challenging now.',
    6: 'Highest intensity so far. RIR 1 on main lifts only.',
    7: 'Phase 3. Volume peaks. This is hard by design.',
    8: "Highest volume week. You may feel fatigued. That's the point.",
    9: 'RIR 0 on main compounds. Use a safety setup where needed.',
    10: 'Volume starts tapering. Keep intensity high.',
    11: 'Last true overload week. Push hard.',
    12: 'Deload. 50% volume, RIR 3. Let your body recover.',
};

export const SCHEDULE: ScheduleDay[] = [
    { day: 'Mon', type: 'push' },
    { day: 'Tue', type: 'pull' },
    { day: 'Wed', type: 'legs' },
    { day: 'Thu', type: 'rest' },
    { day: 'Fri', type: 'push' },
    { day: 'Sat', type: 'pull' },
    { day: 'Sun', type: 'legs' },
];

// Weekly working-set targets per muscle [min, max], hypertrophy-oriented. Tuned for
// the fractional-set attribution (each set credits its primary 1.0 plus bucketed
// pattern secondaries), so bands sit higher than direct-only counting — arms and
// shoulders most, since they accrue large secondary inflow from pressing/pulling.
// Starting bands toward the MEV/MAV landmarks; tune against logged RIR. 'other' has
// no target. Goal-agnostic v1.
export const VOLUME_TARGETS: Partial<Record<ExerciseCategory, [number, number]>> = {
    chest: [12, 18],
    back: [14, 22],
    legs: [14, 20],
    shoulders: [14, 20],
    glutes: [12, 20],
    biceps: [10, 16],
    triceps: [10, 16],
    calves: [10, 18],
    abs: [6, 12],
};

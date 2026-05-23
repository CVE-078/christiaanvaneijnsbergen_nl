import type { Phase, VolumeEntry, Workout, ScheduleDay } from './types';

export const PHASES: Phase[] = [
  { weeks: [1, 2, 3],   label: 'Phase 1', subtitle: 'Accumulation',    rir: [3, 3, 2], color: '#4ade80' },
  { weeks: [4, 5, 6],   label: 'Phase 2', subtitle: 'Intensification', rir: [2, 2, 1], color: '#facc15' },
  { weeks: [7, 8, 9],   label: 'Phase 3', subtitle: 'Overreach',       rir: [1, 1, 0], color: '#f97316' },
  { weeks: [10, 11, 12],label: 'Phase 4', subtitle: 'Peak & Deload',   rir: [1, 0, 3], color: '#f43f5e' },
];

export const VOLUME: VolumeEntry[] = [
  { week: 1,  sets: 12 }, { week: 2,  sets: 14 }, { week: 3,  sets: 16 },
  { week: 4,  sets: 14 }, { week: 5,  sets: 16 }, { week: 6,  sets: 18 },
  { week: 7,  sets: 16 }, { week: 8,  sets: 18 }, { week: 9,  sets: 20 },
  { week: 10, sets: 18 }, { week: 11, sets: 20 }, { week: 12, sets: 10 },
];

export const WORKOUTS: Record<string, Workout> = {
  push: {
    label: 'PUSH', icon: '△', color: '#f97316', description: 'Chest · Shoulders · Triceps',
    exercises: [
      { name: 'Dumbbell Bench Press',          sets: '3–4', reps: '8–12',  load: 'Start 18–20kg per DB',          note: 'Primary chest compound. Full ROM, slow eccentric (3s down).' },
      { name: 'Incline DB Press',              sets: '3',   reps: '10–14', load: '14–16kg per DB',                note: 'Upper chest emphasis. 30–45° incline on bench.' },
      { name: 'DB Lateral Raise',             sets: '3–4', reps: '12–16', load: '7–9kg per DB',                  note: 'Slight forward lean, lead with elbows. Constant tension.' },
      { name: 'DB Overhead Press',             sets: '3',   reps: '8–12',  load: '16–18kg per DB seated',         note: 'Brace core. Stop just short of lockout.' },
      { name: 'DB Tricep Overhead Extension', sets: '3',   reps: '10–15', load: '14–16kg single DB',             note: 'Long-head stretch is key. Full extension at top.' },
      { name: 'Diamond / Close-Grip Push-Up', sets: '2–3', reps: 'To RIR', load: 'Bodyweight; add DB on back to progress', note: 'Finisher. Elbows track back, not flared.' },
    ],
  },
  pull: {
    label: 'PULL', icon: '▽', color: '#38bdf8', description: 'Back · Biceps · Rear Delts',
    exercises: [
      { name: 'DB Bent-Over Row',         sets: '3–4', reps: '8–12',  load: '20–23kg per DB',              note: 'Drive elbow back and up. Pause at top. Hinge hips to 45°.' },
      { name: 'DB Single-Arm Row',        sets: '3',   reps: '10–14', load: '23–24kg',                     note: 'Knee and hand on bench. Pull to hip, not armpit.' },
      { name: 'DB Reverse Fly',           sets: '3',   reps: '12–16', load: '7–9kg per DB',                note: 'Rear delt isolation. Hinge forward, slight bend in elbows.' },
      { name: 'DB Bicep Curl',            sets: '3',   reps: '10–14', load: '14–16kg per DB alternating',  note: 'Supinate at top. No swinging. Full eccentric.' },
      { name: 'DB Hammer Curl',           sets: '2–3', reps: '10–14', load: '14–16kg per DB',              note: 'Neutral grip targets brachialis. Keep elbows fixed.' },
      { name: 'DB Face Pull (bent-over)', sets: '2',   reps: '15–20', load: '7–9kg per DB',                note: 'External rotate at end. High-rep, light weight.' },
    ],
  },
  legs: {
    label: 'LEGS', icon: '◇', color: '#a78bfa', description: 'Quads · Hamstrings · Glutes · Calves',
    exercises: [
      { name: 'DB Goblet Squat',             sets: '4',   reps: '10–15',        load: '24kg DB at chest',             note: 'Primary quad compound. Chest up, depth below parallel.' },
      { name: 'DB Romanian Deadlift',        sets: '3–4', reps: '8–12',         load: '20–23kg per DB',               note: 'Hip-hinge. Feel hamstring stretch. Soft knee bend.' },
      { name: 'DB Bulgarian Split Squat',    sets: '3',   reps: '10–12 per leg',load: '14–18kg per DB',               note: 'Rear foot elevated. Most demanding exercise. Rest 2–3 min.' },
      { name: 'DB Sumo Squat',               sets: '3',   reps: '12–15',        load: '24kg single DB',               note: 'Wide stance, toes out. Targets inner quad and glutes.' },
      { name: 'DB Leg Curl (lying on bench)',sets: '3',   reps: '12–15',        load: '11–14kg between feet',         note: 'Prone on bench. Slow eccentric. Squeeze at top.' },
      { name: 'DB Calf Raise',               sets: '3',   reps: '15–20',        load: '18–20kg per hand on step',     note: 'Full ROM. Pause at bottom. High reps for calf growth.' },
    ],
  },
};

export const WEEK_NOTES: Record<number, string> = {
  1:  'Focus on technique. Don\'t push RIR limits. Learn the movements.',
  2:  'Add 1–2 reps or small weight jumps vs week 1.',
  3:  'Last week of phase 1. Push to RIR 2 on final sets.',
  4:  'Phase 2 starts. Volume drops, intensity rises. Add weight to every lift.',
  5:  'Continue adding load. RIR 2 is challenging now.',
  6:  'Highest intensity so far. RIR 1 on main lifts only.',
  7:  'Phase 3. Volume peaks. This is hard by design.',
  8:  'Highest volume week. You may feel fatigued. That\'s the point.',
  9:  'RIR 0 on main compounds. Use a safety setup where needed.',
  10: 'Volume starts tapering. Keep intensity high.',
  11: 'Last true overload week. Push hard.',
  12: 'Deload. 50% volume, RIR 3. Let your body recover.',
};

export const SCHEDULE: ScheduleDay[] = [
  { day: 'Mon', type: 'push' }, { day: 'Tue', type: 'pull' }, { day: 'Wed', type: 'legs' },
  { day: 'Thu', type: 'rest' }, { day: 'Fri', type: 'push' }, { day: 'Sat', type: 'pull' }, { day: 'Sun', type: 'legs' },
];

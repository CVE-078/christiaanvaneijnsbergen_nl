// Evidence sweep for Tier-2 Spec 2-vs-Spec 3: generate every program STYLE across three
// equipment tiers and report, per config, the per-muscle weekly DIRECT-set volume vs
// target (volume signal -> gap-fill / Spec 3) and the side-vs-rear delt balance plus any
// same-head shoulder_iso clustering (variety signal -> variety scoring / Spec 2). Read-
// only analysis; touches no engine code. Uses the local catalog cache, backfilling
// primary_muscle via deriveSeedPrimaryMuscle (mirrors the migration seed).
//
//   bun run scripts/muscle-sweep.ts
import { existsSync, readFileSync } from 'node:fs';
import {
    generateRoutine,
    resolveStyle,
    usablePool,
    STYLES,
    type ExerciseMeta,
} from '@/lib/pulse/generation';
import {
    weeklyMuscleSets,
    muscleCoverageGaps,
    deriveSeedPrimaryMuscle,
    MUSCLE_SET_TARGETS,
} from '@/lib/pulse/muscleVolume';
import { MUSCLES } from '@/lib/pulse/types';
import type { EquipmentKey, MovementPattern } from '@/lib/pulse/types';
import type { OnboardingAnswers } from '@/lib/pulse/recommendation';

const cachePath = new URL('./.catalog-cache.json', import.meta.url);
if (!existsSync(cachePath)) throw new Error('No catalog cache; run gen-routine.ts --refresh first');
const rawPool: ExerciseMeta[] = JSON.parse(readFileSync(cachePath, 'utf8'));
for (const e of rawPool) {
    if (!e.primary_muscle) e.primary_muscle = deriveSeedPrimaryMuscle(e.movement_pattern, e.substitution_class, e.name ?? '');
}

const TIERS: Array<{ name: string; equipment: EquipmentKey[] }> = [
    { name: 'dumbbell', equipment: ['dumbbells', 'bench'] },
    { name: 'home', equipment: ['dumbbells', 'barbell', 'bench', 'pull_up_bar'] },
    { name: 'gym', equipment: ['dumbbells', 'barbell', 'bench', 'cables', 'machines', 'pull_up_bar'] },
];
const DEFAULT_DAYS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

// Aggregates across all configs.
const underTargetCount: Record<string, number> = {}; // muscle/target -> # configs under min
const sumPct: Record<string, number> = {}; // muscle/target -> sum of (direct/min) for averaging
let configs = 0;
let deltImbalanceConfigs = 0; // rear_delts < 0.5 * side_delts AND a rear option was usable
let clusterConfigs = 0; // a session picked 2 shoulder_iso of the SAME head with the other head usable

const rows: string[] = [];
let n = 0;
for (const [countStr, styles] of Object.entries(STYLES)) {
    const count = Number(countStr);
    const days = DEFAULT_DAYS[count];
    for (const style of styles) {
        for (const tier of TIERS) {
            const equipment = new Set(tier.equipment);
            const answers: OnboardingAnswers = { equipment, experience: 'intermediate', goal: 'build_muscle', days: count as OnboardingAnswers['days'], gender: null };
            const usable = usablePool(rawPool, equipment, new Set());
            const bp = generateRoutine({
                style: resolveStyle(style.key, count),
                answers,
                sessionTime: '45–60 min',
                trainingDays: days,
                pool: rawPool,
                anchorDow: days[0],
                makeGroupId: () => `ss-${++n}`,
            });
            configs++;
            const counts = weeklyMuscleSets(bp, rawPool);
            const gaps = muscleCoverageGaps(bp, rawPool);
            for (const g of gaps) underTargetCount[g.target] = (underTargetCount[g.target] ?? 0) + 1;
            for (const target of Object.keys(MUSCLE_SET_TARGETS)) {
                const min = (MUSCLE_SET_TARGETS as Record<string, { min: number }>)[target].min;
                const direct = target === 'back' ? counts.lats.direct + counts.upper_back.direct : counts[target as (typeof MUSCLES)[number]].direct;
                sumPct[target] = (sumPct[target] ?? 0) + direct / min;
            }
            // Delt-head balance (the one pattern with an intra-pattern muscle choice).
            const side = counts.side_delts.direct;
            const rear = counts.rear_delts.direct;
            const rearUsable = usable.some((e) => e.substitution_class === 'rear_delt_isolation');
            const imbalance = rearUsable && rear < 0.5 * side;
            if (imbalance) deltImbalanceConfigs++;
            // Same-head clustering: per session, 2 shoulder_iso picks of the same head.
            const byId = new Map(rawPool.map((e) => [e.id, e]));
            let clustered = false;
            for (const s of bp.schedule) {
                const heads = bp.exercises
                    .filter((e) => e.workout_type === s.workout_type && e.variant === s.variant)
                    .map((e) => byId.get(e.exercise_id))
                    .filter((m) => m?.movement_pattern === ('shoulder_iso' as MovementPattern))
                    .map((m) => m?.primary_muscle);
                if (heads.length >= 2 && new Set(heads).size === 1 && rearUsable) clustered = true;
            }
            if (clustered) clusterConfigs++;
            rows.push(
                `${(style.key + ' / ' + tier.name).padEnd(28)} side ${side} rear ${rear}${imbalance ? ' [DELT-IMBALANCE]' : ''}${clustered ? ' [CLUSTER]' : ''}  gaps: ${gaps.map((g) => `${g.target} ${Math.round(g.ratio * 100)}%`).join(', ') || '(none)'}`,
            );
        }
    }
}

console.log('=== per-config (45-60 min, intermediate, build_muscle) ===');
for (const r of rows) console.log(r);
console.log(`\n=== aggregate over ${configs} configs ===`);
console.log('Under-target frequency (volume signal -> Spec 3 gap-fill):');
for (const [m, c] of Object.entries(underTargetCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m.padEnd(12)} under target in ${c}/${configs} configs  (avg coverage ${Math.round((sumPct[m] / configs) * 100)}%)`);
}
console.log('\nMuscles never under target:');
console.log('  ' + Object.keys(MUSCLE_SET_TARGETS).filter((m) => !underTargetCount[m]).join(', '));
console.log(`\nDelt-head imbalance (rear < 50% of side, rear option usable) -> variety signal / Spec 2: ${deltImbalanceConfigs}/${configs} configs`);
console.log(`Same-head shoulder_iso clustering (2 same head in a session, other head usable): ${clusterConfigs}/${configs} configs`);

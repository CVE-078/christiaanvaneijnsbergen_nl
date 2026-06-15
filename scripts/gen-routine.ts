// Generate a routine against the REAL seeded catalog from a config, and print it.
// Mirrors generateAndSaveRoutine's pool load + input construction (no save).
//
//   bun run scripts/gen-routine.ts \
//     --equipment dumbbells,bench --experience intermediate --goal build_muscle \
//     --days mon,wed,sat --time 30 --style fb-3 --training-style balanced \
//     --variety consistent --priority balanced
//
// Flags (all optional; defaults shown):
//   --equipment   dumbbells,bench        comma list of: dumbbells,barbell,bench,cables,machines,pull_up_bar
//   --experience  intermediate           beginner | intermediate | advanced
//   --goal        build_muscle           build_muscle | lose_fat | general_fitness
//   --days        mon,wed,fri            weekday names OR a count (e.g. 3); count uses a default spread
//   --time        30                     30 | 45 | 60 | 90
//   --style       (recommendStyle)       explicit style key (e.g. fb-3, ppl-3, ul-classic-4); --list-styles to see all
//   --split       -                      full_body shortcut: picks fb-<count> when it exists
//   --training-style balanced            balanced | strength | bodybuilding | powerbuilding
//   --variety     varied                 varied | consistent
//   --priority    balanced               balanced | chest | back | shoulders | arms | quads | glutes | ...
//   --loading     none                   none | dumbbell | barbell | machine | cable
//   --restrictions none                  none | comma list of: knee,lower_back,shoulder,wrist
//   --refresh                            re-pull the catalog from Supabase (otherwise uses the local cache)
//   --list-styles                        print available style keys per day-count and exit
import { SQL } from 'bun';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
    generateRoutine,
    resolveStyle,
    recommendStyle,
    resolvePriority,
    usablePool,
    STYLES,
    type ExerciseMeta,
} from '@/lib/pulse/generation';
import { validateProgram } from '@/lib/pulse/programValidation';
import type { OnboardingAnswers } from '@/lib/pulse/recommendation';

const argv = process.argv.slice(2);
const args: Record<string, string | boolean> = {};
for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = true; }
}
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

if (args['list-styles']) {
    for (const [count, styles] of Object.entries(STYLES)) {
        console.log(`${count}-day: ${styles.map((s) => s.key).join(', ')}`);
    }
    process.exit(0);
}

const DAY_NUM: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DEFAULT_DAYS: Record<number, number[]> = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

const equipment = new Set(str(args.equipment, 'dumbbells,bench').split(',').map((s) => s.trim())) as OnboardingAnswers['equipment'];
const experience = str(args.experience, 'intermediate') as OnboardingAnswers['experience'];
const goal = str(args.goal, 'build_muscle') as OnboardingAnswers['goal'];
const time = str(args.time, '30');
const sessionTime = time.startsWith('30') ? '~30 min' : time.startsWith('90') ? '90+ min' : '45–60 min';

const daysArg = str(args.days, 'mon,wed,fri');
let trainingDays = /^\d+$/.test(daysArg)
    ? (DEFAULT_DAYS[Number(daysArg)] ?? DEFAULT_DAYS[3])
    : daysArg.split(',').map((d) => DAY_NUM[d.trim().toLowerCase()]).filter((n) => n !== undefined);
trainingDays = [...trainingDays].sort((a, b) => a - b);
const count = trainingDays.length;

const styleKey = args.style
    ? str(args.style)
    : args.split === 'full_body' && STYLES[count]?.some((s) => s.key === `fb-${count}`)
      ? `fb-${count}`
      : recommendStyle(count);
const style = resolveStyle(styleKey, count);

const trainingStyle = str(args['training-style'], 'balanced') as Parameters<typeof generateRoutine>[0]['trainingStyle'];
const variety = str(args.variety, 'varied') as Parameters<typeof generateRoutine>[0]['varietyPreference'];
const priority = resolvePriority(str(args.priority, 'balanced') as Parameters<typeof resolvePriority>[0]);
const loadingRaw = str(args.loading, 'none');
const loadingLean = loadingRaw === 'none' ? undefined : (loadingRaw as Parameters<typeof generateRoutine>[0]['loadingLean']);
const restrRaw = str(args.restrictions, 'none');
const restrictions = (restrRaw === 'none' ? [] : restrRaw.split(',').map((s) => s.trim())) as Parameters<typeof generateRoutine>[0]['restrictions'];

// --- catalog (cached locally; --refresh re-pulls from Supabase) ---
const cachePath = new URL('./.catalog-cache.json', import.meta.url);
let pool: ExerciseMeta[];
if (existsSync(cachePath) && !args.refresh) {
    pool = JSON.parse(readFileSync(cachePath, 'utf8'));
} else {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^SUPABASE_DB_URL=(.*)$/m);
    if (!m) throw new Error('SUPABASE_DB_URL not found in .env.local');
    let url = m[1].trim();
    if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) url = url.slice(1, -1);
    const sql = new SQL(url);
    const rows = (await sql`
        select id, name, category, equipment, movement_pattern, is_compound, fatigue,
               substitution_class, unilateral, contraindications, difficulty
        from exercises where user_id is null`) as Array<Record<string, unknown>>;
    await sql.end();
    pool = rows.map((row) => ({
        id: row.id as string,
        name: row.name as string,
        category: row.category as ExerciseMeta['category'],
        equipment: (row.equipment as ExerciseMeta['equipment']) ?? [],
        movement_pattern: row.movement_pattern as ExerciseMeta['movement_pattern'],
        is_compound: row.is_compound as boolean,
        substitution_class: (row.substitution_class as string | null) ?? null,
        unilateral: (row.unilateral as boolean | null) ?? false,
        contraindications: (row.contraindications as ExerciseMeta['contraindications']) ?? [],
        ...(row.fatigue !== null ? { fatigue: row.fatigue as number } : {}),
        ...(row.difficulty !== null ? { difficulty: row.difficulty as ExerciseMeta['difficulty'] } : {}),
    }));
    writeFileSync(cachePath, JSON.stringify(pool));
}

const answers: OnboardingAnswers = { equipment, experience, goal, days: count as OnboardingAnswers['days'], gender: null };
let n = 0;
const blueprint = generateRoutine({
    style, answers, sessionTime, trainingDays, pool, priority, trainingStyle,
    varietyPreference: variety, loadingLean, restrictions, anchorDow: trainingDays[0],
    makeGroupId: () => `ss-${++n}`,
});

const byId = new Map(pool.map((e) => [e.id, e]));
const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const title = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const EQUIP_LABEL: Record<string, string> = {
    dumbbells: 'Dumbbells', barbell: 'Barbell', bench: 'Bench', cables: 'Cables', machines: 'Machines', pull_up_bar: 'Pull-Up Bar',
};
console.log(
    [
        '',
        `Equipment:        ${[...equipment].map((e) => EQUIP_LABEL[e] ?? title(e)).join(', ')}`,
        `Experience:       ${title(experience)}`,
        `Goal:             ${title(goal)}`,
        `Days:             ${trainingDays.map((d) => dows[d]).join(', ')} (${count} days)`,
        `Session length:   ${sessionTime}`,
        `Split / style:    ${style.name} (${style.key})`,
        `Training style:   ${title(trainingStyle ?? 'balanced')}`,
        `Variety:          ${title(variety ?? 'varied')}`,
        `Priority muscle:  ${title(str(args.priority, 'balanced'))}`,
        ...(loadingLean ? [`Loading lean:     ${title(loadingLean)}`] : []),
        ...(restrictions && restrictions.length ? [`Restrictions:     ${restrictions.map(title).join(', ')}`] : []),
        `Catalog:          ${pool.length} exercises`,
    ].join('\n'),
);
for (const s of blueprint.schedule) {
    const exs = blueprint.exercises
        .filter((e) => e.workout_type === s.workout_type && e.variant === s.variant)
        .sort((a, b) => a.order - b.order);
    const compounds = exs.filter((e) => byId.get(e.exercise_id)?.is_compound).length;
    console.log(
        `\n=== ${dows[s.day_of_week]} — ${s.workout_type}${s.variant ? ' ' + s.variant : ''}${s.label ? ' (' + s.label + ')' : ''} — ${exs.length} ex, ${compounds} compound / ${exs.length - compounds} iso ===`,
    );
    for (const e of exs) {
        const meta = byId.get(e.exercise_id);
        const ss = e.superset_group_id ? `  [superset ${e.superset_group_id}]` : '';
        console.log(
            `  ${e.order + 1}. ${meta?.name ?? e.exercise_id} — ${e.sets}x${e.reps} (${meta?.movement_pattern}, ${meta?.is_compound ? 'compound' : 'iso'})${ss}`,
        );
    }
}
const usable = usablePool(pool, equipment, new Set(restrictions));
const warnings = [...blueprint.warnings, ...validateProgram(blueprint, usable).filter((w) => !blueprint.warnings.includes(w))];
console.log(`\n=== warnings: ${warnings.length ? warnings.join(', ') : '(none)'} ===`);

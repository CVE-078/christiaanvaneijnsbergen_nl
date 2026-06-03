-- Exercise instructions seed data.
-- Apply via the Supabase SQL Editor AFTER 2026-05-31-exercise-instructions.sql.
-- Idempotent: ON CONFLICT (exercise_id) DO NOTHING. Rows whose exercise name
-- does not match a global exercise (user_id IS NULL) are simply skipped.

-- Exercise instructions seed
-- Run AFTER 2026-05-31-exercise-instructions.sql
-- Idempotent: ON CONFLICT DO NOTHING

-- ── CHEST ─────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts','Core'],
ARRAY['Retract and depress your shoulder blades before unracking',
      'Lower the bar to your lower chest with elbows at 45–75° from your torso',
      'Drive your feet into the floor and press the bar in a slight arc back toward your face']
FROM exercises WHERE name = 'Barbell Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Retract shoulder blades — imagine pinching a pencil between them',
      'Keep a slight arch in your lower back, feet flat on the floor',
      'Lower dumbbells to chest level, elbows at 45–75°, then press up and in']
FROM exercises WHERE name = 'Dumbbell Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Upper Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Set bench to 30–45° — steeper angles shift emphasis to shoulders not chest',
      'Lower dumbbells to your upper chest, elbows at 45–75°',
      'Press up and slightly inward, squeeze chest at the top']
FROM exercises WHERE name = 'Incline Dumbbell Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Upper Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Set bench to 30–45°',
      'Grip just outside shoulder width, lower bar to upper chest',
      'Keep elbows tucked at 45–75°, drive bar up in a slight arc']
FROM exercises WHERE name = 'Incline Barbell Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts','Biceps'],
ARRAY['Maintain a soft, fixed bend in your elbows throughout — this is not a press',
      'Open your arms wide as if hugging a barrel, feel the chest stretch',
      'Squeeze your chest to bring arms back together, pause at the top']
FROM exercises WHERE name = 'Chest Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts'],
ARRAY['Set cables at chest height; lean forward slightly for better stretch',
      'Keep a fixed elbow bend — squeeze chest to draw hands together',
      'Control the return: let the cable stretch your chest fully']
FROM exercises WHERE name = 'Cable Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts','Core'],
ARRAY['Form a rigid plank from head to heels — no sagging hips',
      'Hands slightly wider than shoulder width, lower chest until nearly touching floor',
      'Spread the floor apart with your hands as you push up']
FROM exercises WHERE name = 'Push-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Adjust seat so handles align with your lower chest',
      'Press forward and slightly inward, do not lock elbows out at the top',
      'Control the return — do not let the weight stack touch between reps']
FROM exercises WHERE name = 'Machine Chest Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lower Chest','Triceps'], ARRAY['Core'],
ARRAY['Feet secured on decline bench, shoulder blades pinched back',
      'Lower bar to lower chest with controlled tempo',
      'Press up in a slight arc, keep core braced throughout']
FROM exercises WHERE name = 'Decline Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest'], ARRAY['Front Delts'],
ARRAY['Adjust pads to align with your mid-chest, elbows at 90°',
      'Drive the pads together using your chest — not your arms',
      'Hold the peak contraction for a beat, then control the return']
FROM exercises WHERE name = 'Pec Deck' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Chest','Triceps'], ARRAY['Front Delts'],
ARRAY['Feet flat, neutral spine, same technique as free-weight bench',
      'Lower bar to lower chest with elbows at 45–75°',
      'The fixed bar path removes balance demand — focus on chest contraction']
FROM exercises WHERE name = 'Smith Machine Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── BACK ──────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps','Rear Delts'], ARRAY['Biceps','Core','Glutes'],
ARRAY['Brace your core and push your hips back — flat back throughout',
      'Drive elbows toward hips, not just pull with biceps',
      'Full stretch at the bottom: let your shoulder blades separate',
      'Squeeze your lats hard at the top, keep hips from rising']
FROM exercises WHERE name = 'Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts','Core'],
ARRAY['Dead hang first — full shoulder extension at the bottom',
      'Drive your elbows toward your hips, not just pull with your hands',
      'Chin clears the bar — no kipping unless programmed',
      'Lower slowly for maximum muscle stimulus']
FROM exercises WHERE name = 'Pull-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts'],
ARRAY['Lean back slightly — about 10–15°, not straight upright',
      'Pull bar to your upper chest with elbows driving down and back',
      'Let the bar rise slowly on the return for full lat stretch']
FROM exercises WHERE name = 'Lat Pulldown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Hinge until torso is 45–60° from horizontal, brace core',
      'Drive elbows back and up past your torso, squeeze shoulder blades together',
      'Control the descent — do not let the bar pull you forward']
FROM exercises WHERE name = 'Barbell Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Sit tall, feet flat, slight lean back is fine',
      'Pull handle to your lower abdomen — elbows stay close to body',
      'Squeeze your lats and shoulder blades together at full contraction']
FROM exercises WHERE name = 'Seated Cable Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Support non-working hand and knee on a bench',
      'Row the dumbbell to your hip — elbow drives up and back',
      'Keep hips square, do not rotate to cheat the weight up']
FROM exercises WHERE name = 'Dumbbell Single-Arm Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Hinge at hips, flat back, both hands on the bar',
      'Row dumbbells to hip level, driving elbows back',
      'Squeeze shoulder blades at the top, lower with control']
FROM exercises WHERE name = 'Dumbbell Bent-Over Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Slight forward lean at the hips',
      'Raise dumbbells to the side with a slight backward arc — lead with elbows',
      'Squeeze rear delts at the top, control the return']
FROM exercises WHERE name = 'Dumbbell Reverse Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Set cable at face height, use a rope attachment',
      'Pull toward your face, elbows flaring out and back',
      'External rotate at the end — thumbs point behind you']
FROM exercises WHERE name = 'Face Pull' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rotator Cuff'],
ARRAY['Hinge forward and pull dumbbells to face height',
      'Elbows flare out and slightly back at the top',
      'External rotate: thumbs point behind you at peak contraction']
FROM exercises WHERE name = 'Dumbbell Face Pull (Bent-Over)' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rear Delts','Traps'], ARRAY['Rhomboids'],
ARRAY['Lie face-down on an incline bench',
      'Raise arms to the side with a slight backward arc',
      'Squeeze shoulder blades hard at the top']
FROM exercises WHERE name = 'Rear Delt Fly' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Pad chest on the machine, neutral or pronated grip',
      'Row handles to your lower rib cage',
      'Full lat stretch at the bottom between every rep']
FROM exercises WHERE name = 'Chest-Supported Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Set cable at or above eye level, arms straight',
      'Pull bar to your thighs with straight arms — elbows lead',
      'Squeeze lats hard at the bottom, return with full stretch']
FROM exercises WHERE name = 'Straight-Arm Pulldown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps','Rear Delts'], ARRAY['Biceps','Core'],
ARRAY['Bar set at knee height, similar setup to a deadlift',
      'Short range of motion — focus on upper back and lats',
      'Brace hard before each rep, flat back throughout']
FROM exercises WHERE name = 'Rack Pull' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Traps'], ARRAY['Biceps','Rear Delts'],
ARRAY['Set the bar at waist height; load one side and brace it against something',
      'Stand perpendicular to the bar, row it to your hip',
      'Drive elbow back and squeeze lats at the top']
FROM exercises WHERE name = 'T-Bar Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Lats','Biceps'], ARRAY['Rear Delts','Core'],
ARRAY['Supinated (palms facing you) grip — this increases bicep recruitment',
      'Dead hang at the bottom, drive elbows to hips',
      'Pull chin over the bar, lower slowly for maximum benefit']
FROM exercises WHERE name = 'Chin-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── SHOULDERS ─────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps','Upper Chest'],
ARRAY['Brace your core — do not hyperextend your lower back',
      'Press bar from upper chest to directly overhead, elbows forward',
      'Fully lock out at the top, lower bar back to clavicle level']
FROM exercises WHERE name = 'Barbell Overhead Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps','Core'],
ARRAY['Sit with back supported or stand with core braced',
      'Press dumbbells from shoulder level directly overhead',
      'Do not touch dumbbells at the top — maintain shoulder tension']
FROM exercises WHERE name = 'Dumbbell Overhead Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Slight forward lean and a micro-bend in the elbow',
      'Raise arms to shoulder height — lead with your pinky, not your thumb',
      'Control the descent: the eccentric is where growth happens']
FROM exercises WHERE name = 'Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Same as lateral raise — use cable for constant tension throughout the range',
      'Keep elbow slightly bent and lead with your elbow not your hand',
      'Do not lean away from the cable to cheat the weight up']
FROM exercises WHERE name = 'Cable Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts'], ARRAY['Traps','Front Delts'],
ARRAY['Slight forward lean and micro-bend in elbows',
      'Raise arms to shoulder height, lead with pinky finger',
      'Control the descent: slow eccentric builds more muscle']
FROM exercises WHERE name = 'Dumbbell Lateral Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps'],
ARRAY['Start with palms facing you, rotate to palms forward as you press',
      'Press until arms are fully extended overhead',
      'Return by rotating back — this rotation increases shoulder activation']
FROM exercises WHERE name = 'Arnold Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts'], ARRAY['Side Delts','Upper Chest'],
ARRAY['Keep a slight bend in your elbows',
      'Raise arms directly in front to shoulder height — no higher',
      'Control the return; avoid swinging with your torso']
FROM exercises WHERE name = 'Front Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Side Delts','Traps'], ARRAY['Biceps'],
ARRAY['Stand upright, overhand grip slightly inside shoulder width',
      'Lead with your elbows — pull bar up to chin level',
      'Pause briefly at the top, lower with control; stop if you feel shoulder impingement']
FROM exercises WHERE name = 'Upright Row' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Front Delts','Side Delts','Triceps'], ARRAY['Traps'],
ARRAY['Adjust seat so handles are at shoulder height',
      'Press upward to full extension without shrugging',
      'Lower handles back to start with full control']
FROM exercises WHERE name = 'Machine Shoulder Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── TRICEPS ───────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Upper arms stay vertical — only your forearms move',
      'Lower dumbbell(s) behind your head until you feel a full stretch',
      'Press back to start — squeeze triceps hard at lockout']
FROM exercises WHERE name = 'Dumbbell Tricep Overhead Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Set cable above head, rope or bar attachment',
      'Step away from the stack, arms extended, then hinge forward slightly',
      'Extend arms toward the floor — keep upper arms still beside your head']
FROM exercises WHERE name = 'Cable Overhead Tricep Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest'],
ARRAY['Grip inside shoulder width — hands close together',
      'Lower chest to the bar while keeping elbows tucked',
      'Press back to lockout; this is a press not a fly']
FROM exercises WHERE name = 'Close-Grip Bench Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Front Delts'],
ARRAY['Upper arms stay perpendicular to the floor throughout',
      'Lower bar to your forehead (not nose) with slow control',
      'Extend back to lockout — squeeze triceps at the top']
FROM exercises WHERE name = 'Skull Crusher' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Set cable at chin height, rope or bar attachment',
      'Elbows pinned to your sides — only forearms move',
      'Push down to full lockout, squeeze hard, then let weight rise slowly']
FROM exercises WHERE name = 'Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Same as standard pushdown but with one arm — allows full range of motion',
      'Keep elbow pinned to side, extend to full lockout',
      'Use lighter weight than the double arm version']
FROM exercises WHERE name = 'Single-Arm Tricep Pushdown' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps'], ARRAY['Chest','Front Delts'],
ARRAY['Lean forward at the hips, upper arm parallel to floor',
      'Extend forearm back to lockout — squeeze tricep at full extension',
      'Hold the contracted position briefly, then return with control']
FROM exercises WHERE name = 'Tricep Kickback' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts','Core'],
ARRAY['Grip parallel bars, arms fully extended — do not kip',
      'Lower until upper arms are parallel to floor or slightly below',
      'Press back to lockout; for tricep focus, keep torso upright']
FROM exercises WHERE name = 'Dips' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts'],
ARRAY['Hands close, lower chest between them',
      'Elbows flare slightly inward — this is normal',
      'Press to lockout, squeeze triceps at the top']
FROM exercises WHERE name = 'Diamond / Close-Grip Push-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Triceps','Chest'], ARRAY['Front Delts'],
ARRAY['Hybrid of a close-grip bench and skull crusher',
      'Lower bar to forehead area while letting elbows drift slightly toward hips',
      'Press explosively back to lockout']
FROM exercises WHERE name = 'JM Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── BICEPS ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Keep elbows pinned to your sides throughout',
      'Curl with a supinated grip — twist so pinkies rise first',
      'Lower slowly — the eccentric builds the most mass']
FROM exercises WHERE name = 'Barbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Keep elbows pinned to your sides throughout',
      'Curl with a supinated grip — twist so pinkies rise first',
      'Lower slowly — the eccentric builds the most mass']
FROM exercises WHERE name = 'Barbell Bicep Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Elbows stay at your sides — do not swing your torso',
      'Supinate (rotate palm up) as you curl for peak bicep contraction',
      'Lower slowly with control']
FROM exercises WHERE name = 'Dumbbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['Elbows stay at your sides — do not swing your torso',
      'Supinate (rotate palm up) as you curl for peak bicep contraction',
      'Lower slowly with control']
FROM exercises WHERE name = 'Dumbbell Bicep Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Brachialis','Biceps'], ARRAY['Forearms'],
ARRAY['Neutral grip (palms facing each other) throughout — no supination',
      'This hits the brachialis more than a standard curl',
      'Keep elbows pinned; lower with control']
FROM exercises WHERE name = 'Dumbbell Hammer Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Chest pad eliminates momentum — strict form only',
      'Full extension at the bottom to maximise stretch on the bicep',
      'Do not hyperextend at the bottom — small bend is fine']
FROM exercises WHERE name = 'Preacher Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Cable provides constant tension unlike free weights',
      'Stand close to the cable, curl with supinated grip',
      'Squeeze at the top, let the cable pull your arm down slowly']
FROM exercises WHERE name = 'Cable Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Set bench to 45–60° incline — this creates a long bicep stretch at the bottom',
      'Let arms hang and curl up — do not swing',
      'This variation has the greatest stretch and may require lighter weight']
FROM exercises WHERE name = 'Incline Dumbbell Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis','Forearms'],
ARRAY['EZ-bar reduces wrist strain versus straight bar',
      'Elbows stay pinned, curl to shoulder height',
      'Lower with a 2–3 second eccentric']
FROM exercises WHERE name = 'EZ-Bar Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Sit on a bench, forearm resting on inner thigh',
      'Curl dumbbell up with supinated grip, elbow fixed in place',
      'Squeeze hard at the top, lower fully for a complete stretch']
FROM exercises WHERE name = 'Concentration Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Biceps'], ARRAY['Brachialis'],
ARRAY['Lie chest-down on a low incline bench — arms hang freely',
      'Curl up with supinated grip — chest stays on the pad',
      'No momentum: pure bicep contraction from a stretched position']
FROM exercises WHERE name = 'Spider Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── LEGS ──────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Barbell on your upper traps, feet shoulder-width, toes slightly out',
      'Brace your core, drive knees out over toes as you descend',
      'Hit depth (thighs parallel or below), drive through your whole foot to stand']
FROM exercises WHERE name = 'Barbell Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Hold dumbbell at chest with both hands, feet shoulder-width',
      'Drive knees out, sit down between your legs',
      'Stay upright: goblet squat builds better posture than most squat variations']
FROM exercises WHERE name = 'Dumbbell Goblet Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Hold dumbbells at sides or in goblet position',
      'Same cues as barbell squat — drive knees out, stay tall',
      'A useful alternative when a barbell is not available']
FROM exercises WHERE name = 'Dumbbell Sumo Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Lats','Core'],
ARRAY['Hinge at hips — push your hips back, not down',
      'Maintain a flat back; bar stays close to your legs throughout',
      'You should feel a deep hamstring stretch at the bottom',
      'Drive hips forward to return to standing']
FROM exercises WHERE name = 'Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings','Glutes'], ARRAY['Core'],
ARRAY['Same hinge pattern as Romanian Deadlift',
      'Flat back throughout, push hips back',
      'Feel the hamstring stretch at the bottom, drive hips forward to stand']
FROM exercises WHERE name = 'Dumbbell Romanian Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings'],
ARRAY['Feet high and wide for more glute/hamstring focus; feet low for more quads',
      'Do not lock knees out at the top — keep a soft bend',
      'Control the descent; do not bounce off the bottom']
FROM exercises WHERE name = 'Leg Press' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings','Core'],
ARRAY['Keep torso upright, take a long stride forward',
      'Front knee tracks over toes, back knee lowers toward the floor',
      'Push through your front heel to drive back to standing']
FROM exercises WHERE name = 'Walking Lunge' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads'], ARRAY['Hip Flexors'],
ARRAY['Adjust seat so knees align with machine pivot point',
      'Extend legs to nearly straight — do not hyperextend',
      'Lower slowly: 3 seconds on the way down builds more quad mass']
FROM exercises WHERE name = 'Leg Extension' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings'], ARRAY['Glutes','Calves'],
ARRAY['Adjust pad so it sits just above your ankle, not mid-calf',
      'Curl heels toward your glutes — full range of motion',
      'Control the return; the eccentric phase is most important']
FROM exercises WHERE name = 'Leg Curl' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Hamstrings'], ARRAY['Glutes','Calves'],
ARRAY['Adjust pad so it sits just above your ankle',
      'Curl heels toward your glutes through full range',
      'Control the return slowly']
FROM exercises WHERE name = 'Dumbbell Leg Curl (Lying)' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Quads','Glutes'], ARRAY['Hamstrings'],
ARRAY['Bar rests on your upper traps or low-bar position, on a special sled',
      'Heels elevated — this increases quad activation versus a standard squat',
      'Drive knees out, stay upright, descend to depth then drive up']
FROM exercises WHERE name = 'Hack Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── GLUTES ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings','Quads'],
ARRAY['Upper back on a bench, feet flat, barbell across hips with pad',
      'Drive hips up until your torso is parallel to the floor',
      'Squeeze glutes hard at the top — do not hyperextend your lower back']
FROM exercises WHERE name = 'Hip Thrust' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings'],
ARRAY['Lie on your back, feet flat on the floor, shoulder-width apart',
      'Drive hips up by squeezing your glutes — not by arching your back',
      'Hold at the top for 1–2 seconds, lower fully between reps']
FROM exercises WHERE name = 'Glute Bridge' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Quads'], ARRAY['Hamstrings','Core'],
ARRAY['Rear foot elevated on a bench, front foot forward',
      'Lower rear knee toward the floor, front shin stays nearly vertical',
      'Drive through your front heel to stand; do not use momentum']
FROM exercises WHERE name = 'Dumbbell Bulgarian Split Squat' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes'], ARRAY['Hamstrings'],
ARRAY['Attach cable cuff to ankle; stand facing the machine',
      'Kick leg back with a straight knee — isolate glutes not hamstrings',
      'Pause at full contraction, return slowly']
FROM exercises WHERE name = 'Cable Kickback' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Quads'], ARRAY['Hamstrings','Core'],
ARRAY['Step onto a box or bench with one foot, drive through that heel to rise',
      'Keep torso upright and core braced throughout',
      'Lower the trailing leg with control — do not drop']
FROM exercises WHERE name = 'Step-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Hamstrings'], ARRAY['Adductors','Core'],
ARRAY['Wide stance, toes pointed out 30–45°',
      'Hip hinge pattern: push hips back, keep shins more vertical than conventional deadlift',
      'Drive hips forward to lock out — squeeze glutes hard at the top']
FROM exercises WHERE name = 'Sumo Deadlift' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Glutes','Abductors'], ARRAY['Hip Flexors'],
ARRAY['Adjust pads so your knees are slightly inside the pads',
      'Push outward against the pads with controlled force',
      'Hold at full abduction briefly, then return slowly']
FROM exercises WHERE name = 'Abduction Machine' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── CALVES ────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand with toes on a step edge for full range of motion',
      'Lower heels fully below step for a complete stretch',
      'Rise onto toes as high as possible — hold at the top for 1 second']
FROM exercises WHERE name = 'Standing Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand with toes on a step edge for full range of motion',
      'Lower heels fully below step for a complete stretch',
      'Rise onto toes as high as possible — hold at the top for 1 second']
FROM exercises WHERE name = 'Dumbbell Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Soleus','Calves'], ARRAY[],
ARRAY['Knee bent at 90° — this position hits the soleus (deep calf) more than standing',
      'Full range: lower heel fully, raise as high as possible',
      'Slow reps: 2 seconds up, hold, 2 seconds down']
FROM exercises WHERE name = 'Seated Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Use the leg press machine; toes on the bottom edge of the footplate',
      'Push through the balls of your feet to extend at the ankle',
      'Full range: deep stretch then full contraction, do not rush']
FROM exercises WHERE name = 'Leg Press Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Unilateral — each calf works independently',
      'Full range of motion: deep stretch at the bottom, full rise at the top',
      'Use a step for range; hold dumbbell on same side for resistance']
FROM exercises WHERE name = 'Single-Leg Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Lean forward with hips resting on a partner or pad — this increases stretch',
      'Full range: deep heel drop then full toe raise',
      'Historically popular for its extreme range of motion']
FROM exercises WHERE name = 'Donkey Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Smith machine stabilises the bar for solo calf work',
      'Toes on a step for full range; same technique as standing calf raise',
      'Full stretch at the bottom, hold contraction at the top']
FROM exercises WHERE name = 'Smith Machine Calf Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Calves'], ARRAY[],
ARRAY['Stand on a step for full range of motion',
      'Lower heel fully, rise onto toes and hold briefly',
      'Use a machine or barbell to add resistance once bodyweight is easy']
FROM exercises WHERE name = 'Calf Raise Machine' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

-- ── ABS ───────────────────────────────────────────────────────────────────────

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Hands behind head — do not pull on your neck',
      'Curl your chest toward your knees, not your head toward your knees',
      'Exhale on the way up; control the return']
FROM exercises WHERE name = 'Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Set cable above head, use a rope attachment',
      'Kneel facing the cable, hands at your forehead',
      'Crunch your ribcage toward your knees — do not pull with your arms']
FROM exercises WHERE name = 'Cable Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Hip Flexors'], ARRAY['Core'],
ARRAY['Dead hang from a bar or use Roman chair',
      'Keep legs straight or slightly bent — raise to hip height or higher',
      'Do not swing; control both the up and the down']
FROM exercises WHERE name = 'Hanging Leg Raise' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Core','Glutes'], ARRAY['Shoulders','Traps'],
ARRAY['Straight line from head to heels — no sagging or piking',
      'Squeeze glutes and brace your core hard',
      'Breathe: do not hold your breath during long holds']
FROM exercises WHERE name = 'Plank' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Obliques','Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Sit with knees bent at 45° and feet off the floor',
      'Rotate your torso side to side — touch the floor beside each hip',
      'Keep your chest up and back straight, do not round forward']
FROM exercises WHERE name = 'Russian Twist' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Core'], ARRAY['Lats','Shoulders'],
ARRAY['Kneel and grip the wheel with both hands, arms straight',
      'Roll forward slowly, extending your body toward the floor',
      'Pull back using your abs — not your lower back or hips']
FROM exercises WHERE name = 'Ab Wheel Rollout' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis'], ARRAY['Hip Flexors'],
ARRAY['Lie flat, hands under your lower back for support',
      'Curl your hips and bring knees toward your chest',
      'Lower legs slowly with control — do not let your lower back arch']
FROM exercises WHERE name = 'Reverse Crunch' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Core','Hip Flexors'], ARRAY['Shoulders','Quads'],
ARRAY['Start in a push-up position, core braced',
      'Drive one knee toward your chest, then alternate quickly',
      'Keep your hips level — do not let them rise or rock']
FROM exercises WHERE name = 'Mountain Climber' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

INSERT INTO exercise_instructions (exercise_id, primary_muscles, secondary_muscles, cues)
SELECT id, ARRAY['Rectus Abdominis','Hip Flexors'], ARRAY['Core'],
ARRAY['Hands behind head or crossed on chest — do not pull neck',
      'Rise until torso is upright, then lower with control',
      'Keep feet anchored; breathe out on the way up']
FROM exercises WHERE name = 'Sit-Up' AND user_id IS NULL
ON CONFLICT (exercise_id) DO NOTHING;

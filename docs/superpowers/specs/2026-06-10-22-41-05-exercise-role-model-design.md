# Exercise role model (generation engine, architectural), design spec

**Status: DRAFT, spec-first.** This is the written spec the roadmap requires before any implementation (Generation engine quality track, Item 4, long-term direction). It is **not approved to build yet**: per the project's spec process it should go through the external review loop (Claude.ai science/UX lens + Perplexity architecture lens) before TDD begins, the same as every prior engine change. It also **gates the volume-first generation planner** (Phase 4 in "Routine generation v2, engine direction"), so the role assignment defined here is a dependency for that work, not a throwaway.

**Author note:** the squat/hinge adjacency interim fix (`interleaveLowerCompounds`, shipped 2026-06-10) is a deliberate band-aid. This spec is the real fix it points at.

---

## 1. Problem

Within-session ordering is currently a two-step heuristic in `generation.ts`:

1. `patternTier(pattern, isCompound)` assigns a coarse tier: Tier 1 = compound squat/hinge, Tier 2 = compound push/pull/lunge, Tier 3 = `*_iso`, Tier 4 = calf/core. A stable sort orders by tier; selection order breaks ties within a tier.
2. `interleaveLowerCompounds` (the interim fix) reshuffles one case: when a session leads with both squat and hinge, it slots the first upper compound between them.

This is structurally limited:

- **Tier 1 lumps squat and hinge**, so the two highest-fatigue lifts are adjacent by default. The interim interleave patches exactly one shape (squat+hinge+upper). It does not generalize to, say, "two heavy presses adjacent" or "primary then secondary of the same plane."
- **No notion of primary vs secondary within a movement.** A heavy barbell row and a light cable row are both Tier 2 and ordered by selection order, not by which is the session's anchor.
- **No push/pull or upper/lower interleave** beyond the one squat/hinge case. A full-body session does all compounds (in tier order) then all isolation, with no fatigue-managed alternation.
- **No clean hook for downstream work.** Compound-floor validation (Item 2), rep-scheme-by-role, and the volume-first planner all want to reason about "what role does this exercise play in the session," which the pattern-tier model cannot express.

Both external reviewers (the three-way review that opened the quality track) independently proposed the same fix: a role layer.

## 2. Proposed model

Replace (or wrap) the pattern-tier model with an explicit **exercise-role layer**. Each selected exercise is assigned a role; the session is ordered by role rank; ties within a role are broken by the existing canonical-anchor rank then fatigue then id (reuse, do not reinvent).

### 2.1 Role sequence

```
Primary Lower → Primary Upper → Secondary Lower → Secondary Upper → Isolation → Finisher
```

Rationale: the two heaviest compounds (Primary Lower, Primary Upper) lead and are separated from their same-category secondary by the opposite category. This generalizes the interim squat/hinge interleave (squat = Primary Lower, bench = Primary Upper, hinge = Secondary Lower) and naturally separates any two heavy lifts of the same category. Isolation and finishers (calf/core) trail, as today.

### 2.2 Base role assignment (all 15 movement patterns)

Role depends on the pattern, `is_compound`, and the exercise's **rank within its category this session** (primary = the session's anchor for that category, secondary = the next one).

| Pattern | is_compound | Category | Role (1st of category / 2nd+ of category) |
|---|---|---|---|
| `squat` | true | lower | Primary Lower / Secondary Lower |
| `hinge` | true | lower | Primary Lower / Secondary Lower |
| `lunge` | true | lower | Secondary Lower (never Primary; unilateral accessory) |
| `horizontal_push` | true | upper-push | Primary Upper / Secondary Upper |
| `vertical_push` | true | upper-push | Primary Upper / Secondary Upper |
| `horizontal_pull` | true | upper-pull | Primary Upper / Secondary Upper |
| `vertical_pull` | true | upper-pull | Primary Upper / Secondary Upper |
| any of the above | false | n/a | Isolation |
| `chest_iso` | n/a | n/a | Isolation |
| `back_iso` | n/a | n/a | Isolation |
| `shoulder_iso` | n/a | n/a | Isolation |
| `biceps_iso` | n/a | n/a | Isolation |
| `triceps_iso` | n/a | n/a | Isolation |
| `glute_iso` | n/a | n/a | Isolation |
| `calf` | n/a | n/a | Finisher |
| `core` | n/a | n/a | Finisher |

"Primary vs Secondary within a category" is decided by the existing **canonical-anchor rank** (`CANONICAL_ANCHORS`) then fatigue: the session's most-canonical squat/hinge is Primary Lower, the next is Secondary Lower. Same for push and pull.

### 2.3 Upper push vs pull

"Primary Upper" should prefer alternating push/pull when both exist, so a push and a pull don't stack. Proposed: within the Primary/Secondary Upper slots, order push before pull (or alternate), so a full-body day reads squat → bench → hinge → row, not squat → bench → OHP → hinge. **Open question for the review loop** (Section 6).

### 2.4 Per-session-type behaviour (graceful degradation)

The role sequence must degrade cleanly when a focus lacks a category:

- **full_body / upper-lower combined** (`fb_*`, `lower`/`upper` mixed days): all roles present; the full sequence applies. This is where the model earns its keep.
- **upper** (`upper_*`): no lower roles. Sequence collapses to Primary Upper → Secondary Upper → Isolation → Finisher. The push/pull alternation (2.3) does the within-upper separation.
- **lower / legs** (`lower_*`, `legs`): no upper roles. Sequence collapses to Primary Lower → Secondary Lower → Isolation → Finisher. Squat-then-hinge on a leg-only day is standard and acceptable (matches the interim fix's no-op-on-leg-only behaviour).
- **push**: only upper-push compounds → all are Primary/Secondary Upper, then isolation/finisher.
- **pull**: only upper-pull compounds → same.

## 3. Interaction with existing systems (must be preserved)

The role layer changes **ordering only**. Everything below stays:

- **Selection** (`selectForSession`, `byPattern`, the caps): unchanged. Role assignment runs on the already-selected set, exactly where the tier sort runs today.
- **`PATTERN_CAP` (max 2/pattern), `HEAVY_DEDUP_PATTERNS`, the unilateral cap, the min-compound guard (Item 2):** all are selection-time, unaffected.
- **Strength set-bump:** must still land on the first compound, which under the role sequence is the Primary Lower (or Primary Upper on an upper/push/pull day). Verify the bump targets position 0 after role ordering, same invariant the interim fix preserved.
- **Supersets (30-min):** `buildSupersets` consumes the ordered list. Role ordering changes the input order; antagonist pairing still applies. Confirm the role order does not worsen 30-min pairing (it should help: Primary Lower next to Primary Upper is a natural antagonist pair).
- **`interleaveLowerCompounds`:** **removed** and subsumed by the role model (the role sequence makes it redundant). Its tests are rewritten against the role ordering.
- **`patternTier`:** removed or kept only as an internal helper feeding role assignment.

## 4. Compatibility and test strategy

This is **not** a byte-identical change. It reorders many sessions (every session with ≥2 compounds of different categories). Therefore:

- The golden identity tests that assert `varied === base`, `balanced === base`, etc. **still hold** (they compare two live generations, both reordered identically) n/a confirm this assumption holds, it did for the interim fix.
- Any test asserting a specific exercise *order* must be re-baselined intentionally. Inventory them first.
- New tests lock the role sequence per session type (full_body separation, upper push/pull alternation, leg-only no-op, the set-bump-on-position-0 interaction).
- Add a property test: for every catalog style at 90+ min volume, no two same-category primary compounds are adjacent unless the session has only that category.

## 5. Phasing

1. Land the role model as a pure ordering layer (this spec), replacing `patternTier` + `interleaveLowerCompounds`. No selection change, no migration.
2. The volume-first generation planner (Phase 4) builds on `assignRole`: it reasons in roles when balancing weekly volume, reading targets through the muscle bridge (never importing analytics, per the three-layer rule).

## 6. Open questions for the review loop

- **Push/pull ordering within Upper roles (2.3):** strict push-before-pull, or alternate, or order by the session emphasis's slot order? Science lens: does alternation matter for fatigue, or is it cosmetic?
- **Is `vertical_push`/`vertical_pull` ever Primary?** On a day with both a horizontal and a vertical of the same plane, which anchors? (Lean on `CANONICAL_ANCHORS`, but confirm the science.)
- **Lunge as Secondary Lower vs Isolation-adjacent:** on a quad day with squat + lunge, is lunge a Secondary Lower (compound, ordered before isolation) or should it sit lower? Current proposal: Secondary Lower.
- **Does the role model change rep schemes?** Out of scope here (ordering only), but it is the natural hook for rep-scheme-by-role later. Confirm we are NOT coupling them in v1.
- **Architecture lens:** is `assignRole` a pure function over `(pattern, isCompound, categoryRankWithinSession)`, or does it need the full session context? Keep it as pure and testable as `patternTier`.

## 7. Non-goals

- No change to exercise selection, caps, equipment/restriction filtering, or rep ranges.
- No new persisted column (roles are derived at generation time).
- Not the volume-first planner itself (this spec only provides its ordering hook).

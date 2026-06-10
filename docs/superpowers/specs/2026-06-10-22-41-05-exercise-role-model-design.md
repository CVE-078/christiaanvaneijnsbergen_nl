# Exercise role model (generation engine, architectural), design spec

**Status: APPROVED FOR IMPLEMENTATION (2026-06-10).** External review complete (Perplexity + ChatGPT). All open questions resolved. TDD implementation is cleared to proceed. See updates 1-7 for resolved findings incorporated from review. It **gates the volume-first generation planner** (Phase 4 in "Routine generation v2, engine direction"), so the role assignment defined here is a dependency for that work, not a throwaway.

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

**Policy note (lower-first):** the PL→PU ordering (Primary Lower precedes Primary Upper) is a deliberate lower-first policy for full-body and mixed sessions. It reflects the most common general-population programming convention (squat-first full-body days) but is not a universal coaching rule, some programs lead with bench on emphasis days. A session-level `leading_category` field (`lower_first` or `upper_first`) is the correct future hook for upper-emphasis variants. It is not implemented in v1: all current `EMPHASES` definitions use lower-first ordering and no upper-first session exists in the current style catalog.

### 2.2 Base role assignment (all 15 movement patterns)

Role depends on the pattern, `is_compound`, and the exercise's **rank within its category this session** (primary = the session's anchor for that category, secondary = the next one).

| Pattern | is_compound | Category | Role (1st of category / 2nd+ of category) |
|---|---|---|---|
| `squat` | true | lower | Primary Lower / Secondary Lower |
| `hinge` | true | lower | Primary Lower / Secondary Lower |
| `lunge` | true | lower | Secondary Lower (never Primary, unilateral accessory; see the lone lunge promotion) |
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

#### 2.2.1 Category definitions

Two layers of categories with distinct purposes (Q3, resolved 2026-06-10). They do not contradict: role assignment is **coarse** (two buckets), planning and reporting are **fine** (three categories).

**Coarse buckets (role assignment).** Primary/secondary role assignment uses two buckets:

- **Lower** = {`squat`, `hinge`, `lunge`}
- **Upper** = {`horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`}

Pooling push and pull into one Upper bucket is what produces exactly one Primary Lower and one Primary Upper per session (the intended sequence). `*_iso`, `calf`, and `core` belong to no bucket; they map directly to Isolation / Finisher.

**Fine categories (planner / reporting only).** The volume-first planner (Phase 4) and the reporting layer use three finer categories, **Lower**, **Upper-push** {`horizontal_push`, `vertical_push`}, and **Upper-pull** {`horizontal_pull`, `vertical_pull`}, for pattern-direction granularity (balancing weekly horizontal vs vertical volume). These are **not** used for role assignment (doing so would yield two Primary Uppers).

**Primary vs Secondary.** Within each coarse bucket, rank the already-selected compounds and assign role by rank (rank 1 = Primary, rank ≥ 2 = Secondary). Deterministic and independent of emphasis slot order. **Role assignment is a post-selection pass over the already-selected exercise set, not a selection-time decision.**

- **Lower bucket ranking (Q1):** a category-internal **pattern priority `squat > hinge > lunge`** is applied **first** (squat is the primary lower compound for general-population programming and anchors any session containing both a squat and a hinge; this is explicit, not inferred from fatigue or seed order). Within the same pattern, fall to canonical-anchor rank (`CANONICAL_ANCHORS`) → fatigue desc → id, so among hinges Romanian Deadlift > conventional Deadlift. The lone-lunge promotion (below) overrides only when no squat or hinge is present.
- **Upper bucket ranking (Q2):** canonical-anchor rank → fatigue desc → **push-before-pull** → id. The push-before-pull step is a **soft cross-pattern tiebreaker** that fires only when canonical rank and fatigue are tied across different patterns (e.g. Barbell Bench Press and Barbell Row are both canonical rank 0 and fatigue 4 in the seed). It makes the bench the Primary Upper on a session with both, the right general-population default, and keeps tests deterministic rather than falling to arbitrary id order. It is **not** a hard push/pull architectural principle and **not** push/pull alternation (see §2.3 / §6).

**Lone lunge promotion (named rule):** if no squat or hinge compound is present in the session (due to restriction filtering, equipment constraints, or emphasis design), the first lunge compound by canonical rank is promoted to **Primary Lower**. All subsequent lunge compounds remain Secondary Lower. This matches coaching practice where a split squat or walking lunge becomes the session's main lower lift when bilateral compounds are unavailable.

### 2.3 Upper push vs pull

A full-body day reads squat → bench → hinge → row, not squat → bench → OHP → hinge. **Resolved:** push/pull *alternation* is deferred (§6); a soft **push-before-pull tiebreaker** (§2.2.1, Upper bucket ranking) breaks canonical+fatigue ties across patterns so the bench anchors over the row at equal fatigue. The tiebreaker fires only on a true tie; it does not reorder a heavier pull below a lighter push.

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
- **Volume-first planner (consumes role + pattern, not role alone):** the volume-first planner (Phase 4) must consume role + movement pattern, not role alone. PRIMARY_UPPER subsumes both horizontal_push and vertical_push under one role; the planner needs pattern-level granularity to balance weekly horizontal vs vertical volume. The three-layer rule is: selection layer (15 patterns) → role layer (6 roles, ordering and planning hooks) → reporting layer (10 muscle categories). Roles must not absorb pattern information.

## 4. Compatibility and test strategy

This is **not** a byte-identical change. It reorders many sessions (every session with ≥2 compounds of different categories). Therefore:

- The golden identity tests that assert `varied === base`, `balanced === base`, etc. **still hold** (they compare two live generations, both reordered identically); confirm this assumption holds, it did for the interim fix.
- Any test asserting a specific exercise *order* must be re-baselined intentionally. Inventory them first.
- New tests lock the role sequence per session type (full_body separation, upper push/pull alternation, leg-only no-op, the set-bump-on-position-0 interaction).
- Add a property test: for every catalog style at 90+ min volume, no two same-category primary compounds are adjacent unless the session has only that category.
- **Hinge-before-squat selection:** if an emphasis selects RDL before Barbell Squat (e.g. lower_post processed before lower_quad in the same session), role assignment must still promote Barbell Squat to PRIMARY_LOWER based on canonical rank, not selection order.
- **Deadlift + RDL same session:** both are hinge pattern. RDL has canonical rank 1 for hinge (`CANONICAL_ANCHORS`), so RDL = PRIMARY_LOWER, conventional Deadlift = SECONDARY_LOWER. Expected order: RDL → bench → deadlift → row. This is the intended outcome (RDL as controlled hypertrophy anchor, deadlift as secondary); verify against test.
- **Lone lunge:** if Bulgarian Split Squat is the only lower compound due to restrictions, it must be promoted to PRIMARY_LOWER and appear before the first upper compound, not after.
- **Compound-less session:** if all compounds are filtered, session degrades to Isolation → Finisher. Role sort must not produce empty-role artifacts or position errors.
- **Restriction-filtered all-upper:** if all lower compounds are removed by restrictions, set-bump must fire on the PRIMARY_UPPER exercise (position 0) not on a missing PRIMARY_LOWER position.

## 5. Phasing

1. Land the role model as a pure ordering layer (this spec), replacing `patternTier` + `interleaveLowerCompounds`. No selection change, no migration.
2. The volume-first generation planner (Phase 4) builds on `assignRole`: it reasons in roles when balancing weekly volume, reading targets through the muscle bridge (never importing analytics, per the three-layer rule).

## 6. Open questions for the review loop

- **Push/pull ordering within Upper roles (RESOLVED):** push/pull *alternation* (bench → row → OHP vs bench → OHP → row in the secondary block) is a soft ergonomic preference, not a training-science requirement, and is deferred. A soft **push-before-pull tiebreaker** IS implemented for the Upper bucket ranking (canonical → fatigue → push-before-pull → id, see §2.2.1): it fires only when canonical rank and fatigue tie across patterns (bench vs row, both rank 0 / fatigue 4), so the bench anchors Primary Upper deterministically instead of falling to id order. Full alternation revisits if user feedback or the volume-first planner needs motivate it.
- **Is `vertical_push`/`vertical_pull` ever Primary?** On a day with both a horizontal and a vertical of the same plane, which anchors? (Lean on `CANONICAL_ANCHORS`, but confirm the science.)
- **Lunge as Secondary Lower vs Isolation-adjacent:** on a quad day with squat + lunge, is lunge a Secondary Lower (compound, ordered before isolation) or should it sit lower? Current proposal: Secondary Lower.
- **Does the role model change rep schemes?** Out of scope here (ordering only), but it is the natural hook for rep-scheme-by-role later. Confirm we are NOT coupling them in v1.
- **Architecture lens:** is `assignRole` a pure function over `(pattern, isCompound, categoryRankWithinSession)`, or does it need the full session context? Keep it as pure and testable as `patternTier`.

## 7. Non-goals

- No change to exercise selection, caps, equipment/restriction filtering, or rep ranges.
- No new persisted column (roles are derived at generation time).
- Not the volume-first planner itself (this spec only provides its ordering hook).

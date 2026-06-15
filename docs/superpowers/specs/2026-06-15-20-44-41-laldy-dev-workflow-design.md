# Laldy, AI-driven development workflow, design (v2, reconciled after review loop)

**Date:** 2026-06-15
**Status:** Reconciled after the Perplexity + ChatGPT + Claude.ai review loop. Ready to build the thin harness.
**Purpose:** A strict, GitHub-native, AI-driven development workflow for the Laldy app. Self-contained so reviewers without repo access can evaluate it.

---

## Design stance
Build a **solid base now, sized for the platform Laldy is becoming**, not for the current user count. The app is in development; setting the workflow and structure up well now is far cheaper than retrofitting them onto a live, higher-traffic product later. **But** every mechanism must earn its place by catching a **real failure mode** this project has actually hit, or by being **genuine best practice**, not by being something a mature team happens to have. The review loop's "you're only 2 users, cut it down / defer it" thrust is deliberately set aside; its scale-independent findings (most of them) are folded in below, and several get *more* important as usage grows (the data-safety ones especially).

## Context
**Product.** "Laldy" is an adaptive strength-training PWA (formerly "Pulse"), being rebranded + extracted from a personal-portfolio repo into its own repo. Solo developer today; built to scale. Long-term-sound architecture over quick wins.

**Stack.** Next.js 15 (App Router), React 19, TypeScript strict, Tailwind v4 (theme tokens), Supabase (auth + Postgres, RLS), SWR, installable PWA (service worker + IndexedDB offline write queue), Vitest (~1,600 unit tests). Moving into a **pnpm + Turborepo monorepo** (`apps/web` the PWA → `go.laldy.app`; `apps/www` apex placeholder → `laldy.app`; `packages/{lib,ui}` reserved for a future RN + Expo app). Hosted on **Vercel**; GitHub repo `CVE-078/laldy`. Scaffold merged (#1).

**Implementer.** Claude Code (Opus) writes the code. Reviewers are deliberately **decorrelated**; the implementer never reviews its own work.

**Known failure modes this workflow must defend against (the spine of the whole design):**
1. **Green-by-construction tests:** a test passes while production is broken because it fed the convenient input shape, not the real production data flow.
2. **Synthetic-pool generation goldens:** the unit suite can be fully green while the routines a *real* user gets are bad. The root cause is often bad **catalog data** (mis-tagged movement patterns, null metadata), not the engine.
3. **A new DB write path shipped without a matching RLS policy** (a silent data-exposure bug that does not throw).

---

## 1. Work tracking (replaces a large `roadmap.md`)
- **GitHub Issues** = work items; **Projects** = board/live roadmap; **Milestones** = phases/releases. **ADRs** (`docs/decisions/`) hold the decision history + "why".
- **Issue template with teeth** (the agent loop is only as good as its contract): observable behavior, testable acceptance criteria, **explicit non-goals**, a **test plan**, **rollout risk**, a **"produces UI? → mobile check"** flag, a **"production-data-flow" rubric** (at least one test must hit the path the user actually hits, not a synthetic shortcut), and an **RLS check** for any new write path. Triage labels (`triage:ready`/`blocked`/`decision-needed`/`future`).
- **Seed lazily.** Extract decision records to ADRs, seed the board with active items, create issues as work arises, archive `roadmap.md`. Keep one living **"harness debt"** issue so workflow pain has a home instead of scattering.

## 2. Branch / commit / PR conventions
- One issue per branch (`feature/<issue#>-<slug>`; chores `chore/<slug>`). Conventional commits.
- PR template: acceptance checklist, test evidence, an "Automated review findings" section, a **"tested on mobile (preview URL)"** checkbox for UI changes, and `Closes #<issue>`.

## 3. The implementer loop
Documented as a Laldy skill / `CLAUDE.md` section, composing the superpowers skills:
1. Context load (issue + acceptance criteria + ADRs + relevant code).
2. **Spec/design challenge (pre-implementation):** see §4 Lens C. Resolve before writing code.
3. Claim the issue (assign, In-progress, branch).
4. **Semantic TDD** per acceptance criterion (`superpowers:test-driven-development`).
5. Run validators per the issue.
6. `superpowers:verification-before-completion` (real commands, real output).
7. **Split review:** prepare-review (typecheck + lint + affected tests) → dispatch reviewer agent(s) → **triage + auto-fix loop (cap 3)** → open PR with findings embedded.
8. Stop. On feedback, `superpowers:receiving-code-review`.

## 4. Decorrelated, adversarial review (three lenses, two layers)
**Layer A, pre-PR local reviewer agents** (`.claude/agents/`, read-only Read/Grep/Glob, Sonnet-pinned, REFUTE-style, `severity + file:line + fix` + `REFUTED/NOT REFUTED`):
- **Lens A, correctness:** logic, edge cases, broken invariants, spec-vs-code drift, and explicitly **"is this test exercising the real production flow, or vacuously green?"** (failure mode 1).
- **Lens B, security:** authz/injection/leakage, and explicitly **"any new insert/upsert path without a matching RLS policy?"** (failure mode 3).
- **Lens C, spec/design challenger (runs BEFORE implementation):** reads the issue + ADRs + test plan and tries to invalidate the *spec*: "what production path isn't represented? what invariant is missing? **how could every acceptance criterion pass while the user still hits the original bug?**" Your historical failures were spec failures, not implementation failures, and nothing else catches this.

**Layer B, on-PR CI review.** Decorrelation note: Opus and Sonnet share a lineage, so the genuinely independent signal is **cross-family**. So: **GitHub Copilot review is the required cross-family reviewer**; the **Claude Code Action is advisory-only** (kept for convenience, not a third standing gate, to avoid same-family noise the human learns to skim). Both **comment only**; the **local agent owns all fixes** (one actor mutates the diff).

## 5. Gates: hooks + fast CI (machine-enforced, not prompt-enforced)
- **husky:** `pre-commit` (lint-staged: eslint --fix + prettier on staged files; a **design-token-only lint** rejecting hardcoded colors that should be theme tokens; the **import-boundary lint**), `commit-msg` (conventional commits), `pre-push` (branch naming + refuse direct push to `main`).
- `.claude/settings.json`: `enabledPlugins` superpowers, a permissions allowlist, a `block-dangerous-rm` PreToolUse hook.
- **Fast required CI** (`pr-validation.yml`): parallel **affected** lint / typecheck / unit-tests (`turbo --filter=...[origin/main]`) + **architecture checks** (import boundaries, **circular-dependency detection, orphaned-export detection**) + a **semantic-TDD check** (the PR's new tests are run against the base commit and must fail there: enforces the *guarantee*, not the commit-order ritual, which an agent games trivially). pnpm + turbo caching, ≤5 min, required in branch protection. Slow `build` + Playwright E2E in a **separate non-required** workflow.
- **Architecture is enforced by machines** (boundaries + cycle/orphan detection), with the reviewer agent flagging drift only as a backstop. Prompts rot; lint rules do not. Keep the rule set small and legible.

## 6. Merge automation
- **Label-gated auto-merge** for the bulk: merges once required CI + review pass and **I add the `automerge` label** (a glance, not a line-by-line read).
- **Hard carve-out (never auto-merge-eligible, label or not):** any PR touching **migrations, RLS, auth, or the generation engine**. These require a **human read + a manual cross-user verification** (log in as both accounts, confirm no data leaks across them). Reason: a missing RLS policy does **not throw**, so Sentry is blind to it, and a bad migration corrupts data that code-rollback cannot restore. Line-by-line is the point for exactly this class. A Vercel **preview sanity check** is required before the label on any such PR.

## 7. Project structure & conventions standard (first-class, enforced)
- **Layout:** feature-first. `src/features/{train,plan,progress,profile,library,coach,generation,session}/` each co-locating `components/ hooks/ lib/` + colocated tests; `src/components/ui/` for shared primitives; `src/lib/` for the cross-cutting "brain"; `src/hooks/`, `src/context/`, `src/app/`. `components/ui` + `lib` seed `packages/ui` + `packages/lib`.
- **Conventions** (grounded in current Next.js App Router project-organization docs, Turborepo monorepo guidance, bulletproof-react): consistent file/folder naming, colocated `*.test.ts(x)`, judicious barrels (avoid deep chains that hurt tree-shaking), features expose a public API and never import each other's internals, no circular deps, consistent path aliases. Documented as an ADR.
- **Enforced by machine** (eslint-plugin-boundaries / import/no-restricted-paths + cycle/orphan detection in CI), reviewer flags drift as backstop.
- **Migration:** the ~166-file `components/pulse` mega-folder is reorganized onto this standard in a one-time, mechanical, fully test-gated pass. Kept (you want a maintainable base) but sequenced **after** the verbatim app move, not coupled into it and not the literal first workload.

## 8. Laldy-specific quality gates
- **Catalog-integrity test (the cause, tightest signal).** Assert directly: every exercise resolves to a valid movement pattern the muscle bridge can map, no required metadata field is null, every pattern has ≥N candidates per common equipment tier. Failure mode 2's root cause is bad catalog *data*, so check the data, not only the output.
- **Real-catalog generation gate (deterministic; built NOW against the current repo, before the migration).** Generate routines for a representative **profile matrix** (goal × experience × equipment × restrictions × days) against the **real seeded catalog**, then:
  - **Property assertions are the gate** (the engine already encodes the rules): compound floor per session, no duplicate finisher, duration in band, restrictions respected, quad/posterior contract, per-pattern + unilateral caps, role-model order, week-level push/pull balance + label validity + vertical-pull coverage; the `warnings` array asserted as a signal (which profiles should vs should not warn). Plus: **stability budget** (a small ranking-weight change must not churn most of the output), **diversity bounds** (100 seeds, same profile, variety stays in range), **empty/sparse-catalog resilience** (degrade safely when a pattern/category is thin).
  - **Real-catalog snapshot is a canary, not the gate,** kept deliberately **small-diff** so it stays human-readable (a 90-pick diff just gets rubber-stamped). Properties carry the weight.
  - **Historical-user replay (highest-value future gate):** capture real generation inputs from me + my wife as anonymized fixtures and replay them forever. Real users beat synthetic matrices.
  - **No LLM in the gate.** Subjective "is this a coherent program?" is my spot-check (a lifter dogfooding). LLM allowed only as **advisory rule-discovery** (flag "off in a way no rule catches" → encode valid findings as new deterministic checks), never a CI gate.
- **Design consistency:** consolidate components into `packages/ui` + **Storybook**; Tailwind tokens as the single source; **visual regression** via free Playwright screenshots (Chromatic deferred).
- **E2E + agent-driven verification:** Playwright for critical flows (login, generate, log a set, offline/PWA) in the non-required lane; the **Playwright MCP** for interactive agent-driven generation checks (exploration, not a gate).

## 9. Safety net & data recovery (the part that matters more as usage grows)
- **Vercel preview-per-PR** is the review surface (Action + me + E2E + the mobile check).
- **Sentry**, pulled forward, catches *thrown* regressions. **Honest limit:** it is blind to the non-throwing class (silent RLS leaks, wrong-but-valid output); that class is caught by the §6 carve-out, the RLS tests, and daily dogfooding, not Sentry.
- **A tested Supabase restore path** (the under-built risk): Vercel rollback reverts *code*, not training data. A migration that corrupts `set_logs` has no recovery without this. Stand up + rehearse DB backup/restore as part of the harness, not "later" (it gets more critical with more users).

## 10. Sequencing
- **In parallel, starting now (calendar-gated, costs no build hours):** start the validation clock, train with intent + schedule the deliberate missed-week test. It needs weeks of real data to mean anything, so its *start* is the only truly costly thing to defer; it runs in the background while the harness + migration proceed.
- **Now:** build the **catalog-integrity + real-catalog generation gate against the current repo** (it also makes the verbatim migration verifiable) + stand up the **thin harness** (Issues/Projects/templates, fast CI gate + architecture checks, reviewer agents + PR template, Copilot required + Claude Action advisory, label-gated auto-merge + carve-out, husky + settings, Vercel preview + Sentry + restore path).
- **Then:** app migration → structure redesign onto the conventions standard → fast-follow dependency upgrade → design system (`packages/ui` + Storybook + visual regression) + E2E.

## 11. Out of scope / not yet
A custom `pnpm pbi`-style CLI; multi-lane routing + lane runbooks; cron orchestrators / auto-done rollups; full no-touch auto-merge; changesets / release automation; Chromatic on day one; Azure DevOps; multi-agent swarms. The loop's broader "cut the harness to two mechanisms / start from zero / defer structure + design system indefinitely" recommendations are recorded and **set aside** per the Design stance above.

---

## Review-loop disposition (2026-06-15)
**Adopted** (scale-independent improvements): the pre-implementation spec/design challenger (Lens C); semantic-TDD enforcement (run new tests against base) over the commit-order ritual; the catalog-integrity test + stability/diversity/sparse-catalog properties + historical-user replay + properties-are-gate/snapshot-is-canary; machine-enforced architecture (boundaries + cycle/orphan CI) over reviewer-prompt; the migration/RLS/auth auto-merge carve-out with cross-user verification; the honest Sentry limit + a tested Supabase restore path; issue-template teeth (non-goals, rollout risk, production-data-flow rubric, RLS check); a living harness-debt issue; moving the generation gate to "now"; current-docs citations.
**Refined:** reviewer decorrelation, Copilot required (cross-family = the real independent signal), Claude Action demoted to advisory (Opus+Sonnet are same-family), local agents own fixes.
**Set aside** (per Design stance, not by oversight): the "you're 2 users, cut to two mechanisms / start from zero / defer structure + design system" thrust. Kept structure + design system as part of the base; kept the fuller harness because the app is built to scale.

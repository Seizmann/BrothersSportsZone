# AGENT.md — Instructions for AI Coding Agents

This file governs how any AI coding agent (Claude Code, Cursor, Copilot Workspace, etc.) works on BrothersSportsZone. Read this before touching any code.

## 1. Source of Truth

- Full requirements live in `REQUIREMENT.md` (gitignored, root of repo). Read it before starting any feature. If a request conflicts with `REQUIREMENT.md`, stop and flag the conflict — do not silently deviate.
- Decisions made outside `REQUIREMENT.md` during a session get logged in `DECISION.md`, not invented in code comments.
- `PROGRESS.md` is your working plan and status tracker. Update it as you complete work — don't let it go stale.

## 2. Never Commit These Files

`REQUIREMENT.md`, `PROGRESS.md`, `SECRETS.md`, `BRANDING.md`, `.env.local` must always be in `.gitignore`. Before any `git add` or `git commit` that touches the repo root, verify these are not staged. If you ever see one of these in `git status` as trackable, stop and fix `.gitignore` first — do not commit.

## 3. Scope Discipline

- MVP means MVP. Do not build: payment gateways, automated SMS/WhatsApp, multi-turf support, tournaments/leagues, self-service cancellation, promo codes, staff attendance tracking, or minute-by-minute commentary — these are explicitly out of scope per `REQUIREMENT.md` Section 2.
- If a task seems to require one of the above, stop and ask rather than quietly implementing a workaround.

## 4. Code Standards

- TypeScript everywhere. No `any` without a comment justifying it.
- No hardcoded values that belong in `site_settings` (pricing, slot durations) or `BRANDING.md` (names, contact info, SEO metadata). Pull from DB or config.
- No hardcoded pixel sizes or breakpoints — Tailwind utilities only, mobile-first.
- Comments in clear English on any non-obvious business logic (e.g., booking status transitions, role-permission checks).
- Match the style guide in `HUMANIZER.md` for any user-facing copy or documentation you write.

## 5. Database Changes

- All schema changes go through `packages/database/migrations/`. Never hand-edit the Supabase schema outside a migration file.
- Any new table or column must be reflected back into `REQUIREMENT.md` Section 7 in the same session.
- RLS policies are mandatory for every table touched by the admin panel — verify `stuff` role cannot read financial columns (`paid_amount`, `due_amount`, `expenses.amount`) at the policy level, not just hidden in the UI.

## 6. Git Workflow

- All work happens on `dev`. Never push directly to `main`.
- Follow `CI.md` for what must pass before a PR/merge is considered mergeable.
- Commit author is always `Seizmann`. Add a co-author trailer picked from the `BRANDING.md` list (do not invent names — read them from `BRANDING.md`, which you have local access to but never commit).

## 7. When Uncertain

- If `REQUIREMENT.md` is ambiguous or silent on something, check `DECISION.md` for a prior ruling first.
- If still unresolved, do not guess silently on anything touching money, permissions, or data deletion — surface the question instead of picking a default.
- For purely cosmetic/UX judgment calls (spacing, copy tone, icon choice), you may use your own judgment per `DESIGN.md` and `HUMANIZER.md`.

## 8. Testing

- New logic touching bookings, pricing, or role permissions requires a test in `/test` before the PR is considered done.
- Realtime match-update logic should have at least one integration test simulating an event push and a subscribed client receiving it.

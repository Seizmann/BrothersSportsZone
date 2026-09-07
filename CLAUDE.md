# CLAUDE.md — Project Context for Claude

This file is read by Claude (chat, Claude Code, or any Claude-based agent) at the start of work on this repo. It is a condensed pointer file — the full spec lives elsewhere; don't duplicate it here.

## What this project is

BrothersSportsZone is a hybrid Next.js + Supabase platform for a Bangladesh turf business: a manual-payment turf booking system, plus a Flashscore/Sofascore-style football live-score and team-management product. MVP is built; this repo is public/open-source under SpritexAI's custom source-available license.

## Where to look first

| Need | File |
|---|---|
| Full requirements / PRD | `REQUIREMENT.md` (gitignored — read locally, never commit) |
| Agent behavior rules, scope discipline | `AGENT.md` |
| CI/CD rules, what must pass before merge | `CI.md` |
| Visual design tokens (colors, fonts) | `DESIGN.md` |
| Prior decisions / rulings on ambiguity | `DECISION.md` |
| Writing style for docs/commits/copy | `HUMANIZER.md` |
| Current work plan / status | `PROGRESS.md` (gitignored) |
| Names, org details, co-author list | `BRANDING.md` (gitignored) |
| Security expectations | `SECURITY.md` |

## Non-negotiable constraints

- `REQUIREMENT.md`, `PROGRESS.md`, `SECRETS.md`, `BRANDING.md` are gitignored and must never be committed, referenced by content in commit messages, or pushed — check `.gitignore` before any commit.
- Timezone is fixed to `Asia/Dhaka`, currency fixed to BDT. Do not make these configurable.
- Single turf, single currency — do not build multi-tenant abstractions "for the future" unless asked.
- Role model is exactly three tiers: `sudo_admin`, `manager`, `stuff`. `stuff` never sees financial data — enforce this in Supabase RLS, not only in the UI.
- Manual payments only in MVP — no gateway integration.

## Working style expected here

- Human-engineer code quality: no unnecessary abstraction, clear comments on non-trivial logic, no hardcoded values that belong in the DB (pricing, slots, branding, contact info).
- Mobile-first, fully responsive, no hardcoded breakpoints.
- Every route needs a dynamic title and SEO metadata sourced from DB/`BRANDING.md`.
- Commit as `Seizmann`, with a co-author trailer randomly selected from `BRANDING.md`'s list.

## What NOT to do without asking

Payment gateway integration, automated notifications, multi-turf support, tournament/league structures, self-service cancellation, promo codes, staff attendance tracking — all explicitly out of MVP scope. If a request seems to need one of these, flag it instead of building around it.

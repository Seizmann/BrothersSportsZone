# CI.md — GitHub Actions Rules

Defines what runs, what must pass, and how deployment is gated for BrothersSportsZone.

## 1. Branch Model

- **`dev`** — all development happens here. Every push runs the full CI suite.
- **`main`** — protected, manual-merge-only after `dev` is green and PRD-reviewed. Vercel auto-deploys both apps (`apps/web`, `apps/admin`) on every merge to `main`.

## 2. Pipeline — Triggered on every push to `dev` and every PR into `main`

1. **Install** — `pnpm install --frozen-lockfile` at the workspace root (Turborepo-aware).
2. **Type check** — `tsc --noEmit` across all workspaces (`apps/web`, `apps/admin`, `packages/*`).
3. **Lint** — ESLint across all workspaces. No warnings-as-errors exceptions without a documented reason in `DECISION.md`.
4. **Unit / integration tests** — run everything under `/test`. Must include coverage for:
   - Booking status transitions (`pending → confirmed → checked-in → completed`, plus `cancelled`/`no_show`)
   - Role-permission gating (`sudo_admin` / `manager` / `stuff`) — especially that `stuff` cannot read financial fields
   - Pricing calculation from `site_settings.pricing_rules_json`
   - Match status progression and Realtime event delivery (at least one integration test)
5. **Build verification** — `turbo run build` for both `apps/web` and `apps/admin`. Build must succeed with zero errors.
6. **Gitignore guard** — CI step that fails the pipeline if `REQUIREMENT.md`, `PROGRESS.md`, `SECRETS.md`, or `BRANDING.md` appear in the diff of the pushed commit. This is a hard gate, not a warning.

## 3. Merge Requirements (`dev` → `main`)

- All pipeline steps above green.
- No `console.log` / debug statements left in production code paths (lint rule enforced).
- Any new DB migration in `packages/database/migrations/` has been reviewed and matches `REQUIREMENT.md` Section 7.
- `PROGRESS.md` updated to reflect what shipped (checked locally — not part of the automated gate, since the file is gitignored).

## 4. Deploy

- Merge to `main` triggers Vercel auto-deploy for both `apps/web` and `apps/admin` independently.
- SSL and DNS are Vercel-managed once the domain is pointed.
- Post-deploy: Sentry should show no new error spike within the first monitoring window — treat a spike as a rollback trigger.

## 5. Secrets

- CI reads environment variables/secrets from GitHub Actions repo secrets — never from a committed file.
- `SECRETS.md` is a local-only reference for agents/developers and is never read by CI directly.

## 6. Failure Handling

- A failed `dev` pipeline blocks nothing except the eventual PR to `main` — keep pushing fixes to `dev`.
- A failed gitignore-guard step is treated as critical: stop, fix `.gitignore`, and if a sensitive file was ever pushed in history, treat it as a leaked-secrets incident (rotate any exposed credentials, scrub history).

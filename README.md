# BrothersSportsZone

A hybrid platform for a Bangladesh turf business: a manual-payment turf booking system plus a Flashscore/Sofascore-style football live-score and team-management product.

**Live:** [brotherssportszone.com](https://brotherssportszone.com) · **Admin:** [office.brotherssportszone.com](https://office.brotherssportszone.com)

**Status:** MVP in active development.

## Tech Stack

| Layer | Choice |
|---|---|
| Main site | Next.js + TypeScript + Tailwind v4 |
| Admin panel | Vite SPA + TypeScript + Tailwind v4 |
| Database | Supabase (Postgres + Auth + Realtime) |
| Storage | Cloudflare R2 |
| Monorepo | pnpm workspaces + Turborepo |
| CI/CD | GitHub Actions, deploy via Vercel |

## Project Structure

```
apps/
  web/        Customer-facing Next.js site (booking + live scores)
  admin/      Admin panel SPA
packages/
  database/   Supabase migrations, seed, types
  shared/     Shared schemas, constants, types
```

## Development

Requires Node 22+ and pnpm.

```bash
pnpm install
pnpm dev        # run all apps in dev mode
pnpm build      # build all workspaces
pnpm typecheck  # type check all workspaces
pnpm lint       # lint all workspaces
```

## Branch Model

- `dev` — active development branch, full CI on every push, auto-deploys to [demo.brotherssportszone.com](https://demo.brotherssportszone.com)
- `main` — protected, manual merge only, auto-deploys to production ([brotherssportszone.com](https://brotherssportszone.com) + [office.brotherssportszone.com](https://office.brotherssportszone.com))

## License

Released under the SpritexAI Source-Available License (SAL) — see [LICENSE.md](LICENSE.md).

- Personal use: free, no restrictions
- Commercial use: 25% of net revenue payable to the author

## Author

Mohammad Sijan (SpritexAI) · [github.com/Seizmann](https://github.com/Seizmann)

© 2026 Mohammad Sijan / SpritexAI. All rights reserved under the SpritexAI Source-Available License.

# Chess Coach

Base React app (Vite + TypeScript) with routing, env plumbing, ESLint, Prettier, and absolute imports.

## Scripts

- `npm run dev`: Start the dev server on `http://localhost:5173`
- `npm run build`: Type-check and build for production
- `npm run preview`: Preview the production build locally
- `npm run lint`: Run ESLint
- `npm run lint:fix`: Run ESLint with auto-fix
- `npm run format`: Format with Prettier

## Env

Create a `.env` from `.env.example` and set public flags (must be prefixed with `VITE_`).

Example: `.env`

```
VITE_APP_NAME=Chess Coach
```

Access in code via `import.meta.env` or the typed helper in `src/shared/env.ts`.

## Routes

- `/` Home page
- `/health` Health page showing a simple JSON payload

## Absolute Imports

Use `@/` to import from `src/`, e.g. `import { env } from '@/shared/env'`.

## Getting Started

1. Install Node.js 18+ (LTS recommended)
2. Install dependencies: `npm install`
3. Start dev server: `npm run dev`

Then open `http://localhost:5173`.

## Notes

- Public env vars must be prefixed with `VITE_` to be exposed to the client.
- Linting and formatting are configured with ESLint + Prettier.

## Deploy (GitHub Pages)

- Vite base path:
  - Custom domain or root hosting: leave `base` as `/` (default).
  - Project page (https://<USER>.github.io/chess-coach/): use `/chess-coach/`.
  - This repo reads `BASE_PATH` at build time. The provided workflow sets `BASE_PATH=/chess-coach/`.

- Workflow:
  - See `.github/workflows/deploy.yml`.
  - Push to `main` to build and deploy to Pages.
  - For a custom domain, remove the `BASE_PATH` env in the build step or set it to `/`.
  - Ensure Settings → Pages → Source is set to "GitHub Actions". If it's set to a branch (e.g., `main`), GitHub will serve the development `index.html` (which points to `/src/main.tsx`) and you'll see MIME-type errors.
  - If you use a custom domain (e.g., `chess-coach.me`), either set it in Settings → Pages (GitHub will add CNAME), or keep the "Add CNAME" step in the workflow so the artifact contains `dist/CNAME`.
  - Enable "Enforce HTTPS" so the certificate is provisioned for your domain.

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

# BigYearPWA
Big Year Bird watching planning PWA App

## Run in GitHub Codespaces

1. In GitHub, open this repo and select `Code` → `Codespaces` → `Create codespace on main`.
2. In the Codespace terminal, run:
	- `npm ci`
	- `npm run dev`
3. Open the forwarded port `5173` (Vite dev server).

Notes:
- The devcontainer forwards port `5173` automatically.
- Static data under `Data/` is copied to `public/Data/` via `npm run copy-data` (run automatically before `dev` and `build`).

## Run locally

- Install dependencies: `npm ci`
- Start dev server: `npm run dev`

## Optional backend persistence (FastAPI)

By default, this app is offline-first and stores user data in IndexedDB.
If you want user lists persisted on a backend, see [backend/README.md](backend/README.md).

Frontend env var:
- `VITE_API_BASE_URL` (see [.env.example](.env.example))

### GitHub Pages (production)

This repo deploys to GitHub Pages via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

To enable backend sync in the deployed PWA:
- In GitHub, go to **Settings → Secrets and variables → Actions → Variables**
- Add a variable named `VITE_API_BASE_URL` with your API base URL (example: `https://app-bigyearpwa-api.orangegrass-53a5a44b.northeurope.azurecontainerapps.io`)

Notes:
- `VITE_API_BASE_URL` is baked into the build output at deploy time.
- If it’s unset, the app runs offline-only and will not sync to the backend.

## Preview production build (local)

- Build: `npm run build`
- Preview `dist/`: `npm run preview`

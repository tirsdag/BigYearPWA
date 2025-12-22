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

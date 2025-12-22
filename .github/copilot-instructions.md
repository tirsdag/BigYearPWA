# Copilot instructions — BigYearPWA

## What this repo is
- This folder is currently **design + data** for an offline-first BigYear PWA. The implementation details are defined in [TDD/big_year_pwa_technical_design_document_tdd.md](TDD/big_year_pwa_technical_design_document_tdd.md).
- Target runtime is **iPhone Safari** installed via **“Add to Home Screen”**; assume intermittent/no network after first load.

## Architecture (follow the TDD)
- Layering: **UI components → application services → domain models → repositories (IndexedDB) → static JSON assets**.
- There is **no backend**; all user state lives in **IndexedDB**.

## Data & file conventions (already in repo)
- Treat data under [Data](Data) as **static app assets**. When implementing the PWA, **copy these files into `public/`** so they can be fetched offline (and cached by the service worker).
- Species reference data lives in:
  - [Data/SPECIES-Aves.json](Data/SPECIES-Aves.json) (and other `Data/SPECIES-*.json`)
- Dimension presets/reference data: [Data/dimensions.json](Data/dimensions.json)
- Weekly statistics files are under [Data/WeekStat](Data/WeekStat) and follow:
  - `{SpeciesClass}-{WeekNumber}.json` with **no zero-padding** (examples: `Aves-2.json`, `Aves-22.json`)
- Ignore non-product files: [Data/test.json](Data/test.json) and [Data/generateStats.ps1](Data/generateStats.ps1)

## IndexedDB schema (must match TDD)
- Object stores + keys:
  - `species` (`speciesId`) — read-only reference
  - `dimensions` (`DimensionId`)
  - `lists` (`ListId`)
  - `entries` (`EntryId`)
- Species list creation: selecting 1+ classes should **add all species** from those classes as `entries`.

## Critical flows to preserve
- Seen toggle behavior:
  - `Seen=true` sets `SeenAt=now`; `Seen=false` clears `SeenAt`.
- “Probable species (this week)”:
  - Determine current week using **ISO week numbering**
  - Load `{Class}-{Week}.json` from [Data/WeekStat](Data/WeekStat)
  - Join by `speciesId` ↔ `speciesid` (note casing in stats JSON)
  - Sort by `rScore DESC`, then `obsCount DESC`

## User-owned data (important)
- Anything under [Lists](Lists) is **sample/reference only**. Real lists are created/edited by the iPhone user and persisted in **IndexedDB**.

## UI constraints (per TDD)
- Keep screens simple and separate:
  - Home / Lists, List detail, All species, Dimension sets, Probable species (this week)
- Styling: **CSS Modules or plain CSS** (TDD allows Tailwind, but default to the simplest option).

## When editing/adding code here
- Prefer **JavaScript (not TypeScript)** to match the TDD.
- Keep the domain JSON shape stable; avoid renaming keys that exist in the data files.

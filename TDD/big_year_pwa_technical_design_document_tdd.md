# BigYear PWA – Technical Design Document (TDD)

## 1. Purpose
This document defines the technical design for a **Progressive Web App (PWA)** named **BigYear**, intended for **local execution on an iPhone** (Safari + Add to Home Screen). The app supports birdwatching and wildlife planning using species lists, dimension sets, and weekly probability statistics.

The document is structured to be **ready for direct pasting into an AI code generator in Visual Studio Code** and emphasizes **simplicity, offline-first behavior, and maintainability**.

---

## 2. Scope

The BigYear PWA will:
- Run fully **offline** after initial load
- Store all data **locally** (IndexedDB)
- Support **five species classes**:
  - Amphibia
  - Aves
  - Insecta
  - Mammalia
  - Reptilia
- Allow users to:
  - Browse all species
  - Filter species by class
  - Manage dimension sets
  - Create and manage species lists
  - Mark species as seen/unseen
  - View probable species for the current week based on statistics files

---

## 3. Technology Stack

### 3.1 Frontend
- Framework: **React (JavaScript, not TypeScript)**
- Build tool: **Vite**
- State management: React hooks (useState, useEffect, useContext)
- Styling: **CSS Modules or plain CSS** (Tailwind optional)
- PWA features:
  - Service Worker
  - Web App Manifest

### 3.2 Storage

- **IndexedDB** (via a small wrapper such as idb)
- JSON files bundled with the app for static reference data

### 3.3 Platform
- Safari iOS
- Installed as PWA (Add to Home Screen)

---

## 4. Domain Model

### 4.1 Species

```json
{
  "speciesId": "01680",
  "sortCode": "10",
  "danishName": "Knortegås",
  "latinName": "Branta bernicla",
  "englishName": "Brant Goose",
  "speciesStatus": "A",
  "speciesType": "art",
  "speciesKingdom": "Animalia",
  "speciesClass": "Aves",
  "sortCodeInt": 10
}
```

**Notes:**
- Species are **read-only reference data**
- Loaded once and cached

---

### 4.2 DimensionSet

```json
{
  "DimensionId": "dimensionstring01",
  "Year": 2025,
  "Month": null,
  "WeekNumber": null,
  "LocationId": null,
  "Municipality": "Aarhus",
  "Region": null
}
```

**Purpose:**
- Defines a planning context
- Used as a parent for species lists

---

### 4.3 SpeciesList

```json
{
  "ListId": "listid01",
  "Name": "List-2025-0-0-matrikel",
  "CreatedAt": "2025-12-17",
  "DimensionId": "dimensionstring01",
  "Entries": []
}
```

---

### 4.4 SpeciesListEntry

```json
{
  "EntryId": "6d9a91e8-b93a-45f9-a626-c6a6fb7bcad7",
  "SpeciesId": "01680",
  "Seen": false,
  "SeenAt": null,
  "ReferenceLink": null,
  "Comment": null
}
```

---

### 4.5 Weekly Statistics File

**Filename convention:**
```
{SpeciesClass}-{WeekNumber}.json
```

**Example:** `Aves-22.json`

```json
{
  "species": [
    {
      "speciesid": "01680",
      "obsCount": 752,
      "indCount": 237625,
      "ratio": 315.99,
      "rScore": 6,
      "oScore": 4,
      "sortCode": "10",
      "sortCodeInt": 10,
      "DanishName": "Knortegås",
      "speciesStatus": "A"
    }
  ]
}
```

---

## 5. Application Architecture

### 5.1 Layered Design

```
UI Components
↓
Application Services
↓
Domain Models
↓
Repositories (IndexedDB)
↓
Static JSON Assets
```

---

## 6. Core Features & Flows

### 6.1 Species Browsing
- View all species
- Filter by:
  - SpeciesClass
- Sort by:
  - sortCodeInt
  - Danish name

---

### 6.2 Dimension Management
- View all dimension sets
- Create new dimension sets
- Select dimension set as active

---

### 6.3 Species List Management

#### Create List
- Select a DimensionSet
- Select one or more SpeciesClasses
- Automatically add **all species** from selected classes

#### View Lists
- User is presented with a list of SpeciesLists
- Selecting a list shows its species entries

---

### 6.4 Mark Species as Seen
- Toggle Seen / Unseen
- When Seen = true:
  - Set SeenAt = current timestamp
- When Seen = false:
  - Clear SeenAt

---

### 6.5 View All Species
- Separate view showing all species
- Filterable by SpeciesClass

---

### 6.6 Probable Species View

- Based on:
  - Active SpeciesList
  - Current calendar week
  - SpeciesClass
- Load `{Class}-{Week}.json`
- Match speciesId with list entries
- Sort by:
  - rScore DESC
  - obsCount DESC

---

## 7. Data Storage Design (IndexedDB)

### 7.1 Object Stores

| Store Name | Key | Description |
|----------|----|------------|
| species | speciesId | Static species data |
| dimensions | DimensionId | Dimension sets |
| lists | ListId | Species lists |
| entries | EntryId | Species list entries |

---

## 8. Offline Strategy

- Service Worker caches:
  - App shell
  - Static JSON files
- IndexedDB for all user data
- No network dependency after install

---

## 9. UI Structure (Simple)

### Screens
1. Home / Lists Overview
2. Species List Detail
3. All Species
4. Dimension Sets
5. Probable Species (This Week)

Navigation via bottom tab bar or simple menu

---

## 10. Maintainability Principles

- No backend dependency
- Clear separation of concerns
- Flat JSON data models
- Predictable file naming
- Minimal frameworks

---

## 11. Future Extensions (Out of Scope)

- Sync between devices
- User accounts
- Cloud backup
- Maps / GPS tracking

---

## 12. Acceptance Criteria

- App works fully offline
- User can create dimension sets
- User can create lists from dimension sets
- User can mark species as seen/unseen
- Weekly probable species are shown correctly
- App installs and runs on iPhone

---

**End of Document**


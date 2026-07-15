# Beta App

A personal climbing route logger for tracking how you climb, not just what you've climbed. Mountain Project tells you a route exists — Beta App tracks how you climb it, move by move.

Built as an Android-only app for use at the crag: log burns, record sequences, and track progress on projects over multiple sessions.

---

## Screenshots
<div>
  <div>
    <img width="300" alt="image" src="https://github.com/user-attachments/assets/b3e50ff3-0e06-4930-a340-4844630a3e6b" />
    <img width="300" alt="image" src="https://github.com/user-attachments/assets/3e057865-7712-4721-a28d-a22174bf4e3d" />
  </div>
  <div>
    <img width="300" alt="image" src="https://github.com/user-attachments/assets/f69d4eaf-fc0d-4119-80ed-0e2cd731f1cf" />
    <img width="300" alt="image" src="https://github.com/user-attachments/assets/bf1f25d9-497f-486f-92c8-74f92c3c9ee6" />
  </div>
</div>


---

## Features

**Built and working:**
- Log climbs with grade, style, attempts, and outcome
- Record beta sequences — hold-by-hold move notes for any route
- Browse a location hierarchy (region → crag → wall → route)
- Offline-first: all data lives in local SQLite; works without a connection
- Cloud sync to Supabase — push/pull climbs and burns across devices
- Admin-managed reference data: grades, locations, and routes synced from Supabase
- Per-region offline download — cache route and location data for a whole area
- Image caching per climb
- Auth via email/password with role-based admin access

**Planned:**
- Magic link / passkey auth
- Sun/shade exposure tracking per wall and route                                                                                                                                                          
- Approach path overlays on the map (GPX upload → polyline render)                                                                                                                                        
- Bolt and anchor indicators in the route topo viewer                                                                                                                                                     
- Realtime sync (currently full push/pull on demand) 

---

## Stack & Architecture

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Android target) |
| UI | React 19 + TypeScript strict |
| Styling | Tailwind CSS 4 |
| Routing | TanStack Router (memory history — required for Android WebView) |
| Data fetching | TanStack Query |
| Forms | TanStack Form + Zod v4 |
| Local DB | SQLite via `tauri-plugin-sql` |
| Cloud | Supabase (auth + sync) |

**One non-obvious decision:** all database access runs on the JS side through `tauri-plugin-sql` rather than Rust commands. This keeps the data layer in TypeScript where it's easier to iterate on, at the cost of slightly more IPC overhead — an acceptable trade for a personal app where query volume is low.

The sync model is intentionally simple: on demand, push all local climbs then pull all server climbs. Delta sync is planned but deprioritised until the schema stabilises.

---

## Status

Active development. Core logging and sync work as a daily driver. UI has rough edges; admin tooling (location/grade management) is functional but still WIP.

---

## Setup

Requires the [Tauri Android prerequisites](https://tauri.app/start/prerequisites/#android) (Android Studio, NDK, etc.).

```bash
pnpm install
cargo tauri android dev        # dev build on connected device/emulator
cargo tauri android build --debug    # debug APK
cargo tauri android build --release  # release APK
```

Supabase credentials go in a `.env` file at the project root (not committed):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

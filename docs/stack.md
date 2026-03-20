# Stack

Technology choices for BetaApp. For usage patterns, see the relevant README in `src/`.

---

| Technology | Why | Key rule |
|---|---|---|
| **Tauri 2** | Native Android APK wrapping a web UI; access to SQLite and system APIs without React Native overhead | No custom Rust data commands — all SQLite access is JS-side via `tauri-plugin-sql` |
| **React 19 + TypeScript** | Standard Tauri frontend; strict mode catches entire classes of bugs at compile time | `"strict": true` always; no `any`; functional components only |
| **Tailwind CSS** | Utility-first; no context switching between files | Dark-only — write dark styles as base, never use `dark:` variants |
| **Biome** | Single tool replaces ESLint + Prettier | `pnpm lint` must pass with zero warnings before any commit |
| **TanStack Router** | Route params are part of the TypeScript type system | Use `createMemoryHistory` — browser history causes blank screen in Android WebView |
| **TanStack Query** | Eliminates `useEffect` data fetching, loading booleans, cache invalidation bugs | Every async operation goes through a hook; never call service functions directly from components |
| **TanStack Form** | Field-level validation + async submission state | Use Zod `.safeParse()` directly — do not install `@tanstack/zod-form-adapter` |
| **Zustand** | Minimal boilerplate for UI state that doesn't belong in the server cache | Async data with loading/error state → TanStack Query; UI toggles/auth/sync status → Zustand |
| **Zod v4** | Runtime validation that data from Supabase and forms matches the TypeScript types | Validate at system boundaries only; keep schemas in `*.schema.ts` |
| **tauri-plugin-sql** | True embedded SQLite; works offline; data survives app restarts | All access via `src/lib/db.ts` — never import plugin directly in feature code |
| **Supabase** | Hosted Postgres with Auth, Realtime, RLS, and web dashboard as admin CMS | Credentials via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `.env` (gitignored) |
| **tauri-plugin-deep-link** | Handles `betaapp://` URL scheme on Android | Plugin registered; magic link auth wiring planned for Phase 11 |
| **Leaflet + react-leaflet** | Interactive maps with OSM + Stadia Alidade Satellite tiles | CSS imported in `main.tsx`; custom SVG marker icons; Stadia API key via `VITE_STADIA_API_KEY` |
| **recharts** | Composable React charting library for stats visualisations | Used in `StatsView`; chart colours are hardcoded hex values (CSS variables are not accessible inside canvas/SVG renderers) |
| **pnpm** | Fast, strict dependency resolution | Never use `npm` or `yarn` |

---

## Further reading

- `src/lib/README.md` — db.ts and supabase.ts client details
- `src/features/README.md` — service / query / store patterns
- `src/components/README.md` — form pattern, Tailwind rules
- `docs/android.md` — Tauri Android specifics, deep links, safe areas

# src/components

UI building blocks, organised by Atomic Design. No raw DB or Supabase calls — components receive data via props or TanStack Query hooks.

---

## Atomic Design levels

```
atoms       Smallest indivisible UI unit. No sub-components from this project.
molecules   Two or more atoms forming a simple cohesive unit.
organisms   Complex, self-contained sections. May use Query hooks or Zustand.
templates   Layout shells with no real data — just children/slots.
```

**Rule:** Components never import from `@/lib/db` or `@/lib/supabase`. Data comes from `*.queries.ts` hooks or props.

---

## Existing components

### Atoms
| Component | Purpose |
|---|---|
| `Button` | Primary action button, touch-target safe (`min-h-[48px]`) |
| `Input` | Text input with label support |
| `Select` | Dropdown select |
| `Spinner` | Loading indicator |
| `ToggleGroup` | Full-width segmented button toggle (e.g. todo/project/sent) |

### Molecules
| Component | Purpose |
|---|---|
| `ClimbCard` | Displays a single climb summary; handles tap + delete |
| `EditableDescription` | Read-only description text; admins see pencil icon for inline edit + save |
| `FilterPanel` | Collapsible status/type filter checkboxes with cross-filtered counts |
| `FormField` | Label + input/select + error message wrapper |
| `SyncStatus` | Reads `sync.store` and renders sync state indicator |
| `CoordinatePicker` | Fullscreen Leaflet overlay for picking coordinates; fixed center pin with drag-to-position pattern. Props: `value`, `defaultCenter`, `defaultZoom`, `markers` (reference pins), `onChange`, `onClose`. Exports `PickerMarker` type. |
| `Toast` | Single toast notification; rendered by `AppLayout` |

### Organisms
| Component | Purpose |
|---|---|
| `ClimbForm` | Full add/edit form — used by both `AddClimbView` and `EditClimbView` |
| `NavBar` | Bottom navigation bar: Home, Add, Search, Menu |
| `Drawer` | Slide-up modal sheet |

### Templates
| Component | Purpose |
|---|---|
| `AppLayout` | Root layout — safe areas, NavBar, Toast renderer |

---

## Component file structure

Components are flat files (not per-folder subfolders):

```
src/components/atoms/Button.tsx
src/components/molecules/ClimbCard.tsx
src/components/organisms/ClimbForm.tsx
src/components/templates/AppLayout.tsx
```

Import with the full path:
```ts
import { Button } from '@/components/atoms/Button'
import { ClimbCard } from '@/components/molecules/ClimbCard'
```

---

## TanStack Form pattern

Use Zod's `.safeParse()` directly in validators — do not install `@tanstack/zod-form-adapter`:

```ts
import { useForm } from '@tanstack/react-form'
import { ClimbFormSchema } from '@/features/climbs/climbs.schema'

const form = useForm({
  defaultValues: { name: '', grade: '', route_type: 'sport' as const, ... },
  onSubmit: async ({ value }) => {
    await addClimb.mutateAsync(value)
    navigate({ to: '/' })
  },
})

// Field validator
<form.Field
  name="grade"
  validators={{
    onBlur: ({ value }) => {
      const result = z.string().min(1, 'Grade is required').safeParse(value)
      return result.success ? undefined : result.error.issues[0]?.message
    },
  }}
>
  {(field) => (
    <FormField label="Grade" error={field.state.meta.errors[0]?.toString()}>
      <Select value={field.state.value} onChange={field.handleChange} ... />
    </FormField>
  )}
</form.Field>
```

**Rules:**
- `onBlur` validators only — avoids premature error messages
- Use `form.Subscribe` to read `isSubmitting` for button disabled state
- Never call service functions directly from `onClick` — always go through a mutation hook

---

## Design preset system

The app uses a **design preset** infrastructure for visual styling. The current preset is "Earth" — warm browns, greens, and amber inspired by the natural world of climbing.

### Font pairing

**Lora** (serif) — display font for page titles, route/climb names, grade displays, section headings. Self-hosted woff2 in `public/fonts/`.

**Source Sans 3** (sans-serif) — body font for text, labels, buttons, form fields. Self-hosted woff2 in `public/fonts/`.

Usage:
- `font-display` — Lora (headings, climb/route names, grades)
- `font-body` — Source Sans 3 (set on `body`, used by default)

### Semantic color tokens

Colors are defined as CSS custom properties in `src/App.css` and registered via Tailwind v4's `@theme` directive. Dark mode is the default; light mode activates when `:root` has the `.light` class.

**Never use raw stone-* classes for surfaces, text, or borders.** Use the semantic tokens:

| Token class | Dark hex | Light hex |
|---|---|---|
| `bg-surface-page` | `#3b3228` | `#faf6f1` |
| `bg-surface-card` | `#2a2420` | `#ffffff` |
| `bg-surface-nav` | `#1e1a16` | `#f5efe8` |
| `bg-surface-input` | `#2a2420` | `#f5efe8` |
| `bg-surface-hover` | `#3b3228` | `#f0e9e0` |
| `bg-surface-active` | `#4a3f34` | `#e0d6ca` |
| `border-border-default` | `#4a3f34` | `#e0d6ca` |
| `border-border-input` | `#1e1a16` | `#d4c9bc` |
| `text-text-primary` | `#f5f0eb` | `#2a2420` |
| `text-text-secondary` | `#b5a99b` | `#78716c` |
| `text-text-tertiary` | `#8a7e72` | `#a8a29e` |

### Accent tokens

| Token class | Value | Usage |
|---|---|---|
| `bg-accent-primary` / `text-accent-primary` | `#059669` (emerald-600) | Primary actions, active nav, checkboxes |
| `bg-accent-secondary` / `text-accent-secondary` | `#d97706` (amber-600) | Secondary buttons, secondary actions |

Status and badge tokens (`status-default`, `status-sent`, `status-todo`, `badge-sent-bg`, etc.) are also available — see `App.css` for the full list.

### Preset tokens

| Token | Usage |
|---|---|
| `--radius-sm/md/lg/xl/full` | Border radius via `rounded-[--radius-md]` etc. |
| `shadow-card` / `shadow-elevated` / `shadow-toast` | Shadows via `shadow-card` etc. |
| `border-card-border` | Card/toast border color |

Future presets (Glass, Minimal) override these same CSS variables — no component changes needed.

### Design system rules (new / updated components)

Follow these rules when creating or modifying any component:

**Typography:**
- All `<h1>`, `<h2>`, page titles, climb/route names, and grade displays must use `font-display`
- Body text, labels, form fields, and buttons use the default body font (no class needed)
- Use `font-semibold` on buttons, `font-medium` on inputs/selects
- Never use `font-bold` on inputs/selects (use `font-medium`)

**Colors — never use raw Tailwind color classes for:**
- Surfaces → use `bg-surface-*` tokens
- Text → use `text-text-*` tokens
- Borders → use `border-border-*` or `border-card-border` tokens
- Primary actions (buttons, active states, checkboxes) → use `accent-primary` token
- Secondary actions → use `accent-secondary` token
- Never use raw `emerald-*`, `zinc-*`, or `stone-*` for buttons, accents, or surfaces

**Exceptions** — raw Tailwind colors are OK for:
- Status indicators: `border-l-emerald-500` (success), `border-l-red-500` (error), `border-l-amber-500` (warning)
- Spinner border: `border-t-emerald-500`
- Destructive actions: `bg-red-800` (reject buttons)
- Overlay backdrops: `bg-black/60`

**Border radius:**
- Use preset tokens: `rounded-[--radius-sm]`, `rounded-[--radius-md]`, `rounded-[--radius-lg]`, `rounded-[--radius-xl]`, `rounded-[--radius-full]`
- Never use raw `rounded-md`, `rounded-lg`, etc. in new/modified components

**Shadows:**
- Cards: `shadow-card`
- Elevated elements (modals, popovers): `shadow-elevated`
- Toasts: `shadow-toast`

**Cards and containers:**
- Add `border border-card-border` to card-like surfaces
- Use `shadow-card` on cards
- Use `p-3.5` for card padding (or `p-4` for larger containers)

**Inputs/selects:**
- Use `p-2.5` padding
- Add `focus:border-accent-primary transition-colors` for focus states
- Wrap with `rounded-[--radius-lg]`

**Buttons (use `Button` atom):**
- `primary` variant → `bg-accent-primary text-white`
- `secondary` variant → `bg-accent-secondary text-white`
- `outlined` variant → `border-accent-primary text-accent-primary`
- All variants use `rounded-[--radius-md]` and `font-semibold`

**ToggleGroup:**
- Active state: `bg-accent-primary text-white`
- Wrap with `border border-border-default`

**NavBar:**
- Active tab icon: `text-accent-primary`

---

## Touch targets

Android guideline: minimum `min-h-[48px] min-w-[48px]` on all interactive elements.

---

## Safe areas

```tsx
// Fixed header
style={{ paddingTop: 'env(safe-area-inset-top)' }}

// Fixed footer / nav bar
style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}

// Scrollable content
<div className="flex-1 overflow-y-auto"
     style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 15px)' }}>
```

See `docs/android.md` for full safe-area guidance.

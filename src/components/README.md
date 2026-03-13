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
| `FilterPanel` | Collapsible status/type filter checkboxes with cross-filtered counts |
| `FormField` | Label + input/select + error message wrapper |
| `SyncStatus` | Reads `sync.store` and renders sync state indicator |
| `Toast` | Single toast notification; rendered by `AppLayout` |

### Organisms
| Component | Purpose |
|---|---|
| `ClimbForm` | Full add/edit form — used by both `AddClimbView` and `EditClimbView` |
| `NavBar` | Bottom navigation bar with route tabs |
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

## Tailwind — dark-only

This app is dark-only. Write dark styles as the base — never use `dark:` variants:

```tsx
// Correct
<div className="bg-gray-950 text-white">

// Wrong
<div className="bg-white dark:bg-gray-950">
```

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

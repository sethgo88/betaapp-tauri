# features/map

Map-specific data queries for the Personal mode in MapView. Discovery mode uses location queries directly (`useAllCragsWithCoords`, `useAllWallsWithCoords`).

---

## map.service.ts

| Function | What it does |
|---|---|
| `fetchPersonalCrags(userId)` | Crags with lat/lng where the user has climbs. Returns route count, climb count, and per-status counts (sent, project, todo). |
| `fetchPersonalWalls(userId)` | Walls with lat/lng where the user has climbs. Returns route count and per-status counts. |
| `fetchClimbsAtPin(userId, pinType, pinId)` | Climbs logged at a specific crag or wall pin. Returns id, name, grade, sent_status for modal display. |

### Types

| Type | Fields |
|---|---|
| `PersonalCrag` | id, name, lat, lng, approach, route_count, climb_count, sent_count, project_count, todo_count, has_sent, has_project, has_todo |
| `PersonalWall` | id, crag_id, name, crag_name, lat, lng, approach, route_count, sent_count, project_count, todo_count |
| `PinClimb` | id, name, grade, sent_status |

---

## map.queries.ts

```ts
usePersonalCrags()                        // crags with user's climbs + coordinates
usePersonalWalls()                        // walls with user's climbs + coordinates
useClimbsAtPin(pinType, pinId)            // climbs at a specific crag/wall pin (for modal)
```

All are enabled only when a user is logged in.

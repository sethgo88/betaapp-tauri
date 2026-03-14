# Climbing Domain Knowledge

> Reference for contributors — how climbing concepts map to the BetaApp data model.

## Disciplines

There are two main categories of climbing tracked in BetaApp:

### Bouldering
- Climbing short rock formations ("boulders") without a rope
- Typically under 6 meters / 20 feet
- Uses crash pads for protection instead of ropes
- Graded on the V-scale (V0–V17) or Font scale (4a–9a)
- A single attempt on a boulder problem is called a "burn"

### Rope Climbing
Climbing taller rock faces ("walls") using a rope and protection. Two sub-disciplines:

**Sport climbing**
- Pre-placed permanent bolts are drilled into the rock for protection
- Climber clips quickdraws into the bolts as they ascend
- Graded on the YDS scale (5.0–5.15d) or French scale (4a–9c)

**Trad (traditional) climbing**
- No permanent bolts — climber places removable protection (cams, nuts) into natural features in the rock
- Gear is removed by the second climber (follower)
- Generally considered more adventurous / committing than sport
- Same grading scales as sport, sometimes with an additional "R" or "X" danger rating

## Physical Features

### Crag
A climbing area — a collection of walls and/or boulders in one location. A crag can contain:
- Only walls (rope climbing area)
- Only boulders (bouldering area)
- A mix of both

### Wall
A vertical or near-vertical rock face. Primarily climbed with a rope but can have any combination of sport routes, trad routes, and boulder problems on it (e.g., a short bouldering traverse at the base of a wall).

### Boulder
A smaller, standalone rock formation. Primarily climbed without a rope (boulder problems), though the data model allows tracking any discipline.

## Mapping to BetaApp Data Model

| Concept | Table | Key fields |
|---|---|---|
| Crag | `crags` / `crags_cache` | `sport_count`, `trad_count`, `boulder_count` (rolled up from child walls) |
| Wall or Boulder | `walls` / `walls_cache` | `wall_type` ('wall' \| 'boulder'), `sport_count`, `trad_count`, `boulder_count` |
| Route / Problem | `routes` / `routes_cache` | `route_type` ('sport' \| 'trad' \| 'boulder'), `wall_id`, `verified` |
| Climb log | `climbs` | User's personal log of attempting a route |
| Burn | `burns` | Individual attempt on a climb |

## Filtering Logic (Map View)

Three filter checkboxes: **Sport**, **Trad**, **Boulder**

- A pin shows if it has `> 0` count for any checked discipline
- When no filters are checked, all pins show (fallback)
- `wall_type` distinguishes the physical feature (wall vs boulder) for search/display purposes
- The discipline counts (`sport_count`, etc.) are maintained by Supabase triggers on route verification, not derived at query time

## Terminology Quick Reference

- **Send** — successfully completing a route/problem from bottom to top
- **Project** — a route the climber is actively working on but hasn't sent yet
- **Beta** — information about how to climb a route (sequences, holds, techniques)
- **Burn** — a single attempt on a route
- **Flash** — sending on first attempt (with prior beta)
- **Onsight** — sending on first attempt with no prior beta
- **Redpoint** — sending after previous failed attempts

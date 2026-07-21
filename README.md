# Photo Shoot Planner

A Claude-compatible MCP server and skill suite for both photography trips and professional photoshoot productions.

## Two planning modes

### Outdoor and astrophotography trips

- Resolve locations and normalize GPS coordinates
- Calculate moon phase, rise/set, altitude/azimuth, Milky Way core position, golden/blue hour, and astronomical darkness
- Review hourly cloud layers, visibility, wind, humidity, and precipitation
- Interpret supplied Bortle/SQM measurements without inventing site ratings
- Compare viewpoints, estimate routes, discover nearby lodging, and recommend camera settings

### Managed photoshoot productions

- Convert the objective into a creative brief and visual direction
- Plan mood boards, locations, shot lists, talent, and crew
- Build budgets, equipment plans, wardrobe/prop manifests, and call sheets
- Track permits, insurance, model/property releases, and usage rights
- Run a final readiness gate before distributing the production book

## Skill suite

The skills follow the modular pattern used by AI job-search collections: one coordinating workflow plus focused specialists that can trigger independently.

| Skill | Responsibility |
|---|---|
| `plan-photo-production` | Coordinate the complete production book |
| `develop-creative-brief` | Objectives, audience, deliverables, usage, approvals |
| `build-photo-mood-board` | Visual references, palette, lighting, styling rules |
| `scout-photo-location` | Creative fit, light, access, permits, logistics, backup |
| `create-photo-shot-list` | Required coverage, setup grouping, priorities, timing |
| `coordinate-talent-crew` | Roles, bookings, responsibilities, travel, contacts |
| `build-photo-call-sheet` | Calls, schedule, meals, moves, weather, safety |
| `manage-shoot-budget` | Estimates, commitments, actuals, contingency, variance |
| `plan-photo-equipment` | Camera, lighting, grip, power, storage, redundancy |
| `manage-wardrobe-props` | Looks, props, products, continuity, returns |
| `check-shoot-permits-releases` | Permit/release/insurance issue spotting and status |

## MCP tools

| Tool | Purpose |
|---|---|
| `resolve_location` | Convert a place name to candidate coordinates |
| `get_astronomy` | Daily sun/moon windows and phase |
| `get_sky_timeline` | Moon and Milky Way positions through a session |
| `get_weather` | Hourly shoot-condition forecast |
| `assess_dark_sky` | Interpret supplied Bortle or SQM data |
| `compare_viewpoints` | Rank candidate locations |
| `plan_route` | Estimate route distance and duration |
| `find_nearby_lodging` | Discover mapped lodging near a location |
| `recommend_camera_settings` | Gear-specific starting settings |
| `calculate_shoot_budget` | Calculate category totals, tax, contingency, and variance |
| `build_call_sheet` | Validate schedule math and person-level conflicts |
| `generate_release_checklist` | Generate a case-specific legal-readiness checklist |
| `validate_shoot_readiness` | Separate production blockers from warnings |
| `create_shooting_plan` | Produce a printable outdoor field plan |

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm test
npm start
```

### Claude Desktop developer configuration

Build with `npm run build`, then configure the absolute server path:

```json
{
  "mcpServers": {
    "photo-shoot-planner": {
      "command": "node",
      "args": ["C:/absolute/path/photo-shoot-planner/dist/index.js"]
    }
  }
}
```

Try either:

- “Compare Sequoia and Death Valley for Milky Way photography next weekend with a Nikon Z30.”
- “Plan a six-person editorial fashion shoot and produce the brief, shot list, budget, call sheet, and readiness report.”

## Package as a Claude extension

```bash
npm install -g @anthropic-ai/mcpb
npm run build
mcpb validate manifest.json
mcpb pack
```

Install the resulting `.mcpb` from Claude Desktop → Settings → Extensions → Advanced settings → Install Extension.

## Data and safety notes

The server sends coordinates and search queries to Open-Meteo, OpenStreetMap Nominatim, OSRM, and Overpass. These public services may rate-limit or be unavailable. Astronomy calculations are local.

Forecasts, access, closures, permits, labor rules, insurance, usage rights, wildfire smoke, tides, lodging, and legal requirements must be verified with the relevant authority or qualified professional. Tool output is planning support, not legal, safety, labor, or insurance advice.

## Schemas

Reusable contracts live in `schemas/` for shooting plans, creative briefs, shot lists, budgets, and call sheets. Tool inputs are validated with Zod-generated JSON Schema.

## License

MIT

# Photo Shoot Planner

<p align="center">
  <img src="assets/mascot/photo-scout.png" alt="Photo Shoot Planner mascot: a pixel-art photo scout bird carrying a camera and shoot plan" width="280">
</p>

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

## Install

Requires Node.js 20 or newer. First clone and build the project:

```bash
git clone https://github.com/chenyuan99/photo-shoot-planner.git
cd photo-shoot-planner
npm ci
npm run build
```

### Install the skills in Codex

Codex discovers personal skills in `~/.agents/skills`. Copying the skill folders there makes them available in every workspace.

macOS or Linux:

```bash
mkdir -p ~/.agents/skills
cp -R skills/. ~/.agents/skills/
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force "$HOME/.agents/skills"
Copy-Item -Recurse -Force "skills/*" "$HOME/.agents/skills/"
```

For project-only installation, copy the folders to `.agents/skills/` inside the target repository instead. Codex detects skill changes automatically; restart Codex if the new skills do not appear.

The skills can provide instruction-only planning after this step. Configure the MCP server below if you also want live location, weather, astronomy, routing, budget, call-sheet, and readiness tools.

### Configure the MCP server

Run the server locally to verify the build:

```bash
npm test
npm start
```

To register the local server with Codex, replace the example path with the absolute path to this checkout:

```bash
codex mcp add photo-shoot-planner -- node /absolute/path/photo-shoot-planner/dist/index.js
codex mcp list
```

The ChatGPT desktop app, Codex CLI, and IDE extension share the Codex MCP configuration. Restart the active client after adding the server, then use `/mcp` to confirm it is connected.

For Claude Desktop development, configure the same absolute server path:

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

## Use the skills

In Codex, run `/skills` or type `$` in the prompt to browse installed skills. You can invoke a skill explicitly or describe the task naturally and let Codex choose the matching skill.

Use the coordinating skill for a complete professional production:

```text
$plan-photo-production Plan a six-person editorial fashion shoot in Brooklyn on
September 18. The budget cap is $12,000. Produce the brief, shot list, crew plan,
budget, equipment list, call sheet, release checklist, and readiness report.
```

Invoke a specialist when you need one focused deliverable:

```text
$build-photo-call-sheet Create a call sheet for a product shoot from 8:00 AM to
6:00 PM, with two studio setups, a 45-minute lunch, and a 30-minute strike.
```

```text
$scout-photo-location Compare three locations for a golden-hour portrait shoot.
Evaluate creative fit, access, permits, weather risk, and a backup option.
```

Natural-language requests work too:

- "Compare Sequoia and Death Valley for Milky Way photography next weekend with a Nikon Z30."
- "Build a budget and equipment plan for a two-day commercial product shoot."
- "Audit this call sheet for timing conflicts, missing breaks, and readiness blockers."

For stronger results, include the shoot type, objective, date, location, deliverables, team size, budget, equipment constraints, usage rights, deadlines, and known safety or accessibility needs. Missing noncritical details can remain `TBD` with an owner and due date.

## Package as a Claude extension

```bash
npm install -g @anthropic-ai/mcpb
npm run build
mcpb validate manifest.json
mcpb pack
```

Install the resulting `.mcpb` from Claude Desktop -> Settings -> Extensions -> Advanced settings -> Install Extension.

## Data and safety notes

The server sends coordinates and search queries to Open-Meteo, OpenStreetMap Nominatim, OSRM, and Overpass. These public services may rate-limit or be unavailable. Astronomy calculations are local.

Forecasts, access, closures, permits, labor rules, insurance, usage rights, wildfire smoke, tides, lodging, and legal requirements must be verified with the relevant authority or qualified professional. Tool output is planning support, not legal, safety, labor, or insurance advice.

## Schemas

Reusable contracts live in `schemas/` for shooting plans, creative briefs, shot lists, budgets, and call sheets. Tool inputs are validated with Zod-generated JSON Schema.

## License

MIT

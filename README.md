# Photo Shoot Planner

A Claude-compatible local MCP server for planning landscape, moonrise, Milky Way and dark-sky photography trips. It converts the workflows in the referenced planning conversation into reusable, validated tools rather than hard-coded advice.

## Capabilities

- Place-name geocoding and GPS normalization
- Moon phase, illumination, rise/set, altitude/azimuth timeline
- Golden hour, blue hour and astronomical darkness
- Hourly cloud layers, visibility, wind, humidity and precipitation
- Honest Bortle/SQM interpretation (never invents a site rating)
- Viewpoint ranking by darkness, horizon, access and foreground
- Route estimates and nearby lodging discovery
- Camera/lens-specific starting settings, including Nikon DX/APS-C
- Printable Markdown field plans, itineraries and packing checklists

## Tool surface

| Tool | Purpose |
|---|---|
| `resolve_location` | Convert a place name to candidate coordinates |
| `get_astronomy` | Daily sun/moon windows and phase |
| `get_sky_timeline` | Moon position samples across a session |
| `get_weather` | Hourly shoot-condition forecast |
| `assess_dark_sky` | Interpret supplied Bortle or SQM data |
| `compare_viewpoints` | Rank two or more candidate sites |
| `plan_route` | Route distance and duration estimate |
| `find_nearby_lodging` | Discover mapped lodging near a site |
| `recommend_camera_settings` | Subject and gear-specific starting values |
| `create_shooting_plan` | Produce a printable field plan |

## Run locally

Requires Node.js 20+.

```bash
npm install
npm test
npm start
```

### Claude Desktop developer configuration

Build first with `npm run build`, then add the absolute path to Claude's MCP configuration:

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

Restart Claude Desktop and try: “Use Photo Shoot Planner to compare Sequoia and Death Valley for Milky Way photography next weekend with a Nikon Z30.”

## Package as an installable Claude extension

```bash
npm install -g @anthropic-ai/mcpb
npm run build
mcpb validate
mcpb pack
```

Install the resulting `.mcpb` from Claude Desktop → Settings → Extensions → Advanced settings → Install Extension.

## Network and data notes

The server sends coordinates and queries to Open-Meteo, OpenStreetMap Nominatim, OSRM and Overpass. These public services may rate-limit or be unavailable. Forecasts, access rules, closures, wildfire smoke, tides and lodging availability must be rechecked before travel. Astronomy calculations are local. No API keys are required.

## Design notes

- MCP stdio keeps it compatible with Claude Desktop and other MCP hosts.
- Tools return readable JSON plus structured content.
- Inputs use Zod-generated JSON Schema and reject invalid coordinates/ranges.
- Remote requests have timeouts and identify the client.
- `prompts/photography-trip-planner.md` is the reusable orchestration prompt.
- `schemas/shoot-plan.schema.json` documents the final plan contract.

## License

MIT

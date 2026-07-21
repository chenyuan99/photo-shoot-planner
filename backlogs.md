# Product Backlog

## Reference-project adoption

Ideas evaluated from:

- [marcowangcreative/planner](https://github.com/marcowangcreative/planner)
- [yiding7/selfie-studio-planner](https://github.com/yiding7/selfie-studio-planner)
- [GuitarDude99/photo-shoot-planner-Mike-R](https://github.com/GuitarDude99/photo-shoot-planner-Mike-R)
- [TheNinja14/photo-shoot-planner](https://github.com/TheNinja14/photo-shoot-planner)

Reuse these as product patterns rather than copying source code until each repository's license is confirmed.

### High priority

- [ ] Replace the string-only itinerary with structured events containing start/end time, location, subject, priority, equipment, notes, and contingency triggers.
- [ ] Add a must-shoot checklist for foreground tests, blue-hour exposures, panorama sequences, Milky Way stacks, calibration frames, and backup compositions.
- [ ] Extend `create_shooting_plan` to return a self-contained, printable HTML field card alongside Markdown.
- [ ] Add structured operational notes for access instructions, permits, parking, gate hours, emergency contacts, cell coverage, wildlife, and site restrictions.
- [ ] Add beginner-friendly execution guidance covering setup diagrams, focusing, composition, interval shooting, stacking, and concrete post-processing steps.

### Medium priority

- [ ] Formalize the workflow as Research -> Conditions -> Plan -> Field Handoff, preserving partial results when weather, routing, or lodging services fail.
- [ ] Add structured go/no-go thresholds: cloud cover, wind and gust limits, minimum visibility, precipitation cutoff, moon-altitude constraints, and latest departure time.
- [ ] Recommend affordable alternatives and improvised setups, including entry-level lenses, phone apps, foreground lighting, and DIY dew control.
- [ ] Add a tool that converts pasted briefs, permit notes, workshop itineraries, or client requirements into the shoot-plan schema.
- [ ] Keep schema keys stable while allowing user-facing plan values to use the requested language.

### Low priority

- [ ] Generate composition and location-reference image search queries while keeping image retrieval outside the core MCP server.
- [ ] Add optional people, client, and creative-role fields if the project expands beyond landscape and night-sky trips.

### Not planned

- Do not adopt the full image-search and vision-reranking pipeline yet; it would add substantial provider, API-key, cost, and maintenance complexity outside the current MCP server's focus.
- Do not adopt browser `localStorage` persistence or direct browser-side API-key handling; those patterns do not fit the current MCP architecture.
- No implementation is currently worth adopting from `TheNinja14/photo-shoot-planner`, whose `index.html` is empty.

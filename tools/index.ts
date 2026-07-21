import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { astronomyPlan, compareCandidates, fetchJson, galacticCenterPosition, settings } from "./lib.js";

const coords = { latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) };
const result = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: { result: data } });
const server = new McpServer({ name: "photo-shoot-planner", version: "0.2.0" }, {
  instructions: "For a trip plan: resolve locations, call astronomy and weather, assess darkness/viewpoints, then camera settings. For a production: establish the creative brief and deliverables, then location, shot list, crew, budget, equipment, wardrobe/props, permits/releases, call sheet, and readiness gate. Clearly label forecasts, estimates, assumptions, unconfirmed bookings, legal uncertainty, access uncertainty, and timezone. Never claim a Bortle class without a supplied or sourced measurement."
});

server.tool("resolve_location", "Geocode a place name to candidate coordinates using OpenStreetMap Nominatim.", { query: z.string().min(2), limit: z.number().int().min(1).max(5).default(3) }, async ({ query, limit }) => {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&q=${encodeURIComponent(query)}`;
  const rows = await fetchJson(url) as Array<Record<string, string>>;
  return result(rows.map(r => ({ name: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon), type: r.type })));
});

server.tool("get_astronomy", "Compute moon phase/rise/set, golden hour, blue hour, and astronomical darkness for coordinates and an ISO date/time.", { ...coords, dateTime: z.string().datetime() }, async ({ latitude, longitude, dateTime }) => result(astronomyPlan({ latitude, longitude }, new Date(dateTime))));

server.tool("get_sky_timeline", "Sample sun/moon positions through a shoot window; useful for moon alignment and Milky Way darkness planning.", { ...coords, start: z.string().datetime(), end: z.string().datetime(), intervalMinutes: z.number().int().min(5).max(180).default(30) }, async ({ latitude, longitude, start, end, intervalMinutes }) => {
  const out = []; const a = new Date(start).getTime(); const b = new Date(end).getTime();
  if (b <= a || b - a > 36 * 3600_000) throw new Error("Window must be positive and no longer than 36 hours.");
  for (let t = a; t <= b; t += intervalMinutes * 60_000) {
    const p = astronomyPlan({ latitude, longitude }, new Date(t));
    out.push({ time: new Date(t).toISOString(), moon: p.moon, milkyWayCore: galacticCenterPosition({ latitude, longitude }, new Date(t)) });
  }
  return result(out);
});

server.tool("get_weather", "Fetch hourly cloud cover, visibility, precipitation, wind and temperature from Open-Meteo for a shoot window.", { ...coords, startDate: z.string().date(), endDate: z.string().date(), timezone: z.string().default("auto") }, async ({ latitude, longitude, startDate, endDate, timezone }) => {
  const hourly = "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,precipitation_probability,wind_speed_10m,wind_gusts_10m,temperature_2m,relative_humidity_2m";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=${hourly}&timezone=${encodeURIComponent(timezone)}&forecast_days=16`;
  return result(await fetchJson(url));
});

server.tool("assess_dark_sky", "Interpret a supplied Bortle class or sky-quality reading. Does not invent a site rating.", { bortleClass: z.number().int().min(1).max(9).optional(), sqm: z.number().min(15).max(23).optional(), moonIlluminationPercent: z.number().min(0).max(100).default(0), cloudCoverPercent: z.number().min(0).max(100).default(0) }, async (x) => {
  if (!x.bortleClass && !x.sqm) throw new Error("Supply bortleClass or SQM reading.");
  const estimated = x.bortleClass ?? (x.sqm! >= 21.7 ? 2 : x.sqm! >= 21.3 ? 3 : x.sqm! >= 20.5 ? 4 : x.sqm! >= 19.5 ? 5 : x.sqm! >= 18.5 ? 6 : 8);
  const suitability = Math.max(0, Math.round(100 - (estimated - 1) * 11 - x.moonIlluminationPercent * 0.35 - x.cloudCoverPercent * 0.45));
  return result({ bortleClass: estimated, suitabilityScore: suitability, interpretation: estimated <= 3 ? "excellent dark sky" : estimated <= 5 ? "usable rural/suburban sky" : "significant light pollution", note: "Bortle is observational and varies locally; validate with a recent light-pollution map or on-site SQM." });
});

server.tool("compare_viewpoints", "Rank candidate viewpoints using darkness, horizon, access, and foreground scores.", { candidates: z.array(z.object({ name: z.string(), ...coords, bortleClass: z.number().int().min(1).max(9).optional(), horizonScore: z.number().min(0).max(10).optional(), accessScore: z.number().min(0).max(10).optional(), foregroundScore: z.number().min(0).max(10).optional(), notes: z.string().optional() })).min(2).max(20) }, async ({ candidates }) => result(compareCandidates(candidates)));

server.tool("plan_route", "Estimate driving route, distance and duration between coordinates using the public OSRM service.", { origin: z.object(coords), destination: z.object(coords) }, async ({ origin, destination }) => {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=false&steps=false`;
  const json = await fetchJson(url) as any; const r = json.routes?.[0];
  return result(r ? { distanceKm: r.distance / 1000, durationMinutes: r.duration / 60, caveat: "Estimate excludes current traffic, closures, permits, and gate hours." } : { error: "No route found" });
});

server.tool("find_nearby_lodging", "Find nearby mapped hotels/motels/hostels via OpenStreetMap Overpass; verify availability and breakfast directly.", { ...coords, radiusKm: z.number().min(1).max(100).default(30), limit: z.number().int().min(1).max(30).default(10) }, async ({ latitude, longitude, radiusKm, limit }) => {
  const q = `[out:json][timeout:20];nwr[\"tourism\"~\"hotel|motel|hostel|guest_house\"](around:${radiusKm * 1000},${latitude},${longitude});out center tags;`;
  const json = await fetchJson(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`, 25000) as any;
  return result((json.elements ?? []).slice(0, limit).map((e: any) => ({ name: e.tags?.name ?? "Unnamed lodging", brand: e.tags?.brand, latitude: e.lat ?? e.center?.lat, longitude: e.lon ?? e.center?.lon, website: e.tags?.website, phone: e.tags?.phone, source: "OpenStreetMap" })));
});

server.tool("recommend_camera_settings", "Generate conservative starting settings for a camera/lens and subject; photographer must meter and adjust on site.", { camera: z.string(), sensor: z.enum(["full-frame", "aps-c", "micro-four-thirds", "other"]), cropFactor: z.number().min(0.5).max(4), focalLengthMm: z.number().min(4).max(2000), maxAperture: z.number().min(0.7).max(32), stabilization: z.boolean().default(false), tripod: z.boolean().default(true), subject: z.enum(["moon", "milky-way", "starscape", "golden-hour"]) }, async ({ subject, ...profile }) => result(settings(profile, subject)));

server.tool("calculate_shoot_budget", "Calculate estimated, committed, and actual photoshoot costs with tax, contingency, category totals, and variances.", {
  currency: z.string().length(3).default("USD"),
  taxRatePercent: z.number().min(0).max(100).default(0),
  contingencyPercent: z.number().min(0).max(100).default(10),
  budgetCap: z.number().nonnegative().optional(),
  lines: z.array(z.object({
    category: z.string().min(1), description: z.string().min(1), quantity: z.number().positive().default(1),
    unitCost: z.number().nonnegative(), status: z.enum(["estimated", "committed", "actual"]).default("estimated"),
    actualCost: z.number().nonnegative().optional(), taxable: z.boolean().default(true), owner: z.string().optional(), source: z.string().optional()
  })).min(1).max(500)
}, async ({ currency, taxRatePercent, contingencyPercent, budgetCap, lines }) => {
  const enriched = lines.map(line => ({ ...line, estimatedCost: line.quantity * line.unitCost, effectiveCost: line.actualCost ?? line.quantity * line.unitCost }));
  const subtotal = enriched.reduce((sum, line) => sum + line.estimatedCost, 0);
  const taxableSubtotal = enriched.filter(line => line.taxable).reduce((sum, line) => sum + line.estimatedCost, 0);
  const tax = taxableSubtotal * taxRatePercent / 100;
  const contingency = subtotal * contingencyPercent / 100;
  const projectedTotal = subtotal + tax + contingency;
  const actualTotal = enriched.reduce((sum, line) => sum + line.effectiveCost, 0);
  const byCategory = Object.values(enriched.reduce<Record<string, { category: string; estimated: number; effective: number }>>((acc, line) => {
    const row = acc[line.category] ??= { category: line.category, estimated: 0, effective: 0 };
    row.estimated += line.estimatedCost; row.effective += line.effectiveCost; return acc;
  }, {}));
  return result({ currency, subtotal, tax, contingency, projectedTotal, actualOrCurrentTotal: actualTotal, varianceFromEstimate: actualTotal - subtotal, budgetCap, remainingAgainstCap: budgetCap === undefined ? null : budgetCap - projectedTotal, overCap: budgetCap === undefined ? null : projectedTotal > budgetCap, byCategory, lines: enriched });
});

server.tool("build_call_sheet", "Validate schedule math and produce a structured call sheet with overlaps, gaps, and total production-day duration.", {
  project: z.string(), shootDate: z.string().date(), timezone: z.string(), location: z.string(), generalCall: z.string().datetime(), estimatedWrap: z.string().datetime(),
  contacts: z.array(z.object({ role: z.string(), name: z.string(), contact: z.string().optional() })).default([]),
  events: z.array(z.object({ id: z.string(), title: z.string(), start: z.string().datetime(), end: z.string().datetime(), people: z.array(z.string()).default([]), setupId: z.string().optional(), notes: z.string().optional() })).min(1).max(200),
  bufferTargetPercent: z.number().min(0).max(50).default(15)
}, async (p) => {
  const events = p.events.map(e => ({ ...e, durationMinutes: (new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000 })).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const invalidDurations = events.filter(e => e.durationMinutes <= 0).map(e => e.id);
  const overlaps: Array<{ person: string; first: string; second: string }> = [];
  const byPerson = new Map<string, typeof events>();
  for (const event of events) for (const person of event.people) byPerson.set(person, [...(byPerson.get(person) ?? []), event]);
  for (const [person, rows] of byPerson) {
    const sorted = rows.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    for (let i = 1; i < sorted.length; i++) if (Date.parse(sorted[i].start) < Date.parse(sorted[i - 1].end)) overlaps.push({ person, first: sorted[i - 1].id, second: sorted[i].id });
  }
  const dayMinutes = (Date.parse(p.estimatedWrap) - Date.parse(p.generalCall)) / 60000;
  const scheduledMinutes = events.reduce((sum, e) => sum + Math.max(0, e.durationMinutes), 0);
  return result({ ...p, events, summary: { dayMinutes, scheduledMinutes, unscheduledMinutes: dayMinutes - scheduledMinutes, actualBufferPercent: dayMinutes > 0 ? Math.round((dayMinutes - scheduledMinutes) / dayMinutes * 1000) / 10 : 0, targetBufferPercent: p.bufferTargetPercent }, validation: { valid: invalidDurations.length === 0 && overlaps.length === 0 && dayMinutes > 0, invalidDurations, overlaps, warnings: [dayMinutes <= 0 ? "Estimated wrap must be after general call." : null, scheduledMinutes > dayMinutes ? "Event durations exceed the production day; parallel work may be valid, but review capacity." : null].filter(Boolean) } });
});

server.tool("generate_release_checklist", "Generate a case-specific issue-spotting checklist for permits, releases, insurance, and usage rights. This is not legal advice.", {
  jurisdiction: z.string(), purpose: z.enum(["personal", "editorial", "commercial", "advertising", "stock"]), propertyType: z.enum(["public", "private", "studio", "mixed"]),
  recognizablePeople: z.boolean(), minors: z.boolean().default(false), recognizablePrivateProperty: z.boolean().default(false), artworkOrTrademarks: z.boolean().default(false),
  drone: z.boolean().default(false), tripodOrLargeFootprint: z.boolean().default(false), streetImpact: z.boolean().default(false), vehiclesOrAnimals: z.boolean().default(false),
  intendedUses: z.array(z.string()).default([])
}, async (p) => {
  const items = [
    { item: "Location authority and permit rules", needed: p.propertyType !== "studio" || p.tripodOrLargeFootprint || p.streetImpact, status: "likely required—verify" },
    { item: "Written location agreement", needed: p.propertyType === "private" || p.propertyType === "studio" || p.propertyType === "mixed", status: "likely required—verify" },
    { item: "Model releases", needed: p.recognizablePeople && p.purpose !== "editorial", status: "likely required—verify" },
    { item: "Minor releases and guardian/work-rule review", needed: p.minors, status: "likely required—verify" },
    { item: "Property release", needed: p.recognizablePrivateProperty && ["commercial", "advertising", "stock"].includes(p.purpose), status: "likely required—verify" },
    { item: "Artwork/trademark clearance review", needed: p.artworkOrTrademarks, status: "likely required—verify" },
    { item: "Drone authorization and airspace/park review", needed: p.drone, status: "likely required—verify" },
    { item: "Traffic/sidewalk/parking coordination", needed: p.streetImpact, status: "likely required—verify" },
    { item: "Animal handler or vehicle permission/safety review", needed: p.vehiclesOrAnimals, status: "likely required—verify" },
    { item: "Certificate of insurance and additional-insured terms", needed: p.purpose !== "personal", status: "likely required—verify" },
    { item: "Usage grant: media, territory, term, exclusivity, editing and sublicensing", needed: p.purpose !== "personal", status: "likely required—verify" }
  ].filter(x => x.needed);
  return result({ jurisdiction: p.jurisdiction, intendedUses: p.intendedUses, checklist: items, disclaimer: "Issue-spotting only. Confirm requirements and document language with the relevant authority, insurer, union/agency, or qualified local counsel." });
});

server.tool("validate_shoot_readiness", "Score production readiness and separate critical blockers from warnings and completed checks.", {
  checks: z.array(z.object({ area: z.enum(["creative", "deliverables", "location", "crew", "talent", "schedule", "budget", "equipment", "wardrobe-props", "legal", "safety", "weather-backup", "data-delivery"]), item: z.string(), status: z.enum(["complete", "in-progress", "blocked", "not-started", "not-applicable"]), critical: z.boolean().default(false), owner: z.string().optional(), dueDate: z.string().optional(), evidence: z.string().optional() })).min(1).max(300)
}, async ({ checks }) => {
  const applicable = checks.filter(c => c.status !== "not-applicable");
  const complete = applicable.filter(c => c.status === "complete");
  const blockers = applicable.filter(c => c.critical && c.status !== "complete");
  const warnings = applicable.filter(c => !c.critical && c.status !== "complete");
  const score = applicable.length ? Math.round(complete.length / applicable.length * 100) : 100;
  return result({ ready: blockers.length === 0, readinessScore: score, blockers, warnings, completed: complete.length, applicable: applicable.length, recommendation: blockers.length ? "Do not issue a final call sheet until critical blockers are resolved or explicitly accepted by the authorized producer." : warnings.length ? "Proceed conditionally with named owners and deadlines for warnings." : "Production readiness checks complete." });
});

server.tool("create_shooting_plan", "Turn verified inputs into a printable Markdown field plan. Pass only facts already gathered; unknowns remain explicit.", { title: z.string(), date: z.string(), locations: z.array(z.object({ name: z.string(), coordinates: z.object(coords), bestWindow: z.string(), direction: z.string().optional(), notes: z.array(z.string()).default([]) })), astronomySummary: z.string(), weatherSummary: z.string(), cameraSummary: z.string(), itinerary: z.array(z.string()), packing: z.array(z.string()).default([]), risks: z.array(z.string()).default([]) }, async (p) => {
  const md = `# ${p.title}\n\n**Date:** ${p.date}\n\n## Go / no-go summary\n\n- Astronomy: ${p.astronomySummary}\n- Weather: ${p.weatherSummary}\n- Camera: ${p.cameraSummary}\n\n## Locations\n\n${p.locations.map((l, i) => `${i + 1}. **${l.name}** — ${l.coordinates.latitude}, ${l.coordinates.longitude}\n   - Window: ${l.bestWindow}${l.direction ? `\n   - Aim: ${l.direction}` : ""}${l.notes.map(n => `\n   - ${n}`).join("")}`).join("\n")}\n\n## Itinerary\n\n${p.itinerary.map(x => `- [ ] ${x}`).join("\n")}\n\n## Packing checklist\n\n${p.packing.map(x => `- [ ] ${x}`).join("\n")}\n\n## Risks and checks\n\n${p.risks.map(x => `- [ ] ${x}`).join("\n")}\n`;
  return result({ markdown: md, printHint: "Save as .md or print from Claude. Re-check weather, closures, permits and road status shortly before departure." });
});

server.prompt("plan_photo_trip", "Plan a complete photography trip with evidence and a field-ready handoff.", { destination: z.string(), date: z.string(), subject: z.string().optional(), camera: z.string().optional() }, ({ destination, date, subject, camera }) => ({ messages: [{ role: "user", content: { type: "text", text: `Plan a photography trip to ${destination} on ${date} for ${subject ?? "the best available landscape/sky subject"}. Camera: ${camera ?? "ask or use generic settings"}. Resolve coordinates first. Check astronomy and weather, assess darkness without inventing Bortle data, compare viewpoints, check routes/access/lodging, recommend settings and create a printable plan. Separate sourced facts, computations, forecasts and assumptions.` } }] }));

server.prompt("compare_photo_locations", "Compare candidate photo locations for a date and subject.", { locations: z.string(), date: z.string(), subject: z.string() }, ({ locations, date, subject }) => ({ messages: [{ role: "user", content: { type: "text", text: `Compare these locations for ${subject} on ${date}: ${locations}. Resolve each place, gather astronomy and weather, request or source Bortle/SQM rather than guessing, evaluate access and foreground, then rank with tradeoffs and a backup.` } }] }));

server.prompt("plan_photo_production", "Build a complete professional photoshoot production book.", { shootType: z.string(), concept: z.string(), date: z.string().optional(), teamScale: z.string().optional(), budget: z.string().optional() }, ({ shootType, concept, date, teamScale, budget }) => ({ messages: [{ role: "user", content: { type: "text", text: `Plan a ${shootType} photoshoot for this concept: ${concept}. Date: ${date ?? "TBD"}. Team scale: ${teamScale ?? "TBD"}. Budget: ${budget ?? "TBD"}. Use the skill-based workflow: creative brief, mood board, location scout, shot list, talent/crew, budget, equipment, wardrobe/props, permits/releases, call sheet, and readiness validation. Keep unconfirmed facts marked TBD and produce a concise production book.` } }] }));

const transport = new StdioServerTransport();
await server.connect(transport);

import SunCalc from "suncalc";
import type { CameraProfile, Candidate, Coordinates } from "./types.js";

export const assertCoords = ({ latitude, longitude }: Coordinates) => {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Invalid coordinates: latitude must be -90..90 and longitude -180..180.");
  }
};

export const iso = (d: Date | undefined) => d ? d.toISOString() : null;

export function galacticCenterPosition(coords: Coordinates, date: Date) {
  // J2000 Galactic Center: RA 17h45m40.04s, Dec -29°00′28.1″.
  const raDeg = 266.41683;
  const decDeg = -29.00781;
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  const lst = (gmst + coords.longitude + 360) % 360;
  const hourAngle = ((lst - raDeg + 540) % 360) - 180;
  const rad = Math.PI / 180;
  const lat = coords.latitude * rad, dec = decDeg * rad, ha = hourAngle * rad;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha));
  const azimuth = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(ha));
  return {
    altitudeDeg: altitude / rad,
    azimuthDeg: (azimuth / rad + 360) % 360,
    aboveHorizon: altitude > 0,
    note: "Geometric J2000 Galactic Center position; terrain, refraction and sky brightness are not modeled."
  };
}

export function astronomyPlan(coords: Coordinates, date: Date) {
  assertCoords(coords);
  const times = SunCalc.getTimes(date, coords.latitude, coords.longitude);
  const moonTimes = SunCalc.getMoonTimes(date, coords.latitude, coords.longitude, true);
  const moonIllum = SunCalc.getMoonIllumination(date);
  const moonPos = SunCalc.getMoonPosition(date, coords.latitude, coords.longitude);
  return {
    date: date.toISOString(),
    sun: {
      sunrise: iso(times.sunrise), sunset: iso(times.sunset),
      goldenHourMorningEnd: iso(times.goldenHourEnd), goldenHourEveningStart: iso(times.goldenHour),
      blueHourMorningApprox: [iso(times.dawn), iso(times.sunrise)],
      blueHourEveningApprox: [iso(times.sunset), iso(times.dusk)],
      astronomicalDark: [iso(times.night), iso(times.nightEnd)]
    },
    moon: {
      rise: iso(moonTimes.rise), set: iso(moonTimes.set), alwaysUp: moonTimes.alwaysUp ?? false,
      illuminationPercent: Math.round(moonIllum.fraction * 1000) / 10,
      phaseFraction: moonIllum.phase,
      altitudeDegAtRequestedTime: moonPos.altitude * 180 / Math.PI,
      azimuthDegAtRequestedTime: (moonPos.azimuth * 180 / Math.PI + 180 + 360) % 360,
      phaseName: phaseName(moonIllum.phase)
    },
    notes: [
      "Times are ISO timestamps; display them in the shoot location's timezone.",
      "Milky Way core visibility also depends on season, latitude, horizon and moonlight; use astronomical darkness plus the timeline tool."
    ]
  };
}

export function phaseName(p: number) {
  if (p < 0.03 || p > 0.97) return "new moon";
  if (p < 0.22) return "waxing crescent";
  if (p < 0.28) return "first quarter";
  if (p < 0.47) return "waxing gibbous";
  if (p < 0.53) return "full moon";
  if (p < 0.72) return "waning gibbous";
  if (p < 0.78) return "last quarter";
  return "waning crescent";
}

export function settings(profile: CameraProfile, subject: "moon" | "milky-way" | "starscape" | "golden-hour") {
  const eq = Math.round(profile.focalLengthMm * profile.cropFactor);
  if (subject === "moon") return {
    startingPoint: profile.tripod
      ? { mode: "M", aperture: "f/8", shutter: "1/125–1/250s", iso: "100–400" }
      : { mode: "M", aperture: `f/${Math.max(profile.maxAperture, 5.6)}`, shutter: `1/${Math.max(250, Math.ceil(eq * 1.5 / 50) * 50)}s`, iso: "Auto, cap 3200" },
    focus: "AF-S single point on lunar edge, then verify at 100%", capture: "RAW; 3–5 frame bursts; bracket foreground separately"
  };
  if (subject === "milky-way" || subject === "starscape") {
    const shutter = Math.max(2, Math.floor(400 / (profile.focalLengthMm * profile.cropFactor)));
    return {
      startingPoint: { mode: "M", aperture: `f/${profile.maxAperture}`, shutter: `${shutter}s`, iso: "3200 (adjust 1600–6400)" },
      focus: "Manual; magnify a bright star and minimize its size", capture: "RAW; long-exposure NR off; stabilization off on tripod; 10-frame stack recommended",
      warning: profile.focalLengthMm * profile.cropFactor > 35 ? "This lens is tight for the Milky Way; use a panorama or a wider lens." : undefined
    };
  }
  return { startingPoint: { mode: "A", aperture: "f/8", iso: "100", exposureCompensation: "-0.3 EV" }, capture: "RAW; bracket ±2 EV for high-contrast scenes" };
}

export function compareCandidates(candidates: Candidate[]) {
  return candidates.map(c => {
    const dark = c.bortleClass ? (10 - c.bortleClass) * 10 : 45;
    const score = dark * 0.4 + (c.horizonScore ?? 5) * 2 + (c.accessScore ?? 5) * 2 + (c.foregroundScore ?? 5) * 2;
    return { ...c, score: Math.round(score * 10) / 10, caveat: c.bortleClass ? undefined : "Bortle class not supplied; dark-sky score is provisional." };
  }).sort((a, b) => b.score - a.score);
}

export async function fetchJson(url: string, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "photo-shoot-planner/0.1 (local MCP tool)" } });
    if (!res.ok) throw new Error(`Remote service returned HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

import test from "node:test";
import assert from "node:assert/strict";
import { astronomyPlan, compareCandidates, galacticCenterPosition, settings } from "../lib.js";

test("astronomy returns bounded moon values", () => {
  const x = astronomyPlan({ latitude: 40.79, longitude: -74.24 }, new Date("2026-07-20T21:00:00Z"));
  assert.ok(x.moon.illuminationPercent >= 0 && x.moon.illuminationPercent <= 100);
  assert.ok(x.moon.azimuthDegAtRequestedTime >= 0 && x.moon.azimuthDegAtRequestedTime < 360);
});

test("candidate ranking rewards darker sky", () => {
  const r = compareCandidates([
    { name: "bright", latitude: 0, longitude: 0, bortleClass: 8, horizonScore: 8 },
    { name: "dark", latitude: 1, longitude: 1, bortleClass: 2, horizonScore: 8 }
  ]);
  assert.equal(r[0].name, "dark");
});

test("APS-C star shutter accounts for crop", () => {
  const r: any = settings({ camera: "Nikon Z30", sensor: "aps-c", cropFactor: 1.5, focalLengthMm: 20, maxAperture: 2.8, tripod: true }, "milky-way");
  assert.equal(r.startingPoint.shutter, "13s");
});

test("galactic center position is bounded", () => {
  const p = galacticCenterPosition({ latitude: 36.46, longitude: -116.87 }, new Date("2026-07-20T08:00:00Z"));
  assert.ok(p.altitudeDeg >= -90 && p.altitudeDeg <= 90);
  assert.ok(p.azimuthDeg >= 0 && p.azimuthDeg < 360);
});

"""Black-box tests for the compiled photo-shoot-planner library.

The production implementation remains TypeScript. These tests invoke its compiled
JavaScript through Node so Python assertions cover the code users actually run.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import unittest
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]

NODE_BRIDGE = r"""
import * as planner from './dist/lib.js';

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const request = JSON.parse(chunks.join(''));

try {
  let value;
  switch (request.operation) {
    case 'astronomyPlan':
      value = planner.astronomyPlan(request.coordinates, new Date(request.date));
      break;
    case 'galacticCenterPosition':
      value = planner.galacticCenterPosition(request.coordinates, new Date(request.date));
      break;
    case 'compareCandidates':
      value = planner.compareCandidates(request.candidates);
      break;
    case 'settings':
      value = planner.settings(request.profile, request.subject);
      break;
    default:
      throw new Error(`Unknown operation: ${request.operation}`);
  }
  process.stdout.write(JSON.stringify({ ok: true, value }));
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));
}
"""


class PlannerTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        npm = shutil.which("npm") or shutil.which("npm.cmd")
        if npm is None:
            raise unittest.SkipTest("npm is required to compile the TypeScript project")
        if shutil.which("node") is None:
            raise unittest.SkipTest("Node.js is required to exercise the compiled library")

        build = subprocess.run(
            [npm, "run", "build"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        if build.returncode != 0:
            raise AssertionError(
                f"TypeScript build failed before Python tests:\n{build.stdout}\n{build.stderr}"
            )

    def call_planner(self, operation: str, **payload: Any) -> Any:
        request = {"operation": operation, **payload}
        completed = subprocess.run(
            ["node", "--input-type=module", "--eval", NODE_BRIDGE],
            cwd=ROOT,
            input=json.dumps(request),
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(
            completed.returncode,
            0,
            msg=f"Node bridge failed:\n{completed.stdout}\n{completed.stderr}",
        )
        try:
            response = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            self.fail(f"Node bridge returned invalid JSON: {exc}\n{completed.stdout}")
        return response


class AstronomyTests(PlannerTestCase):
    def test_astronomy_values_are_bounded_and_times_are_iso(self) -> None:
        response = self.call_planner(
            "astronomyPlan",
            coordinates={"latitude": 40.79, "longitude": -74.24},
            date="2026-07-20T21:00:00Z",
        )

        self.assertTrue(response["ok"])
        plan = response["value"]
        self.assertGreaterEqual(plan["moon"]["illuminationPercent"], 0)
        self.assertLessEqual(plan["moon"]["illuminationPercent"], 100)
        self.assertGreaterEqual(plan["moon"]["azimuthDegAtRequestedTime"], 0)
        self.assertLess(plan["moon"]["azimuthDegAtRequestedTime"], 360)
        self.assertRegex(plan["date"], r"^2026-07-20T21:00:00\.000Z$")

    def test_invalid_coordinates_are_rejected(self) -> None:
        response = self.call_planner(
            "astronomyPlan",
            coordinates={"latitude": 91, "longitude": 0},
            date="2026-07-20T21:00:00Z",
        )

        self.assertFalse(response["ok"])
        self.assertIn("latitude must be -90..90", response["error"])

    def test_galactic_center_position_is_bounded(self) -> None:
        response = self.call_planner(
            "galacticCenterPosition",
            coordinates={"latitude": 36.46, "longitude": -116.87},
            date="2026-07-20T08:00:00Z",
        )

        self.assertTrue(response["ok"])
        position = response["value"]
        self.assertGreaterEqual(position["altitudeDeg"], -90)
        self.assertLessEqual(position["altitudeDeg"], 90)
        self.assertGreaterEqual(position["azimuthDeg"], 0)
        self.assertLess(position["azimuthDeg"], 360)


class PlanningTests(PlannerTestCase):
    def test_candidate_ranking_rewards_darker_sky_when_other_scores_match(self) -> None:
        response = self.call_planner(
            "compareCandidates",
            candidates=[
                {
                    "name": "bright",
                    "latitude": 0,
                    "longitude": 0,
                    "bortleClass": 8,
                    "horizonScore": 8,
                    "accessScore": 7,
                    "foregroundScore": 6,
                },
                {
                    "name": "dark",
                    "latitude": 1,
                    "longitude": 1,
                    "bortleClass": 2,
                    "horizonScore": 8,
                    "accessScore": 7,
                    "foregroundScore": 6,
                },
            ],
        )

        self.assertTrue(response["ok"])
        ranked = response["value"]
        self.assertEqual([item["name"] for item in ranked], ["dark", "bright"])
        self.assertGreater(ranked[0]["score"], ranked[1]["score"])

    def test_missing_bortle_data_is_marked_provisional(self) -> None:
        response = self.call_planner(
            "compareCandidates",
            candidates=[
                {"name": "unknown", "latitude": 0, "longitude": 0},
                {
                    "name": "measured",
                    "latitude": 1,
                    "longitude": 1,
                    "bortleClass": 4,
                },
            ],
        )

        self.assertTrue(response["ok"])
        unknown = next(x for x in response["value"] if x["name"] == "unknown")
        self.assertIn("provisional", unknown["caveat"].lower())

    def test_aps_c_star_shutter_accounts_for_crop_factor(self) -> None:
        response = self.call_planner(
            "settings",
            profile={
                "camera": "Nikon Z30",
                "sensor": "aps-c",
                "cropFactor": 1.5,
                "focalLengthMm": 20,
                "maxAperture": 2.8,
                "tripod": True,
            },
            subject="milky-way",
        )

        self.assertTrue(response["ok"])
        self.assertEqual(response["value"]["startingPoint"]["shutter"], "13s")


class SchemaTests(unittest.TestCase):
    def test_shoot_plan_schema_has_required_contract(self) -> None:
        schema_path = ROOT / "schemas" / "shoot-plan.schema.json"
        schema = json.loads(schema_path.read_text(encoding="utf-8"))

        self.assertEqual(schema["$schema"], "https://json-schema.org/draft/2020-12/schema")
        self.assertEqual(schema["type"], "object")
        self.assertTrue(
            {
                "title",
                "date",
                "locations",
                "astronomySummary",
                "weatherSummary",
                "cameraSummary",
                "itinerary",
            }.issubset(schema["required"])
        )
        self.assertEqual(schema["properties"]["locations"]["minItems"], 1)
        coordinates = schema["$defs"]["location"]["properties"]["coordinates"]
        self.assertEqual(coordinates["properties"]["latitude"]["minimum"], -90)
        self.assertEqual(coordinates["properties"]["latitude"]["maximum"], 90)
        self.assertEqual(coordinates["properties"]["longitude"]["minimum"], -180)
        self.assertEqual(coordinates["properties"]["longitude"]["maximum"], 180)


if __name__ == "__main__":
    unittest.main()

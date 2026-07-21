import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("MCP server exposes production tools and calculates a budget", async () => {
  const serverPath = fileURLToPath(new URL("../index.js", import.meta.url));
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: "photo-shoot-planner-test", version: "0.1.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map(tool => tool.name);
    for (const expected of ["calculate_shoot_budget", "build_call_sheet", "generate_release_checklist", "validate_shoot_readiness"]) {
      assert.ok(names.includes(expected), `missing tool: ${expected}`);
    }
    const response = await client.callTool({
      name: "calculate_shoot_budget",
      arguments: {
        currency: "USD", taxRatePercent: 10, contingencyPercent: 10, budgetCap: 1500,
        lines: [{ category: "crew", description: "assistant", quantity: 1, unitCost: 1000, taxable: true }]
      }
    });
    const structured = response.structuredContent as { result: { projectedTotal: number; overCap: boolean } };
    assert.equal(structured.result.projectedTotal, 1200);
    assert.equal(structured.result.overCap, false);
  } finally {
    await client.close();
  }
});

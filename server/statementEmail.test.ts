import assert from "node:assert/strict";
import test from "node:test";
import { escapeHtml, renderStatementEmail } from "./email";

test("statement HTML escapes every dynamic transaction value", () => {
  assert.equal(escapeHtml(`<&"' >`), "&lt;&amp;&quot;&#39; &gt;");
  const html = renderStatementEmail({
    firstName: `<img src=x onerror=alert(1)>`,
    startDate: "2025-01-01",
    endDate: "2025-01-01",
    generatedAt: "2025-01-01T12:00:00.000Z",
    rows: [{
      source: "<source>", service: `"service"`, timestamp: "2025-01-01T12:00:00.000Z",
      type: "<type>", amount: "1.00", fee: "0.00", status: "<status>",
      reference: `'<ref>'`, description: "<description>",
    }],
  });
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(html.includes("&lt;source&gt;"));
  assert.ok(html.includes("&#39;&lt;ref&gt;&#39;"));
  assert.ok(!html.includes("<img src=x onerror=alert(1)>"));
  assert.ok(!html.includes("New Balance"));
});
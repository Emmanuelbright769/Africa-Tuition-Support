import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routes = fs.readFileSync(new URL("./routes.ts", import.meta.url), "utf8");

test("market candles consume yahoo-finance2 v3 chart quotes", () => {
  const start = routes.indexOf("async function getIteraCandles");
  const end = routes.indexOf("// ── USD/NGN", start);
  const source = routes.slice(start, end);
  assert.match(source, /Array\.isArray\(chart\?\.quotes\)/);
  assert.match(source, /quote\.date/);
  assert.match(source, /quote\.open/);
  assert.match(source, /quote\.high/);
  assert.match(source, /quote\.low/);
  assert.match(source, /quote\.close/);
  assert.doesNotMatch(source, /synthetic|Math\.random/);
});

test("transaction PIN notification includes a direct settings action", () => {
  assert.match(routes, /action: "open_transaction_pin_settings"/);
  assert.match(routes, /SwiftWallet, open Me, then choose Security and Transaction PIN/);
});
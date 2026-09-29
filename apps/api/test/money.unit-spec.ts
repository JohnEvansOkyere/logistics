import assert from "node:assert/strict";
import { test } from "node:test";
import { convertMinor } from "@bjh/contracts";

test("conversion uses exact integer arithmetic and rounds half up", () => {
  assert.equal(convertMinor(25000, "15.25"), 381250);
  assert.equal(convertMinor(1, "0.5"), 1);
  assert.equal(convertMinor(1, "0.49999999"), 0);
  assert.equal(convertMinor(333, "15.255"), 5080);
  assert.equal(convertMinor(0, "15"), 0);
  assert.equal(convertMinor(100, "1"), 100);
  // Large amounts stay exact where floating point would drift.
  assert.equal(convertMinor(999_999_999_999, "1.00000001"), 1_000_000_009_999);
});

import test from "node:test";
import assert from "node:assert/strict";
import { recordLeaf, closureRoot, derive } from "../src/gitpp.js";

const PINNED_ROOT = "60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d";

test("closure root at task-c against the live poc-quilt-1 set", async () => {
  const r = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1");
  if (!r.ok) {
    console.log("  (network unavailable, skipping)");
    return;
  }
  const j = await r.json();
  const root = await closureRoot(j.records, "task-c");
  assert.equal(root, PINNED_ROOT, `closure root drift: got ${root}`);
});

test("fold against the live poc-quilt-1 set produces the same state", async () => {
  const r = await fetch("https://gitpp.superinstance.dev/api/state?project=poc-quilt-1");
  if (!r.ok) {
    console.log("  (network unavailable, skipping)");
    return;
  }
  const live = await r.json();
  const recordsR = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1");
  const recordsJ = await recordsR.json();
  const d = derive(recordsJ.records);
  // Compare state — JSON.stringify with sort to ignore key order
  assert.deepEqual(d.state, live.state, "state drift");
});

test("fold against the live set produces the same conflicts", async () => {
  const r = await fetch("https://gitpp.superinstance.dev/api/state?project=poc-quilt-1");
  if (!r.ok) return;
  const live = await r.json();
  const recordsR = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1");
  const recordsJ = await recordsR.json();
  const d = derive(recordsJ.records);
  // Sort conflicts and losers
  const sortConflicts = (cs) => cs.map(c => ({
    key: c.key, winner: c.winner, losers: [...c.losers].sort()
  })).sort((a, b) => a.key < b.key ? -1 : 1);
  assert.deepEqual(sortConflicts(d.conflicts), sortConflicts(live.conflicts));
});

test("fold against the live set produces the same order", async () => {
  const r = await fetch("https://gitpp.superinstance.dev/api/state?project=poc-quilt-1");
  if (!r.ok) return;
  const live = await r.json();
  const recordsR = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1");
  const recordsJ = await recordsR.json();
  const d = derive(recordsJ.records);
  assert.deepEqual(d.order, live.order);
});

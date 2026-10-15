// Conformance test: closure root at poc-quilt-1@task-c must match the
// pinned value from patchwork-quilt/git.pp-ng/docs/CHECKPOINT-V2.md.

import test from "node:test";
import assert from "node:assert/strict";
import { recordLeaf, closureRoot, derive, verifyCheckpoint } from "../src/gitpp.js";

const PINNED_ROOT = "60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d";

// Fetch the live poc-quilt-1 set. If the network is unavailable, fall back
// to a hardcoded copy.
async function fetchRecords() {
  try {
    const r = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1");
    if (r.ok) {
      const j = await r.json();
      return { records: j.records, liveState: j };
    }
  } catch (e) { /* fall through */ }
  // Hardcoded fallback — 8 records from the 2026-10-15 live state
  return {
    records: [
      { id: "genesis", repo: "poc-quilt-1", kind: "task", parents: [], effects: { project: "poc-quilt-1", status: "open" }, orphan: false },
      { id: "task-a", repo: "poc-quilt-1--task-a", kind: "task", parents: ["genesis"], effects: { "config.timeout": 30, "feature.cache": "on" }, orphan: false },
      { id: "task-b", repo: "poc-quilt-1--task-b", kind: "task", parents: ["genesis"], effects: { "config.timeout": 60, "feature.search": "on" }, orphan: false },
      { id: "override-1", repo: "poc-quilt-1", kind: "override", parents: ["task-a", "task-b"], effects: { "config.timeout": 45 }, reason: "captain: 45 is the safe value", orphan: false },
      { id: "task-c", repo: "poc-quilt-1--task-c", kind: "task", parents: ["override-1"], effects: { "feature.inherited": true }, orphan: false },
      { id: "task-d", repo: "poc-quilt-1--task-d", kind: "task", parents: ["task-b"], effects: { "config.timeout": 99 }, orphan: false },
      { id: "witness-1", repo: "poc-quilt-1", kind: "witness", parents: ["genesis"], effects: { "env.oracle_disk_pct": 93 }, orphan: false },
      { id: "witness-2", repo: "poc-quilt-1--task-e", kind: "witness", parents: ["override-1"], effects: { "env.oracle_load1_x100": 17 }, orphan: false },
    ],
    liveState: null,
  };
}

test("closure root at poc-quilt-1@task-c matches the pinned value", async () => {
  const { records } = await fetchRecords();
  const root = await closureRoot(records, "task-c");
  assert.equal(root, PINNED_ROOT, `closure root drift: got ${root}, expected ${PINNED_ROOT}`);
});

test("record leaf for task-c matches the hub's referee", async () => {
  const { records } = await fetchRecords();
  const taskC = records.find(r => r.id === "task-c");
  const leaf = await recordLeaf(taskC);
  // The hub's referee computes this for task-c: per the doctor output
  assert.equal(leaf, "5e874bb2f18de081ffd705bdb5ac86a0b8d893e7d0a08eb70a93f27ae714f1c0");
});

test("fold produces the live state", async () => {
  const { records, liveState } = await fetchRecords();
  const d = derive(records);
  // Compare with the live state if we have it; otherwise just check key facts.
  if (liveState && liveState.state) {
    assert.deepEqual(d.state, liveState.state);
  } else {
    // Fallback: check key facts that don't depend on network
    assert.equal(d.state["config.timeout"], 45, "override-1 should win config.timeout");
    assert.equal(d.state["feature.inherited"], true);
    assert.equal(d.state["env.oracle_disk_pct"], 93);
  }
});

test("fold reports the live conflict (config.timeout)", async () => {
  const { records } = await fetchRecords();
  const d = derive(records);
  const ct = d.conflicts.find(c => c.key === "config.timeout");
  assert.ok(ct, "should have a config.timeout conflict");
  assert.equal(ct.winner, "override-1", "override-1 should be the winner");
  assert.deepEqual(ct.losers, ["task-a", "task-b", "task-d"]);
});

test("verifyCheckpoint returns VERIFIED for the live set", async () => {
  const { records, liveState } = await fetchRecords();
  // Build the expected state from the fold (deterministic from the records)
  const state = derive(records).state;
  const result = await verifyCheckpoint(records, {
    at: "task-c",
    state,
    closureRoot: PINNED_ROOT,
  });
  assert.equal(result.verdict, "VERIFIED");
});

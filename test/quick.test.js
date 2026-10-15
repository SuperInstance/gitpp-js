import test from "node:test";
import assert from "node:assert/strict";
import { recordLeaf, closureRoot, derive } from "../src/gitpp.js";

const records = [
  { id: "genesis", kind: "task", parents: [], effects: { project: "poc-quilt-1", status: "open" } },
  { id: "task-a", kind: "task", parents: ["genesis"], effects: { "config.timeout": 30, "feature.cache": "on" } },
  { id: "task-b", kind: "task", parents: ["genesis"], effects: { "config.timeout": 60, "feature.search": "on" } },
  { id: "override-1", kind: "override", parents: ["task-a", "task-b"], effects: { "config.timeout": 45 }, reason: "captain: 45 is the safe value" },
  { id: "task-c", kind: "task", parents: ["override-1"], effects: { "feature.inherited": true } },
  { id: "task-d", kind: "task", parents: ["task-b"], effects: { "config.timeout": 99 } },
  { id: "witness-1", kind: "witness", parents: ["genesis"], effects: { "env.oracle_disk_pct": 93 } },
  { id: "witness-2", kind: "witness", parents: ["override-1"], effects: { "env.oracle_load1_x100": 17 } },
];

test("closure root at task-c matches pinned value", async () => {
  const root = await closureRoot(records, "task-c");
  assert.equal(root, "60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d",
    `closure root drift: got ${root}`);
});

test("record leaf for task-c matches the hub's referee", async () => {
  const taskC = records.find(r => r.id === "task-c");
  const leaf = await recordLeaf(taskC);
  assert.equal(leaf, "5e874bb2f18de081ffd705bdb5ac86a0b8d893e7d0a08eb70a93f27ae714f1c0",
    `task-c leaf drift: got ${leaf}`);
});

test("fold produces the right state", () => {
  const d = derive(records);
  assert.equal(d.state["config.timeout"], 45, "override-1 should win config.timeout");
  assert.equal(d.state["feature.inherited"], true);
  assert.equal(d.state["env.oracle_disk_pct"], 93);
  assert.equal(d.state["feature.cache"], "on");
  assert.equal(d.state["feature.search"], "on");
  assert.equal(d.state["env.oracle_load1_x100"], 17);
  assert.equal(d.state["project"], "poc-quilt-1");
  assert.equal(d.state["status"], "open");
});

test("fold reports the conflict for config.timeout", () => {
  const d = derive(records);
  const ct = d.conflicts.find(c => c.key === "config.timeout");
  assert.ok(ct, "should have a config.timeout conflict");
  assert.equal(ct.winner, "override-1");
  assert.deepEqual(ct.losers, ["task-a", "task-b", "task-d"]);
});

test("topo order is correct", () => {
  const d = derive(records);
  assert.deepEqual(d.order, ["genesis", "task-a", "task-b", "override-1", "task-c", "task-d", "witness-1", "witness-2"]);
});

test("no orphans in the live set", () => {
  const d = derive(records);
  assert.deepEqual(d.orphans, []);
});

test("class precedence: override > task > witness", () => {
  const d = derive(records);
  // config.timeout: override-1 (45) wins over task-a (30), task-b (60), task-d (99)
  assert.equal(d.state["config.timeout"], 45);
});

test("ancestry reduction: descendant beats ancestor within the same class", () => {
  // Add a task-a-2 that's a descendant of task-a and sets a new key
  const r2 = [
    ...records,
    { id: "task-a-2", kind: "task", parents: ["task-a"], effects: { "feature.cache": "off" } },
  ];
  const d = derive(r2);
  // task-a-2 is more derived than task-a; both set feature.cache to different values
  // task-a-2 should win (more intent ancestors wins tie-break? No — ancestry reduction: task-a-2 is a descendant, so task-a is dominated.)
  // Actually: task-a-2 should win because it's a descendant of task-a, so task-a is dominated.
  // Wait — but both have the same intent-ancestor count. Let me think.
  // After ancestry reduction: only task-a-2 survives (task-a is dominated by its descendant task-a-2).
  // So state should be "off" from task-a-2.
  assert.equal(d.state["feature.cache"], "off");
});

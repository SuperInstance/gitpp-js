// Cycle-affected records are orphans for output purposes (spec §5.5).
//
// The 13 cases below are the discriminating set from SuperInstance/gitpp-reading-room
// (readers/py/cyclefix.py, CASES). They were chosen because no single natural
// rule passes all of them:
//
//   rule A "any parent missing from the applied set"  -> correct on cycle members? no
//   rule B "anything Kahn never emitted"               -> correct on missing-parent descendants? no
//   rule U3 three clauses                              -> correct on both
//
// Three of these are the load-bearing ones:
//
//   "desc of missing"    orphans must be ["orph"] ONLY. The kid's parent exists
//                       (it is orphaned, not absent), so the kid is orderable
//                       and NOT an orphan. Rule B regresses this.
//   "desc of 2-cycle"   orphans must be ["ca","cb","down"]. Rule A misses "down",
//                       whose parent exists but can never be topologically ordered.
//   "missing AND cycle" orphans must be ["ca","cb","m"]. Rule A returns ["m"],
//                       rule B returns ["ca","cb"]. Neither single rule passes.
//
// Every case has globally-unique effect keys, so the expected state is an
// unambiguous merge over the applied set and needs no tiebreak of its own.
import test from "node:test";
import assert from "node:assert/strict";
import { derive } from "../src/gitpp.js";

const CASES = [
  {
    name: "clean chain",
    records: [{"id": "a", "kind": "task", "parents": [], "effects": {}, "reason": null}, {"id": "b", "kind": "task", "parents": ["a"], "effects": {"x": 1}, "reason": null}],
    orphans: [],
    state: {"x": 1},
  },
  {
    name: "missing parent",
    records: [{"id": "a", "kind": "task", "parents": ["ghost"], "effects": {"x": 1}, "reason": null}],
    orphans: ["a"],
    state: {},
  },
  {
    name: "desc of missing",
    records: [{"id": "orph", "kind": "task", "parents": ["ghost"], "effects": {"x": 1}, "reason": null}, {"id": "kid", "kind": "task", "parents": ["orph"], "effects": {"y": 2}, "reason": null}],
    orphans: ["orph"],
    state: {"y": 2},
  },
  {
    name: "2-cycle",
    records: [{"id": "ca", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "cb", "kind": "task", "parents": ["ca"], "effects": {}, "reason": null}],
    orphans: ["ca", "cb"],
    state: {},
  },
  {
    name: "desc of 2-cycle",
    records: [{"id": "ca", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "cb", "kind": "task", "parents": ["ca"], "effects": {}, "reason": null}, {"id": "down", "kind": "task", "parents": ["cb"], "effects": {"y": 3}, "reason": null}],
    orphans: ["ca", "cb", "down"],
    state: {},
  },
  {
    name: "desc^2 of 2-cycle",
    records: [{"id": "ca", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "cb", "kind": "task", "parents": ["ca"], "effects": {}, "reason": null}, {"id": "d1", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "d2", "kind": "task", "parents": ["d1"], "effects": {"y": 4}, "reason": null}],
    orphans: ["ca", "cb", "d1", "d2"],
    state: {},
  },
  {
    name: "cycle + root",
    records: [{"id": "ca", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "cb", "kind": "task", "parents": ["ca"], "effects": {}, "reason": null}, {"id": "ok", "kind": "task", "parents": [], "effects": {"z": 5}, "reason": null}],
    orphans: ["ca", "cb"],
    state: {"z": 5},
  },
  {
    name: "two cycles",
    records: [{"id": "a", "kind": "task", "parents": ["b"], "effects": {}, "reason": null}, {"id": "b", "kind": "task", "parents": ["a"], "effects": {}, "reason": null}, {"id": "c", "kind": "task", "parents": ["d"], "effects": {}, "reason": null}, {"id": "d", "kind": "task", "parents": ["c"], "effects": {}, "reason": null}],
    orphans: ["a", "b", "c", "d"],
    state: {},
  },
  {
    name: "self-loop",
    records: [{"id": "a", "kind": "task", "parents": ["a"], "effects": {"x": 6}, "reason": null}],
    orphans: ["a"],
    state: {},
  },
  {
    name: "desc of self-loop",
    records: [{"id": "a", "kind": "task", "parents": ["a"], "effects": {}, "reason": null}, {"id": "k", "kind": "task", "parents": ["a"], "effects": {"y": 7}, "reason": null}],
    orphans: ["a", "k"],
    state: {},
  },
  {
    name: "diamond",
    records: [{"id": "r", "kind": "task", "parents": [], "effects": {}, "reason": null}, {"id": "l", "kind": "task", "parents": ["r"], "effects": {}, "reason": null}, {"id": "m", "kind": "task", "parents": ["r"], "effects": {}, "reason": null}, {"id": "j", "kind": "task", "parents": ["l", "m"], "effects": {"x": 8}, "reason": null}],
    orphans: [],
    state: {"x": 8},
  },
  {
    name: "cycle + branch",
    records: [{"id": "a", "kind": "task", "parents": ["b"], "effects": {}, "reason": null}, {"id": "b", "kind": "task", "parents": ["a"], "effects": {}, "reason": null}, {"id": "t", "kind": "task", "parents": ["r"], "effects": {}, "reason": null}, {"id": "r", "kind": "task", "parents": ["t"], "effects": {}, "reason": null}, {"id": "leaf", "kind": "task", "parents": ["r"], "effects": {"x": 9}, "reason": null}],
    orphans: ["a", "b", "leaf", "r", "t"],
    state: {},
  },
  {
    name: "missing AND cycle",
    records: [{"id": "ca", "kind": "task", "parents": ["cb"], "effects": {}, "reason": null}, {"id": "cb", "kind": "task", "parents": ["ca"], "effects": {}, "reason": null}, {"id": "m", "kind": "task", "parents": ["ghost"], "effects": {"q": 1}, "reason": null}, {"id": "mk", "kind": "task", "parents": ["m"], "effects": {"w": 2}, "reason": null}],
    orphans: ["ca", "cb", "m"],
    state: {"w": 2},
  },
];

for (const c of CASES) {
  test(`orphans: ${c.name}`, () => {
    const d = derive(c.records);
    assert.deepEqual(d.orphans, c.orphans, `orphans for "${c.name}"`);
    assert.deepEqual(d.state, c.state, `state for "${c.name}"`);
  });
}

// The counterexample from the spec §5.5 discussion, spelled out once more so
// the regression is readable without the table above.
test("cycle descendant is excluded from the fold and reported as an orphan", () => {
  const d = derive([
    { id: "ca", kind: "task", parents: ["cb"], effects: { x: "cycle-a" } },
    { id: "cb", kind: "task", parents: ["ca"], effects: { x: "cycle-b" } },
    { id: "down", kind: "task", parents: ["cb"], effects: { y: "downstream" } },
    { id: "ok", kind: "task", parents: [], effects: { z: "fine" } },
  ]);
  assert.deepEqual(d.state, { z: "fine" });
  assert.deepEqual(d.orphans, ["ca", "cb", "down"]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { derive } from "../src/gitpp.js";

// Spec v0.4.6 regression suite.
//
// Every case here is chosen so that a DIFFERENT, also-defensible reading
// of the spec produces a different state. Cases that all readings agree
// on are not included: they cannot fail, so they test nothing.
//
// The tie-break cases are the point of this file. The previous
// implementation ranked equal-class survivors by a three-tier heuristic
// (most intent ancestors, then fewest witness ancestors, then codepoint)
// that the spec does not contain. That heuristic is invisible whenever
// the competing candidates sit in ONE Kahn tier, because first-in-tier
// and smallest-codepoint then coincide -- which is why seven
// single-tier cases all passed while the comparator was wrong.

const R = (id, kind, parents, effects) => ({ id, kind, parents, effects, reason: null });

// --- class vs ancestry (§5.1: class FIRST, ancestry only breaks ties) ---

test("an override ANCESTOR outranks a task DESCENDANT", () => {
  const r = derive([
    R("o", "override", [], { x: 1 }),
    R("t", "task", ["o"], { x: 2 }),
  ]);
  assert.deepEqual(r.state, { x: 1 });
  assert.equal(r.setters.x, "o");
});

test("a witness DESCENDANT still loses to a task", () => {
  const r = derive([
    R("t", "task", [], { x: 1 }),
    R("w", "witness", ["t"], { x: 2 }),
  ]);
  assert.deepEqual(r.state, { x: 1 });
});

// --- unclassifiable records (§5.1 v0.4.6: rank below witness, one class) ---

test("two unclassifiable records contest a key -> first in topo order", () => {
  const r = derive([
    R("a", null, [], { x: 1 }),
    R("b", null, [], { x: 2 }),
  ]);
  assert.deepEqual(r.state, { x: 1 });
  assert.equal(r.setters.x, "a");
});

test("an unclassifiable descendant of an unclassifiable record wins", () => {
  const r = derive([
    R("a", null, [], { x: 1 }),
    R("b", null, ["a"], { x: 2 }),
  ]);
  assert.deepEqual(r.state, { x: 2 });
  assert.equal(r.setters.x, "b");
});

test("an unrecognised kind string ranks lowest, it is not malformed", () => {
  const r = derive([
    R("a", "banana", [], { z: 1 }),
    R("b", "witness", [], { z: 2 }),
  ]);
  assert.deepEqual(r.state, { z: 2 });
});

test("an unclassifiable record still wins an UNCONTESTED key", () => {
  const r = derive([R("a", null, [], { q: "solo" })]);
  assert.deepEqual(r.state, { q: "solo" });
});

test("an override displaces an unclassifiable incumbent", () => {
  const r = derive([
    R("a", null, [], { x: 1 }),
    R("o", "override", ["a"], { x: 2 }),
  ]);
  assert.deepEqual(r.state, { x: 2 });
});

// --- tie-break (§5.2/5.4: first in topo order among incomparable survivors) ---

test("TIE-BREAK: same class, incomparable, ACROSS Kahn tiers -> first in topo", () => {
  // order is [b, c, a]: c is a root with no effects, so a (c's child) sits
  // in a later tier than b. Class cannot decide (all task) and ancestry
  // cannot decide (a and b are mutually incomparable), so topo order is
  // the only applicable rule -- and it selects b.
  const r = derive([
    R("a", "task", ["c"], { x: 1 }),
    R("b", "task", [], { x: 2 }),
    R("c", "task", [], {}),
  ]);
  assert.deepEqual(r.order, ["b", "c", "a"]);
  assert.deepEqual(r.state, { x: 2 });
  assert.equal(r.setters.x, "b", "setters must agree with state");
});

test("TIE-BREAK: setters and state never disagree", () => {
  const r = derive([
    R("a", "task", ["c"], { x: 1 }),
    R("b", "task", [], { x: 2 }),
    R("c", "task", [], {}),
  ]);
  for (const [k, v] of Object.entries(r.state)) {
    assert.equal(r.setters[k] !== undefined, true, `setter missing for ${k}`);
  }
  assert.equal(r.setters.x, "b");
});

// --- orphans (§5.5: only OWN missing parents; descendants still apply) ---

test("an orphan's non-orphan descendant still applies", () => {
  const r = derive([
    R("orph", "task", ["ghost"], { x: 1 }),
    R("kid", "task", ["orph"], { y: 2 }),
  ]);
  assert.deepEqual(r.orphans, ["orph"]);
  assert.deepEqual(r.state, { y: 2 });
});

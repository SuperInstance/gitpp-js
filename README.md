# gitpp (JavaScript)

> A browser-portable JavaScript port of the git.pp fold. Pure ESM, no build step, no transpilation, no dependencies.

This is the **4th port** in the doc-only-discipline series (TypeScript in `patchwork-quilt/git.pp-ng`, Python in `git.pp-ng/referee/`, Elixir in `patchwork-quilt/gitpp-beam`). It is **not a wrapper** around the TypeScript port — it is written from the canonical spec (`SuperInstance/git.pp-spec`) alone, in plain modern JavaScript, with the deliberate goal of running in any modern browser without a bundler.

## Why a JS port specifically?

- **Browser-portable.** A user opens the page, the fold runs. No `npm install`, no `webpack`, no `tsc`. The whole fold is ~10 KB of source and runs in 2 ms for the live `poc-quilt-1` set.
- **Doc-only discipline check.** JavaScript has the same float64 domain as TypeScript but a more permissive runtime (no strict types). A port that reproduces the pinned digests in JS proves the spec is precise enough to survive a different type discipline.
- **Lowered adoption bar.** A contributor can `git clone` and `node --test` without setting up Rust or Elixir. The conformance story is "did your code reproduce the pinned root?" — that's testable in 30 seconds.

## The pass criterion

`npm test` reproduces, for the live `poc-quilt-1` record set, the closure root at `task-c`:

```
60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d
```

This is the receipt. If your port produces a different hex, you have drifted.

## The doc-only discipline

This port is written from the canonical spec (`SuperInstance/git.pp-spec`) and the design docs (`DESIGN.md`, `docs/CHECKPOINT-V2.md`, `docs/FORMAT-V2.md`, `docs/ENGINEERING.md` in `patchwork-quilt/git.pp-ng`) alone. The existing port sources were not read. If a question cannot be answered from the spec, it is reported in the PR body as a finding, not resolved by reading the source.

## What it covers

- The format-v2 record leaf (§2 of the spec)
- The closure root at a record (§4)
- The fold: Kahn topo, class precedence, ancestry reduction, tie-break, conflict detection (§5)
- The three-way verdict: VERIFIED / STATE-ONLY / MISMATCH (§6)

## What it does NOT cover (yet)

- Format-v2 dialect validation (the `digest` field claim). The spec says the fold never reads `digest`; this port trusts the input and does not revalidate.
- The retraction spike mechanics (PR #16). The spec reserves §10 "next (proposed)" for the leaf-domain broadening; this port will land that when the captain's §6 verdict is signed.
- Production-scale corpus fuzzing (40,002 doubles, 16,290 closure-root digests). The conformance corpus is the hub's; this port is verified by a smaller hand-curated set + the live `poc-quilt-1` pinned test.

## Usage

```js
import { derive, recordLeaf, closureRoot, verifyCheckpoint } from "gitpp";

const records = await fetch("https://gitpp.superinstance.dev/api/records?project=poc-quilt-1")
  .then(r => r.json())
  .then(j => j.records);

const root = closureRoot(records, "task-c");
// → "60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d"

const state = derive(records).state;
// → { "config.timeout": 45, "env.oracle_disk_pct": 93, ... }

const verdict = verifyCheckpoint(records, {
  at: "task-c",
  state: state,
  closureRoot: "60effe23970d8a5cc837636c44685502361288c1f00577e9addfa10cbd4fc91d"
});
// → { verdict: "VERIFIED", ... }
```

## Test

```sh
npm install
npm test
```

Tests fetch the live `poc-quilt-1` set from `https://gitpp.superinstance.dev/api/records?project=poc-quilt-1` and assert the closure root at `task-c` matches the pinned value.

---
name: spec-to-tests
description: Use after spec-interview has confirmed a REQ ledger and task-filing has recorded it on the tracker — generates one or more failing tests per active REQ-ID, named with an issue-N_REQ-XX compound key for traceability. Requires a test framework to already exist (see test-infra-setup).
---

# Spec to Tests

Turns each REQ-ID in an issue's ledger into a failing test. The test name *is* the traceability link back to the ledger — there is no separate mapping file to maintain.

## Step 0: Confirm test infrastructure exists

If the project has no detectable test framework, stop and say so — invoke `test-infra-setup` first. Don't generate tests into a project that can't run them.

## Step 1: Read the ledger

```bash
gh issue view <N> --json body -q .body
```

Parse the `REQ-<id>: ...` lines. Skip any line annotated `[superseded by REQ-<m>]` — only active (non-superseded) REQs need a test. Also note which active REQs are tagged `[structural]` (e.g. `REQ-3: [structural] namespaceはFoo.Barであること`) — see Step 4 for how those are handled differently.

## Step 2: If the ledger has a PR group breakdown, pick one group to target

Check the body for a `## PRグループ` section (see `task-filing`'s `task-template.md`). If it's absent, skip this step — target every active REQ from Step 1, same as always.

If it's present, ask the user which group to process this round (default to the first not-yet-implemented group in listed order, since groups are meant to be staged). Narrow the REQ set from Step 1 down to just that group's REQ-IDs — everything downstream (test generation, the red-check, `coverage-check`) operates on this narrowed set only, not the full ledger.

## Step 3: Detect the project's test conventions

Look at existing test files (naming, assertion style, `describe`/`it` vs. bare `test`, fixture setup patterns) and match them. Don't introduce a second test style into a project that already has one.

## Step 4: Generate one test per REQ-ID, named with the compound key

**Except for `[structural]` REQs — generate no test for those.** A `[structural]` REQ describes a property of the code's shape (e.g. a namespace, a file layout, a naming rule) rather than an input→output behavior. This pipeline's tests exist to verify behavior; a structural property is typically only checkable by a test that is itself coupled to the same constraint it's supposed to verify (e.g. a namespace-reflection test whose own `using`/`import` must match the constraint to even compile) — once such a test compiles, it can no longer fail, defeating the point of having it. Leave a `[structural]` REQ's verification to code review instead: don't write a test or eval case for it, and don't count it against yourself in Step 7's red-check. (`run`'s "Creating the PR" step is what actually surfaces `[structural]` REQs to the reviewer, in the PR body — this skill's only job here is to not generate a test that can't fail.) This changes nothing for REQs without the tag — generate one test per REQ-ID for all of them, as below:

```ts
it("issue-12_REQ-3_空文字を送信したら400を返す", () => {
  // ...
});
```

A REQ may need more than one test (happy path, edge cases) — give each the same `issue-N_REQ-XX` prefix; `coverage-check` only requires at least one match per REQ-ID, not exactly one.

## Step 5: Decide where the "why" goes, per test

If the reason a REQ holds is a single sentence derivable from the code/domain itself, put it in the test name or a one-line comment. If it needs the longer treatment (alternatives considered, external context, multi-sentence) it belongs on the ledger, not here — if it isn't already on the ledger, invoke `spec-interview` to draft the new REQ and `task-filing` to append it to the ledger, then add a short pointer comment in the test (e.g. `// see issue #12`).

## Step 6: Discovered a case the ledger doesn't mention?

Don't silently add a test for it. Invoke `spec-interview` to draft a new REQ, then `task-filing` to append it to the ledger (this is what keeps the ledger honest), then write the test against the new REQ-ID. If a PR group is targeted, add the new REQ to that group.

## Step 7: Confirm red for the right reason

Run the new tests once before handing off:

```bash
<project's test command> <new test files>
```

Expected: every new test FAILS with an assertion/not-implemented error — not a syntax error, import error, or setup crash. If it's failing for the wrong reason, fix the test itself before moving on.

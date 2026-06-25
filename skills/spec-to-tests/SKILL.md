---
name: spec-to-tests
description: Use after spec-interview has written a REQ ledger to an issue — generates one or more failing tests per active REQ-ID, named with an issue-N_REQ-XX compound key for traceability. Requires a test framework to already exist (see test-infra-setup).
---

# Spec to Tests

Turns each REQ-ID in an issue's ledger into a failing test. The test name *is* the traceability link back to the ledger — there is no separate mapping file to maintain.

## Step 0: Confirm test infrastructure exists

If the project has no detectable test framework, stop and say so — invoke `test-infra-setup` first. Don't generate tests into a project that can't run them.

## Step 1: Read the ledger

```bash
gh issue view <N> --json body -q .body
```

Parse the `REQ-<id>: ...` lines. Skip any line annotated `[superseded by REQ-<m>]` — only active (non-superseded) REQs need a test.

## Step 2: Detect the project's test conventions

Look at existing test files (naming, assertion style, `describe`/`it` vs. bare `test`, fixture setup patterns) and match them. Don't introduce a second test style into a project that already has one.

## Step 3: Generate one test per REQ-ID, named with the compound key

```ts
it("issue-12_REQ-3_空文字を送信したら400を返す", () => {
  // ...
});
```

A REQ may need more than one test (happy path, edge cases) — give each the same `issue-N_REQ-XX` prefix; `coverage-check` only requires at least one match per REQ-ID, not exactly one.

## Step 4: Decide where the "why" goes, per test

If the reason a REQ holds is a single sentence derivable from the code/domain itself, put it in the test name or a one-line comment. If it needs the longer treatment (alternatives considered, external context, multi-sentence) it belongs on the ledger, not here — if it isn't already on the ledger, invoke `spec-interview` to append it, then add a short pointer comment in the test (e.g. `// see issue #12`).

## Step 5: Discovered a case the ledger doesn't mention?

Don't silently add a test for it. Invoke `spec-interview` to append a new REQ first (this is what keeps the ledger honest), then write the test against the new REQ-ID.

## Step 6: Confirm red for the right reason

Run the new tests once before handing off:

```bash
<project's test command> <new test files>
```

Expected: every new test FAILS with an assertion/not-implemented error — not a syntax error, import error, or setup crash. If it's failing for the wrong reason, fix the test itself before moving on.

## Step 7: Hand off

Invoke `coverage-check` to mechanically verify every active REQ now has a test before implementation starts.

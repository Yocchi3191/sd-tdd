---
name: spec-interview
description: Use when a feature or bug request has no structured, testable requirements yet — before any test or code is written. Interviews the user one question at a time and converts a vague request into a numbered, falsifiable REQ ledger, then hands it to `task-filing` to be recorded. Also use to append newly discovered requirements to an existing ledger during implementation.
---

# Spec Interview

Converts a vague request into a REQ ledger — the only record of "what we believed, when." No separate spec document is ever created; this ledger plus the tests it produces (via `spec-to-tests`) are the whole spec.

This skill never talks to a tracker directly. Reading and writing the ledger's home (a GitHub issue, or whatever the project uses) is `task-filing`'s job.

## Step 1: Check for an existing ledger

If this is a continuation of an existing task, invoke `task-filing`'s "fetch ledger" operation for that task and read the `REQ-` lines it returns. This is an **append session**: new items become `REQ-<max+1>`, `REQ-<max+2>`, ... Existing lines are never rewritten. If you're correcting or replacing an old REQ, append a new one and add `[superseded by REQ-<new id>]` to the old line — don't edit its original text otherwise.

If there's no existing task, this is a fresh interview; the ledger starts at `REQ-1`.

## Step 2: Interview one question at a time

- Ask one question per message. Prefer multiple choice.
- Each REQ must be a single falsifiable fact — one behavior, one expected outcome. Split anything joined by "and"/"or" into separate REQs.
- Push back on vagueness. "Handle errors gracefully" is not a REQ. "If the input is empty, return a 400 with message X" is.
- Keep asking until you can write the whole feature as a list of REQ lines with no ambiguity left.

## Step 3: Decide where the "why" goes

Default: leave rationale for the test code (`spec-to-tests` will embed it as a comment or in the test name). Only write the rationale directly into a REQ line when at least one of these holds:

1. It requires explaining an alternative that was considered and rejected.
2. It depends on context the code can't reveal (a stakeholder ask, a compliance rule, a specific past incident).
3. It can't be stated in one sentence.

## Step 4: Get explicit approval, then hand off

Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved, tell them: "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one), then run `test-infra-setup` (if not already done for this project) and `spec-to-tests`."

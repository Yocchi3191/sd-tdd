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
- If a REQ describes a structural property of the code (e.g. a namespace, a file layout, a naming rule) rather than an input→output behavior, tag it `[structural]` immediately after the `REQ-<id>:` prefix (e.g. `REQ-3: [structural] namespaceはFoo.Barであること`). `spec-to-tests` generates no test for a `[structural]` REQ and `coverage-check` doesn't require one — its correctness is left to code review instead. Reach for this tag when a behavioral test for the property would end up coupled to the same constraint it's supposed to verify (e.g. a namespace-reflection test whose own `using`/`import` must match the constraint to even compile), making it unable to fail once it compiles. Don't tag a REQ `[structural]` just because it's hard to test — only when it's describing shape, not behavior.

## Step 3: Decide where the "why" goes

Default: leave rationale for the test code (`spec-to-tests` will embed it as a comment or in the test name). Only write the rationale directly into a REQ line when at least one of these holds:

1. It requires explaining an alternative that was considered and rejected.
2. It depends on context the code can't reveal (a stakeholder ask, a compliance rule, a specific past incident).
3. It can't be stated in one sentence.

## Step 4: Consider whether to split

Before asking for final approval, weigh whether this ledger is large or varied enough that a single issue/PR would be painful to review. There is no fixed REQ-count threshold — judge it the same way you'd judge any scope call: how many REQs, how unrelated they are, whether they touch disjoint parts of the codebase.

- **Judge it not worth splitting:** say nothing about splitting — go straight to Step 5 with the full ledger.
- **Judge it worth splitting because the groups are independent concerns** (different components, unrelated features — each reviewable/mergeable on its own): propose the grouping (which REQ-IDs belong together), state that recommendation and why, and let the user approve or override it. If approved, this becomes an **independent-concerns split** — see Step 5 for the hand-off.
- **Judge it worth splitting because the groups are the same feature staged as dependent steps** (e.g. base case → edge cases → error handling, where separate issues would be artificial): propose a **PR-group rollout** instead — state the recommendation and why, then let the user approve or override it. If approved, this becomes a **PR-group split** — see Step 5 for the hand-off.
- Never ask "sub issue or PR group?" with no guidance; state one recommendation based on independence vs. dependency, as above. That just pushes the same ad-hoc judgment call the user is trying to get away from.
- If the user declines a split (or you judged none needed), proceed as a single ledger.

## Step 5: Get explicit approval, then hand off

Show the user the final REQ list before handing off — do not write it anywhere yourself, and do not run any tracker command. Once approved:

- **No split, or a PR-group split**: tell the user "REQ ledger confirmed. Next: invoke `task-filing` to record it (new task, or append if this was a continuation of an existing one)." If a PR-group split was agreed in Step 4, also pass `task-filing` the group→REQ-ID mapping for its "File as PR groups" operation.
- **An independent-concerns split**: tell the user "REQ ledger confirmed. Next: hand off to `epic-filing` to file the epic-issue and each group as its own task-issue." Pass `epic-filing` the confirmed REQ ledger and the group→REQ-ID mapping — this is `epic-filing`'s Entry B.

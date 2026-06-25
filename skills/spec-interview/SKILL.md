---
name: spec-interview
description: Use when a feature or bug request has no structured, testable requirements yet — before any test or code is written. Interviews the user one question at a time and converts a vague request into a numbered, falsifiable REQ ledger recorded on a GitHub issue. Also use to append newly discovered requirements to an existing ledger during implementation.
---

# Spec Interview

Converts a vague request into a REQ ledger — the only record of "what we believed, when." No separate spec document is ever created; this ledger plus the tests it produces (via `spec-to-tests`) are the whole spec.

## Step 1: Check for an existing ledger

```bash
gh issue view <N> --json body -q .body
```

If the issue already has `REQ-` lines, this is an **append session**: new items become `REQ-<max+1>`, `REQ-<max+2>`, ... Existing lines are never rewritten. If you're correcting or replacing an old REQ, append a new one and add `[superseded by REQ-<new id>]` to the old line — don't edit its original text otherwise.

If there's no existing issue, this is a fresh interview; the ledger starts at `REQ-1`.

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

## Step 4: Write the ledger to the issue

```bash
gh issue create --title "<feature title>" --body "$(cat <<'EOF'
## Requirements

REQ-1: ユーザーが空文字を送信したら400を返す
REQ-2: リトライは3回まで — vendor APIのレート制限による
EOF
)"
```

For an append session, use `gh issue edit <N> --body "$(cat <<'EOF' ... EOF)"` with the full existing body plus the new REQ lines appended at the end — never with old lines removed or reworded.

## Step 5: Get explicit approval

Show the user the final REQ list before handing off. Once approved, tell them: "REQ ledger written to issue #<N>. Next: run `test-infra-setup` (if not already done for this project) and then `spec-to-tests`."

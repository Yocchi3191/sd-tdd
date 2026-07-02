---
name: task-filing
description: Use after spec-interview has confirmed a REQ ledger (new or appended) — records it into the project's tracker (GitHub issue by default) using this skill's task-template.md. Also use to fetch a task's current ledger when spec-interview is continuing work on an existing task. Never rewords or summarizes REQ lines; they are transcribed verbatim.
---

# Task Filing

Owns creating and updating the ledger's home, and fetching it back for append sessions. `spec-interview` decides *what* the REQ ledger says; this skill decides *where and how* it gets recorded, using `task-template.md` so every filed task carries enough context for anyone to pick it up. (`spec-to-tests` and `coverage-check` still read the tracker directly to pull the ledger for test generation and verification — this skill owns the ledger's writes, not every read in the pipeline.)

Default tracker: GitHub issues via the `gh` CLI. Nothing here hardcodes "GitHub" in the skill's purpose — a future tracker backend would only need new commands in the three operations below, not a rewrite of `spec-interview`.

## Operation: Fetch current ledger

Called by `spec-interview` at the start of an append session, before asking any interview questions.

```bash
gh issue view <N> --json body -q .body
```

Return the raw body text to the caller. `spec-interview` parses the `REQ-<id>:` lines itself.

## Operation: File a new task

1. Read `task-template.md` (this skill's directory) and fill it in:
   - **背景・課題**, **やること・要件**, **完了条件** are required — always fill them.
   - Copy the confirmed REQ-N lines into **やること・要件** verbatim — do not reword, summarize, or renumber them. Replace the template's placeholder `REQ-1: ...` / `REQ-2: ...` lines entirely; never leave them in alongside the real REQ lines.
   - **決定事項**, **設計・実装方針**, **注意点・既知のトレードオフ** are optional — include a section only when it's actually relevant to this task; don't leave empty headers.
2. Create the task:

```bash
gh issue create --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

3. Report back to the caller: "Task filed as issue #<N>."

## Operation: Append to an existing task

1. Fetch the current body (see "Fetch current ledger" above).
2. Append the new `REQ-<max+1>:`, `REQ-<max+2>:`, ... lines to the end of the **やること・要件** section, after the existing ones. Never remove or reword existing lines.
3. If the caller provided updates to any optional section (背景・課題, 完了条件, 決定事項, 設計・実装方針, 注意点・既知のトレードオフ), apply those too — otherwise leave the rest of the body untouched.
4. Update the task:

```bash
gh issue edit <N> --body "$(cat <<'EOF'
<updated full body>
EOF
)"
```

5. Report back to the caller: "Task #<N> updated with <count> new REQ line(s)."

## Constraint: REQ lines are verbatim

`spec-to-tests` and `coverage-check` locate requirements by grepping the task body for lines matching `^REQ-(\d+):\s*(.+)$` (see `plugins/sd-tdd/scripts/coverage-check/parse.js`). This regex only cares about the line itself, not which section heading it sits under — so reordering surrounding prose is safe, but editing the text of a `REQ-<id>:` line is not. If a REQ turns out to be wrong, `spec-interview` supersedes it with a new line; this skill never edits an existing REQ line's text.

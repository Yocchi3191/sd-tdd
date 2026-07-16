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

## Operation: File a split as sub issues

Called when `spec-interview` hands off a confirmed ledger with split mode = sub issue, plus a group → REQ-ID mapping.

1. Ensure the `gh-sub-issue` extension is installed:

```bash
gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue
```

If the install fails (no network, etc.), stop and tell the user to install `yahsan2/gh-sub-issue` manually, then retry — don't fall back to plain issue creation silently.

2. File the parent task as usual (see "File a new task"). Its **やること・要件** carries the full REQ ledger (every REQ-N line, verbatim, across all groups) so the parent stays the single source of truth; note next to each which group it belongs to.

3. For each group, create a sub issue whose **やること・要件** contains only that group's REQ-N lines, still verbatim:

```bash
gh sub-issue create --parent <parent-N> --title "<group title>" --body "$(cat <<'EOF'
<template filled in with just this group's REQ-N lines>
EOF
)"
```

4. Report back to the caller: "Filed as parent issue #<N> with <count> sub issue(s): #<a>, #<b>, ..." `spec-to-tests`/`coverage-check` are then run once per sub issue, same as any other task.

## Operation: File as PR groups (single issue)

Called when `spec-interview` hands off a confirmed ledger with split mode = PR group, plus a group → REQ-ID mapping.

1. File the task as usual (see "File a new task").
2. Add a `## PRグループ` section (see `task-template.md`) listing each group's name and its REQ-IDs, in the order they're meant to be implemented.
3. Report back to the caller: "Task filed as issue #<N> with <count> PR group(s)."

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

When a ledger is split across sub issues, the same `REQ-N:` line is copied verbatim into both the parent (full ledger) and its sub issue (that group's subset) — `coverage-check` runs against whichever issue number it's pointed at, so this duplication is intentional, not a bug.

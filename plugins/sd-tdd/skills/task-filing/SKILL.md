---
name: task-filing
description: Use after spec-interview has confirmed a REQ ledger (new or appended), or when filing a rough task with no REQ ledger yet pending investigation/design — records it into the project's tracker (GitHub issue by default) using this skill's task-template.md. Also use to fetch a task's current ledger when spec-interview is continuing work on an existing task. Never rewords or summarizes REQ lines; they are transcribed verbatim.
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
   - **背景・課題**, **やること・要件**, **完了条件** are required — always include these section headings.
   - Copy the confirmed REQ-N lines into **やること・要件** verbatim — do not reword, summarize, or renumber them. Replace the template's placeholder `REQ-1: ...` / `REQ-2: ...` lines entirely; never leave them in alongside the real REQ lines.
   - **REQが0件の場合**（まだ実装可能な粒度に分解されていない粗い起票 — 調査・設計フェーズを経てから`spec-interview`のappend sessionで後から追記する想定）: **やること・要件** はプレースホルダも実REQ行も置かず、空欄のまま起票してよい。この場合でも**背景・課題**と**完了条件**は必須のまま埋める — **完了条件**はREQ単位ではなく、その時点での完了基準（例:「調査・設計方針が固まり、REQ台帳が確定していること」）を書けばよい。
   - **決定事項**, **設計・実装方針**, **注意点・既知のトレードオフ** are optional — include a section only when it's actually relevant to this task; don't leave empty headers.
2. Create the task:

```bash
gh issue create --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

3. Report back to the caller: "Task filed as issue #<N>."

## Operation: File a task under a parent epic

Called by `epic-filing` when filing a task-issue as a sub-issue of an epic-issue (both its Entry A — a freshly decomposed initiative — and Entry B — concerns discovered mid-interview by `spec-interview`).

1. Ensure the `gh-sub-issue` extension is installed:

```bash
gh extension list | grep -q sub-issue || gh extension install yahsan2/gh-sub-issue
```

If the install fails (no network, etc.), stop and tell the user to install `yahsan2/gh-sub-issue` manually, then retry — don't fall back to plain issue creation silently.

2. Fill in `task-template.md` exactly as in "File a new task" (REQ-N lines copied verbatim, required/optional sections as usual).
3. Create the task as a sub-issue of the given parent epic issue number `<epic-N>`:

```bash
gh sub-issue create --parent <epic-N> --title "<task title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

4. Report back to the caller: "Task filed as issue #<N> (sub-issue of epic #<epic-N>)."

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

A task-issue's parent is always an epic-issue (see `epic-filing`), which never carries `REQ-<id>:` lines at all. So a REQ line only ever lives on the task-issue itself — it is never duplicated up to the parent, and `coverage-check` is only ever pointed at a task-issue number.

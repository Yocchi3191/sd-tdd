---
name: run
description: Use this first for any task in this project that adds, modifies, or deletes files — new features, bug fixes, refactors. This is the entry point and auto-driving orchestrator for the sd-tdd pipeline: test-infra-setup → spec-interview → task-filing → spec-to-tests → coverage-check → superpowers:test-driven-development. Also use to resume in-progress sd-tdd work on an existing GitHub issue (e.g. "issue #12の続き"). Do NOT use for read-only questions, explanations, or analysis that touches no files.
---

# sd-tdd:run

Drives the whole sd-tdd pipeline end to end so nobody has to remember which of the five sd-tdd skills to invoke next, or in what order. This skill calls the other five (`test-infra-setup`, `spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`) and `superpowers:test-driven-development` via the `Skill` tool, in sequence, automatically — the only place this flow stops for user input is the REQ ledger approval gate that already exists inside `spec-interview`.

This skill owns no logic of its own beyond sequencing and resume-point detection. It never writes a REQ, generates a test, or edits an issue directly — it only decides *which* skill to call *next*.

## Step 1: Determine new task vs. resume

- If the user's request references an existing issue number (e.g. "issue #12", "#12の続き"), this is a **resume** — go to "Resuming an existing issue" below with that issue number.
- Otherwise, this is a **new task** — go to "Starting a new task" below.
- If it's genuinely ambiguous (the request could plausibly be either), ask the user once which issue number to resume, or confirm it's new.

## Step 2: Track progress with TodoWrite

Before starting either path, create a TodoWrite list with these 6 items (mark items already satisfied as `completed` immediately when resuming — see below):

1. test-infra-setup — テスト基盤・mutation testing基盤の確認/導入
2. spec-interview — REQ台帳の作成・承認
3. task-filing — issueへの記録
4. spec-to-tests — REQごとの失敗テスト生成
5. coverage-check — REQとテストの対応検証
6. 実装への引き継ぎ — superpowers:test-driven-development

Mark each `in_progress` right before invoking the corresponding skill, and `completed` right after it returns successfully. Give one short status line between stages (e.g. "REQ台帳を確定、issue #14として起票しました。次にテストを生成します。") — this is a status update, not a checkpoint; do not wait for a response before continuing to the next stage, except at the approval gate noted below.

## Starting a new task

1. Invoke the `test-infra-setup` skill. It is idempotent — if the project already has a test framework and mutation-testing tool wired up, it reports so and does nothing further.
2. Invoke the `spec-interview` skill to interview the user and build the REQ ledger. **This is the only stopping point in the whole flow** — `spec-interview` itself asks the user to approve the final REQ list before handing back. Wait for that approval; do not skip it or approve on the user's behalf.
3. Once `spec-interview` reports the REQ ledger confirmed, invoke `task-filing`'s new-task operation to record it as a GitHub issue. Note the issue number `N` from its "Task filed as issue #N" response — every later step needs it.
4. Invoke `spec-to-tests` for issue `N`. It reads the ledger itself via `gh issue view` — you don't need to pass it anything beyond the issue number.
5. Invoke `coverage-check` for issue `N` (see "Running coverage-check" below for the exact command and how to interpret its result).
   - If it reports missing REQs: invoke `spec-to-tests` again, tell it which REQ-IDs are missing, then re-run `coverage-check`. Repeat until it passes. Do not ask the user before looping — this is the mechanical retry the design calls for.
   - If it reports orphan tests (tests referencing REQ-IDs not in the ledger): follow coverage-check's own guidance (invoke `spec-interview` to draft the missing REQ + `task-filing` to append it, or fix/remove the stray test), then re-run `coverage-check`.
6. Once `coverage-check` passes cleanly, invoke `superpowers:test-driven-development` to begin implementation against the now-failing tests. Tell it which issue/REQ-IDs it's implementing against.

## Resuming an existing issue

Given issue number `N`:

1. Fetch the ledger: `gh issue view <N> --json body,state -q .body`. If the command fails or the issue has no `REQ-<id>:` lines, treat this as if no ledger exists yet: mark TodoWrite item 1 `completed` (test infra is gated lazily by `spec-to-tests` itself, no need to re-run it here), invoke `spec-interview` telling it this is a continuation of issue `N`, then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N`, then continue the new-task sequence from its step 4 onward using issue `N`.
2. If a ledger exists, detect the test directory (see "Detecting the test directory" below), then run coverage-check (see "Running coverage-check" below) for issue `N`.
3. Interpret the result:
   - **coverage-check reports missing REQs, or the test directory has no `issue-<N>_REQ-` matches at all**: mark TodoWrite items 1–3 `completed`, item 4 `in_progress`, and invoke `spec-to-tests` for issue `N`, then continue the new-task sequence from its step 5 (`coverage-check`) onward.
   - **coverage-check passes cleanly**: mark TodoWrite items 1–5 `completed`, and go straight to "Starting a new task" step 6 (invoke `superpowers:test-driven-development`).

## Detecting the test directory

Needed before invoking `coverage-check`. Check, in order, for the first that exists in the project:

1. A directory literally named `test/`, `tests/`, `__tests__/`, or `spec/` at the project root or under `src/`.
2. Files matching `**/*.test.*` or `**/*.spec.*` anywhere in the project (use their common parent directory, or pass the glob root if they're scattered next to source files).

If none of these resolve to an unambiguous single path (e.g. multiple candidate directories with test files in different frameworks), ask the user once which directory to pass to `coverage-check`.

## Running coverage-check

```bash
node scripts/coverage-check/cli.js --issue <N> --tests <test-directory>
```

Run from the sd-tdd plugin root. Exit 0 with no missing/orphan output means every active REQ has a test — proceed. Exit 1 with "Missing tests for: ..." means go back to `spec-to-tests` for exactly those REQ-IDs. See the `coverage-check` skill for full output semantics.

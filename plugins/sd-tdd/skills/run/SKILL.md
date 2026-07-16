---
name: run
description: Use this first for any task in this project that adds, modifies, or deletes files — new features, bug fixes, refactors. This is the entry point and auto-driving orchestrator for the sd-tdd pipeline (test-infra-setup → spec-interview → task-filing → git worktree → spec-to-tests → coverage-check → superpowers:test-driven-development → Draft PR → superpowers:requesting-code-review), all the way to a review-clean PR. Human judgement is only asked for at REQ approval, a sub issue split decision, repeated implementation/review failure, or a design ambiguity mid-implementation — merging the PR always stays a human decision and this skill never performs it. Also use to resume in-progress sd-tdd work on an existing GitHub issue (e.g. "issue #12の続き"). Do NOT use for read-only questions, explanations, or analysis that touches no files.
---

# sd-tdd:run

Drives the whole sd-tdd pipeline end to end — from a task description or issue reference through to a review-clean pull request — so nobody has to remember which skill to invoke next, in what order, or when to isolate work in a worktree. This skill calls the other sd-tdd skills (`test-infra-setup`, `spec-interview`, `task-filing`, `spec-to-tests`, `coverage-check`) and superpowers skills (`using-git-worktrees`, `test-driven-development`, `requesting-code-review`) in sequence, automatically. **Merging the PR is never this skill's job** — it always stops at a ready-for-review Draft PR and hands the merge decision to a human.

This skill owns no logic of its own beyond sequencing, resume-point detection, and the retry/escalation limits below. It never writes a REQ, generates a test, edits an issue directly, or reviews code itself — it only decides *which* skill to call *next*, and when to stop and ask a human instead.

## Escalation points — the only places this flow stops for a human

1. REQ ledger approval (inside `spec-interview`, Step 5) — already a built-in stop.
2. A sub issue split is confirmed (see "Handling a split") — which sub issue to start is a human call; `run` does not guess.
3. The same REQ fails implementation 3 times in a row (see "Implementing against the tests").
4. The same PR fails review (Critical/Important findings) on 3 review rounds in a row (see "Requesting review").
5. A genuinely ambiguous design decision comes up mid-implementation that no REQ resolves (see "Ambiguity during implementation").

Everywhere else, keep going without waiting for a response — a short status line between stages is enough (e.g. "REQ台帳を確定、issue #14として起票しました。次にテストを生成します。").

## Step 1: Determine new task vs. resume

- If the user's request references an existing issue number (e.g. "issue #12", "#12の続き"), this is a **resume** — go to "Resuming an existing issue" below with that issue number.
- Otherwise, this is a **new task** — go to "Starting a new task" below.
- If it's genuinely ambiguous (the request could plausibly be either), ask the user once which issue number to resume, or confirm it's new.

## Step 2: Track progress with TodoWrite

Before starting either path, create a TodoWrite list with these items (mark items already satisfied as `completed` immediately when resuming — see below):

1. test-infra-setup — テスト基盤・mutation testing基盤の確認/導入
2. spec-interview — REQ台帳の作成・承認
3. task-filing — issueへの記録（分割時はsub issue/PRグループも含む）
4. git worktree — 専用worktreeの作成
5. spec-to-tests — REQごとの失敗テスト生成
6. coverage-check — REQとテストの対応検証
7. 実装 — superpowers:test-driven-development
8. PR作成 — Draft PR
9. レビュー — superpowers:requesting-code-review、Critical/Important解消
10. ready化と完了報告

For a PR-group split, repeat items 4–10 once per group. Mark each `in_progress` right before invoking the corresponding skill, and `completed` right after it returns successfully. Give one short status line between stages — this is a status update, not a checkpoint; do not wait for a response before continuing, except at the escalation points above.

## Starting a new task

1. Invoke the `test-infra-setup` skill. It is idempotent — if the project already has a test framework and mutation-testing tool wired up, it reports so and does nothing further.
2. Invoke the `spec-interview` skill to interview the user and build the REQ ledger. **This is the first stopping point** — `spec-interview` itself asks the user to approve the final REQ list before handing back. Wait for that approval; do not skip it or approve on the user's behalf.
3. If `spec-interview` reports that a split (sub issue or PR group) was proposed and approved in its Step 4, go to "Handling a split" below instead of continuing linearly. Otherwise continue to step 4.
4. Invoke `task-filing`'s new-task operation to record the ledger as a GitHub issue. Note the issue number `N` from its "Task filed as issue #N" response — every later step needs it.
5. Run "Implementing one scope" (below) for issue `N` with the full REQ ledger as the scope.

## Handling a split

- **PR group split:** invoke `task-filing`'s "File as PR groups" operation to record the single issue with its `## PRグループ` section. Then, for each group in the order listed (do not reorder), run "Implementing one scope" narrowed to that group's REQ-IDs — `spec-to-tests` targets that group (its Step 2), `coverage-check` is run with `--group <N>`, and a separate Draft PR is created and reviewed per group. Move to the next group automatically once a group's PR reaches ready-for-review; do not escalate to a human just because a group finished.
- **Sub issue split:** invoke `task-filing`'s "File a split as sub issues" operation to record the parent issue and every sub issue. Then **stop** — escalate to the human, asking which sub issue to start with. Do not invoke `spec-to-tests` or anything past this point automatically; each sub issue that's picked later is its own "Starting a new task" / "Implementing one scope" run (references that sub issue's number for `task-filing` fetch/append, not the parent's).

## Implementing one scope

The shared sequence for one unit of work — either the whole ledger (no split) or one PR group's REQ subset. `N` is the issue being worked; "scope" means the REQ-IDs in play (all active REQs, or just the current group's).

1. **Isolate the work.** Invoke `superpowers:using-git-worktrees` to create a dedicated git worktree *before* invoking `spec-to-tests`. Every step from here on — test writing, implementation, commits — happens inside that worktree, not the branch `run` was invoked from.
2. Invoke `spec-to-tests` for issue `N` (tell it which group, if scoped).
3. Invoke `coverage-check` for issue `N` (`--group <N>` if scoped) — see "Running coverage-check" below.
   - Missing REQs: invoke `spec-to-tests` again for exactly those REQ-IDs, then re-run `coverage-check`. Repeat until it passes. Don't ask the user first — this is a mechanical retry.
   - Orphan tests: follow `coverage-check`'s own guidance (invoke `spec-interview` to draft the missing REQ + `task-filing` to append it, or fix/remove the stray test), then re-run.
4. Once `coverage-check` passes cleanly, go to "Implementing against the tests".

## Implementing against the tests

Invoke `superpowers:test-driven-development`, telling it which issue/REQ-IDs (scope) it's implementing against, inside the worktree from step 1.

Track failures **per REQ**, not per test run: if the test(s) for the same REQ-ID are still failing after 3 consecutive implementation attempts, stop — don't try a 4th time. Escalate to the human with the REQ-ID and a summary of the failure (test name, error). Otherwise, once every test in scope passes, go to "Creating the PR".

## Ambiguity during implementation

If implementation surfaces a design decision that no REQ in the ledger resolves — multiple reasonable choices, nothing in the ledger dictates one — don't guess and don't let `test-driven-development` guess either. Invoke `spec-interview` (continuation of issue `N`) to draft the missing REQ, then `task-filing`'s append operation to record it, then resume implementation against the now-updated ledger.

## Creating the PR

Once every test in scope passes:

1. Push the worktree's branch: `git push -u origin <branch>`.
2. Create a Draft PR against the repository's default branch: `gh pr create --draft --base <default-branch> --title "<title>" --body "<body>"`. Derive the title and body from the issue title and the REQ-IDs in scope — don't hand-wave; link the issue (e.g. `Closes #N` or `Part of #N` for a PR-group step that isn't the last).
3. Go to "Requesting review".

## Requesting review

1. Get the SHAs: `BASE_SHA` is where the worktree's branch diverged from the default branch (`git merge-base <branch> origin/<default-branch>`); `HEAD_SHA` is the branch's latest commit.
2. Invoke `superpowers:requesting-code-review` exactly as documented there — no custom review prompt for `run`. Fill its template with:
   - `DESCRIPTION`: a brief summary of what was implemented in this scope.
   - `PLAN_OR_REQUIREMENTS`: the REQ ledger for issue `N` (the full ledger, or just this group's REQ-IDs if scoped).
   - `BASE_SHA` / `HEAD_SHA`: from step 1.
3. Read the reviewer's Assessment:
   - **Any Critical or Important finding:** fix it, commit, then repeat "Requesting review" (re-fetch `HEAD_SHA`). Count this as one round. After 3 rounds still carrying an unresolved Critical/Important, stop and escalate to the human with the outstanding findings — don't attempt a 4th round.
   - **No Critical/Important (Minor findings or none):** convert the PR to ready for review (`gh pr ready <PR-number>`), then report the PR URL and a short review summary (including any Minor findings, for the human's awareness) to the user. This scope is done — do not merge, ever.
4. Leave the git worktree in place; `run` never deletes it. Cleanup is the human's call.

## Resuming an existing issue

Given issue number `N`:

1. Fetch the ledger: `gh issue view <N> --json body,state -q .body`. If the command fails or the issue has no `REQ-<id>:` lines, treat this as if no ledger exists yet: mark TodoWrite item 1 `completed` (test infra is gated lazily by `spec-to-tests` itself, no need to re-run it here), invoke `spec-interview` telling it this is a continuation of issue `N`, then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N` (or its split operations, if a split was proposed and approved — see "Handling a split"), then run "Implementing one scope" for issue `N`.
2. If a ledger exists, detect the test directory (see "Detecting the test directory" below), then run `coverage-check` (see "Running coverage-check" below) for issue `N` (`--group <N>` if the ledger has a `## PRグループ` section and a group is still in progress — pick the first group whose REQs aren't fully covered yet).
3. Interpret the result:
   - **coverage-check reports missing REQs, or the test directory has no `issue-<N>_REQ-` matches at all**: mark TodoWrite items 1–3 `completed`, and resume "Implementing one scope" from its step 1 (worktree creation) — a resumed run still needs its own isolated worktree even if one existed in a prior session, unless that worktree is still present and on the right branch, in which case reuse it.
   - **coverage-check passes cleanly**: mark TodoWrite items 1–6 `completed`, and resume "Implementing one scope" from "Implementing against the tests" onward.

## Detecting the test directory

Needed before invoking `coverage-check`. Check, in order, for the first that exists in the project:

1. A directory literally named `test/`, `tests/`, `__tests__/`, or `spec/` at the project root or under `src/`.
2. Files matching `**/*.test.*` or `**/*.spec.*` anywhere in the project (use their common parent directory, or pass the glob root if they're scattered next to source files).
3. For a skill/behavioral change with no executable test framework in scope (e.g. an `evals/evals.json` alongside the skill), that `evals/` directory is the test directory.

If none of these resolve to an unambiguous single path (e.g. multiple candidate directories with test files in different frameworks), ask the user once which directory to pass to `coverage-check`.

## Running coverage-check

```bash
node scripts/coverage-check/cli.js --issue <N> --tests <test-directory> [--group <G>]
```

Run from the sd-tdd plugin root. Exit 0 with no missing/orphan output means every active REQ (or every REQ in the given group) has a test — proceed. Exit 1 with "Missing tests for: ..." means go back to `spec-to-tests` for exactly those REQ-IDs. See the `coverage-check` skill for full output semantics.

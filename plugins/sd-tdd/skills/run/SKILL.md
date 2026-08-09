---
name: run
description: Use this first for any task in this project that adds, modifies, or deletes files — new features, bug fixes, refactors. This is the entry point and auto-driving orchestrator for the sd-tdd pipeline (test-infra-setup → spec-interview → task-filing → codebase investigation (Explore) → sd-tdd:design-planning → git worktree → spec-to-tests → coverage-check → superpowers:test-driven-development → sd-tdd:submit → sd-tdd:review-pr), all the way to a review-clean PR. Human judgement is only asked for at REQ approval, a multi-task initiative split decision, repeated implementation/review failure, or a design ambiguity mid-implementation — merging the PR always stays a human decision and this skill never performs it. Also use to resume in-progress sd-tdd work on an existing GitHub issue (e.g. "issue 12の続き"). Do NOT use for read-only questions, explanations, or analysis that touches no files.
---

# sd-tdd:run

Drives the whole sd-tdd pipeline end to end — from a task description or issue reference through to a review-clean pull request — so nobody has to remember which skill to invoke next, in what order, or when to isolate work in a worktree. This skill calls the other sd-tdd skills (`test-infra-setup`, `spec-interview`, `task-filing`, `design-planning`, `spec-to-tests`, `coverage-check`, `submit`, `review-pr`), the built-in `Explore` agent, and superpowers skills (`using-git-worktrees`, `test-driven-development`) in sequence, automatically. **Merging the PR is never this skill's job** — it always stops at a ready-for-review Draft PR and hands the merge decision to a human.

This skill owns no logic of its own beyond sequencing, resume-point detection, and the retry/escalation limits below. It never writes a REQ, generates a test, edits an issue directly, or reviews code itself — it only decides *which* skill to call *next*, and when to stop and ask a human instead.

## Escalation points — the only places this flow stops for a human

1. REQ ledger approval (inside `spec-interview`, Step 5) — already a built-in stop.
2. `epic-filing` files a multi-task initiative as an epic issue with task-issues under it (see "Starting new work") — which task-issue to start with is a human call; `run` does not guess.
3. The same REQ fails implementation 3 times in a row (see "Implementing against the tests").
4. The same PR fails review (Critical/Important findings) on 3 review rounds in a row (see "Requesting review").
5. A genuinely ambiguous design decision comes up mid-implementation that no REQ resolves (see "Ambiguity during implementation").

Everywhere else, keep going without waiting for a response — a short status line between stages is enough (e.g. "REQ台帳を確定、issue #14として起票しました。次にテストを生成します。").

## Step 1: Determine resume vs. new work

- If the user's request references an existing issue number (e.g. "issue #12", "#12の続き"), this is a **resume** — go to "Resuming an existing issue" below with that issue number.
- Otherwise, this is **new work** — go to "Starting new work" below. `run` does not itself judge whether the request is a single task or a multi-task initiative; that judgment, and the filing that follows from it, is `epic-filing`'s job (see "Starting new work").
- If it's genuinely ambiguous whether the request is a resume or new work (the request could plausibly be either), ask the user once which issue number to resume, or confirm it's new work, before proceeding.

## Step 2: Track progress with TodoWrite

Before starting either path, create a TodoWrite list with these items (mark items already satisfied as `completed` immediately when resuming — see below):

1. test-infra-setup — テスト基盤・mutation testing基盤の確認/導入
2. epic-filing → spec-interview — 単一task/企画の判定と、REQ台帳の作成・承認（新規作業では最初に呼ぶのは `epic-filing`。`spec-interview` はその中から呼ばれる）
3. task-filing — issueへの記録（企画ならepic-issue + 各task-issue、PRグループ分割ならPRグループ付きの単一issue）
4. コードベース調査 — `Explore`エージェントによる調査（新規作業のみ。「Starting new work」参照）
5. 設計フェーズ — `sd-tdd:design-planning`で人間と設計をブラッシュアップ（新規作業のみ。「Starting new work」参照）
6. git worktree — 専用worktreeの作成
7. spec-to-tests — REQごとの失敗テスト生成
8. coverage-check — REQとテストの対応検証
9. 実装 — superpowers:test-driven-development
10. PR作成 — sd-tdd:submitでDraft PR
11. レビュー — sd-tdd:review-prでCritical/Important解消
12. ready化と完了報告

For a PR-group split, repeat items 6–12 once per group; items 4–5 (investigation/design) don't repeat per group — see "Starting new work" for why the PR-group branch skips them. Mark each `in_progress` right before invoking the corresponding skill, and `completed` right after it returns successfully. Give one short status line between stages — this is a status update, not a checkpoint; do not wait for a response before continuing, except at the escalation points above.

## Starting new work

1. Invoke the `test-infra-setup` skill. It is idempotent — if the project already has a test framework and mutation-testing tool wired up, it reports so and does nothing further.
2. Invoke `epic-filing` to judge whether this is a single work task or a multi-task initiative, and to handle filing accordingly:
   - **Single work task**: `epic-filing` invokes `spec-interview` itself (its own approval gate still applies — wait for it) and files the result via `task-filing`'s "File a new task" operation — this REQ ledger may legitimately be empty (a rough filing; see `task-filing`'s "File a new task" operation) when the request is architecturally complex enough that REQ-level acceptance criteria aren't ready to confirm before investigation and design happen. `epic-filing` reports back the filed issue number `N`. Continue to step 3 below with that `N`.
   - **PR-group split inside the single-work-task path**: if that same `spec-interview` reports an approved **PR-group** split (one feature staged as dependent steps — *not* independent concerns), `epic-filing` files it via `task-filing`'s "File as PR groups" operation instead of "File a new task", and reports back issue number `N` plus the group→REQ-ID mapping. Go to "Handling a split" with that `N` and mapping instead of continuing to step 3 — the filing is already done, so skip that section's `task-filing` invocation and start at its per-group loop, and skip steps 3–4 below (investigation/design) entirely for this branch — a PR-group split only happens once `spec-interview` has already confirmed a full REQ ledger, so there is no rough-filing gap left for those steps to fill. No epic-issue is involved in this case.
   - **Multi-task initiative**: `epic-filing` interviews the user on background/goal/success criteria, breaks the initiative into task candidates, files an epic-issue, then files each candidate as its own task-issue (via `spec-interview` → `task-filing`'s "File a task under a parent epic" operation) as a sub-issue of the epic. Once every candidate is filed, `epic-filing` reports back the epic issue number and the list of filed task-issue numbers. **This is a stopping point** — escalate to the human, asking which task-issue to start with (this replaces the old "sub issue split" escalation point; the set of 5 escalation points in this skill's intro is unchanged in count, just relabeled here). Do not invoke `spec-to-tests` or anything past this point automatically until a task-issue is picked. Once picked, that task-issue's `N` continues at step 3 below, same as the single-work-task path.
   - If, inside the single-work-task path, `spec-interview` itself reports a Step 4 split because it discovered independent concerns mid-interview, `spec-interview` hands off to `epic-filing` directly (its Entry B) instead of returning to `run` — the multi-task initiative bullet above applies once `epic-filing` reports back.
3. **Investigate the codebase.** Once a single task-issue number `N` is in hand (either directly from the single-work-task path, or picked by the human after a multi-task initiative split), dispatch a built-in `Explore` agent to survey the codebase for anything relevant to issue `N` — existing code touching the same area, related conventions, prior art to reuse or avoid duplicating. No dedicated investigation skill exists for this single dispatch (that would be YAGNI) — call `Explore` directly. Summarize its findings back to the user in one short status line, then continue without waiting for a response.
4. **Design phase.** Invoke `sd-tdd:design-planning` for issue `N`, handing it the investigation summary from step 3, so a human can pair with `run` on architecture/interface decisions before any test or implementation code is written. `design-planning` decides how to record the outcome, not `run`: finalized design decisions go to `task-filing`'s "Append to an existing task" operation (`## 決定事項` section) for issue `N`; if the discussion surfaces new testable REQs (including the very first ones, if `N` was filed with an empty ledger), `design-planning` hands off to `spec-interview` (continuation of issue `N`) to draft them, then `task-filing`'s append operation to record them — the same append mechanism `run` already uses in "Ambiguity during implementation" below, not a new one. This step is part of `run`'s own sequencing, so keep going once `design-planning` returns — it is not one of the 5 escalation points above.
5. Run "Implementing one scope" (below) for issue `N` with the full REQ ledger (as it stands after step 4) as the scope.

## Handling a split

- **PR group split:** invoke `task-filing`'s "File as PR groups" operation to record the single issue with its `## PRグループ` section — unless `epic-filing` already filed it that way inside the single-work-task path (see "Starting new work"), in which case that filing is done and you start at the per-group loop below with the `N` and mapping it reported. Then, for each group in the order listed (do not reorder), run "Implementing one scope" narrowed to that group's REQ-IDs — `spec-to-tests` targets that group (its Step 2), `coverage-check` is run with `--group <G>`, and a separate Draft PR is created and reviewed per group. Move to the next group automatically once a group's PR reaches ready-for-review; do not escalate to a human just because a group finished. **Groups are dependent, so branches and PRs stack:** group 1's worktree branches off the repository's default branch as usual. Group 2's (and every later group's) worktree branches off **group (G−1)'s branch tip**, not the default branch — otherwise it would be missing the prior group's prerequisite code (see "Implementing one scope" step 1, which applies this rule). Correspondingly, group G's Draft PR (G ≥ 2) targets group (G−1)'s branch as its `--base`, not the default branch, so its diff shows only that group's own changes. **Tag every PR-group PR's title with `[group G]`** (e.g. `[group 2] <title>`) — this is not cosmetic, "Resuming an existing issue" step 2 depends on it to find each group's PR; see "Creating the PR" for how this tag actually gets applied via a `gh pr edit` fixup after `submit` creates the PR (which also handles noting the stacking relationship in the PR body for group ≥2). Do not wait for an earlier group's PR to merge before starting the next group — `run` keeps moving automatically per REQ-4, and rebasing/retargeting a later group's PR onto the default branch after an earlier one merges is left to the human, same as the merge itself.

## Implementing one scope

The shared sequence for one unit of work — either the whole ledger (no split) or one PR group's REQ subset. `N` is the issue being worked; "scope" means the REQ-IDs in play (all active REQs, or just the current group's).

1. **Isolate the work.** Invoke `superpowers:using-git-worktrees` to create a dedicated git worktree *before* invoking `spec-to-tests`. Every step from here on — test writing, implementation, commits — happens inside that worktree, not the branch `run` was invoked from. For a PR-group step after the first, base this worktree on the *previous group's branch tip*, not the default branch — see "Handling a split" for why. `using-git-worktrees`'s own Step 0 asks for consent before creating a worktree unless "the user has already indicated their worktree preference" — treat this call from `run` as exactly that declared preference (this is what the sd-tdd pipeline always does; it is not optional per task), so answer its consent check as already given and don't surface a separate question to the user. This is not one of the 5 escalation points above.
2. Invoke `spec-to-tests` for issue `N` (tell it which group, if scoped). `spec-to-tests`'s own Step 2 defaults to *asking* the user which group to process when it isn't told — being told by `run` here preempts that ask, so it proceeds straight to that group without a separate question.
3. Invoke `coverage-check` for issue `N` (`--group <G>` if scoped) — see "Running coverage-check" below.
   - Missing REQs: invoke `spec-to-tests` again for exactly those REQ-IDs, then re-run `coverage-check`. Repeat until it passes. Don't ask the user first — this is a mechanical retry.
   - Orphan tests: follow `coverage-check`'s own guidance (invoke `spec-interview` to draft the missing REQ + `task-filing` to append it, or fix/remove the stray test), then re-run.
4. Once `coverage-check` passes cleanly, go to "Implementing against the tests".

## Implementing against the tests

Invoke `superpowers:test-driven-development`, telling it which issue/REQ-IDs (scope) it's implementing against, inside the worktree from step 1. If any REQ in scope is tagged `[structural]`, say so explicitly in that same invocation: `spec-to-tests` generated no test for those (see its Step 4), and their implementation is exempt from the Iron Law — implement them directly, without a failing test first. This exemption applies only to `[structural]` REQs; every other REQ in scope still goes through the normal test-first cycle.

Track failures **per REQ**, not per test run: if the test(s) for the same REQ-ID are still failing after 3 consecutive implementation attempts, stop — don't try a 4th time. Escalate to the human with the REQ-ID and a summary of the failure (test name, error). Otherwise, once every test in scope passes, go to "Creating the PR".

## Ambiguity during implementation

If implementation surfaces a design decision that no REQ in the ledger resolves — multiple reasonable choices, nothing in the ledger dictates one — don't guess and don't let `test-driven-development` guess either. Invoke `spec-interview` (continuation of issue `N`) to draft the missing REQ, then `task-filing`'s append operation to record it, then resume implementation against the now-updated ledger.

## Creating the PR

Once every test in scope passes, invoke `sd-tdd:submit` to turn the worktree's committed work into a pushed branch and a Draft PR — don't run `git push`/`gh pr create` here directly; that logic lives in `submit` now, not in `run`. Pass it:

- The issue number `N`, so it links the issue (`submit` always writes `Closes #N` when given an issue number — see the `gh pr edit` fixup below for turning this into `Part of #N` on a non-final PR-group step) and pulls in the REQ list and any `[structural]` REQs for the "## 構造的制約" section (`submit`'s REQ-20) automatically.
- **For a PR-group step after the first**, the previous group's branch as an explicit base-branch override (`submit`'s REQ-19) — this is what makes `submit`'s Draft PR target that branch instead of the repository's default branch (see "Groups are dependent, so branches and PRs stack" above). For the first step (no split, or the first PR-group step), don't pass a base override; `submit` auto-detects the repository's default branch on its own.

`submit` has no awareness of PR groups (by design — it's a plain single-PR tool), so `run` fixes up the following itself after `submit` reports the created PR's number, **for every PR-group step (any group, including the last)** — skip this whole fixup when there's no PR-group split at all:

```bash
gh pr view <PR-number> --json title,body -q '.title, .body'
```

- **Title:** `submit`'s inferred title won't include the `[group G]` tag "Resuming an existing issue" depends on — using the title just fetched above, `gh pr edit <PR-number> --title "[group G] <fetched-title>"`.
- **Stacking note (group ≥ 2 only):** append a note to the body identifying what this PR is stacked on, e.g. "Stacked on #<group (G−1)'s PR number>; targets that branch, not `<default-branch>`, until it merges". Group 1 has nothing to stack on — skip this for group 1.
- **Closing keyword (REQ-21, non-last group only):** for a PR-group step that is **not** the last group, `submit` will have written `Closes #N` (that's the only form it can produce), which is wrong here — merging this PR would prematurely close issue `N` while later groups are still pending. Replace the `Closes #N` line with `Part of #N`. For the *last* PR-group step, leave `Closes #N` as `submit` wrote it — don't replace it.

Apply the body changes (stacking note, and the closing-keyword replacement when applicable) together in one `gh pr edit`:

```bash
gh pr edit <PR-number> --body "$(cat <<'EOF'
<body from gh pr view above, with Closes #N replaced by Part of #N (non-last group only) and the stacking note appended (group >= 2 only)>
EOF
)"
```

Then go to "Requesting review" with the PR number `submit` just created.

## Requesting review

Invoke `sd-tdd:review-pr` with the PR number from "Creating the PR" (or, on a re-review round below, the same PR number again) — don't call `superpowers:requesting-code-review` or compute BASE_SHA/HEAD_SHA directly here; `review-pr` (via `sd-tdd:review`) owns that, and it also owns converting the PR to ready-for-review on a clean result (`review-pr`'s REQ-15) or leaving it Draft with findings reported (REQ-16). `run` only owns the retry/escalation loop around it:

1. Invoke `sd-tdd:review-pr` with the PR number.
2. Read what it reports back:
   - **It left the PR Draft with Critical/Important findings:** fix them, commit, then repeat this step (invoke `sd-tdd:review-pr` again with the same PR number). Count this as one round. After 3 rounds still carrying an unresolved Critical/Important, stop and escalate to the human with the outstanding findings — don't attempt a 4th round.
   - **It converted the PR to ready for review:** report the PR URL and its review summary (including any Minor findings, for the human's awareness) to the user. This scope is done — do not merge, ever.
3. Leave the git worktree in place; `run` never deletes it. Cleanup is the human's call.

## Resuming an existing issue

Given issue number `N`:

**First, check whether `N` is an epic-issue — before looking for REQ lines at all:** `gh issue view <N> --json labels -q '.labels[].name'`. If the output contains exactly `epic`, `N` is an epic-issue, not a task-issue. An epic-issue by design carries **no** `REQ-<id>:` lines (see `epic-filing`'s "Constraint: epic-issueにREQ行を書かない"), so the REQ-ledger resume below would read it as "no ledger yet" and append REQ lines straight into the epic — corrupting it. Instead, hand off to `epic-filing` with epic issue number `N` and let its own "Resuming an interrupted epic" logic file whatever task-issue candidates are still missing. When it reports back the epic number and its task-issue numbers, that is the multi-task initiative escalation point (escalation point 2): ask the human which task-issue to start with, then run "Implementing one scope" for *that* task-issue number — never for the epic number. Do not run any of the numbered steps below with an epic number. Only for a non-epic issue, continue:

1. Fetch the ledger: `gh issue view <N> --json body,state -q .body`. If the command fails or the issue has no `REQ-<id>:` lines, treat this as if no ledger exists yet: this case is otherwise identical to "Starting new work," just filing into existing issue `N` instead of a new one — invoke `test-infra-setup` first (same as step 1 there; `spec-to-tests` only *tells you* to go run it if missing, it doesn't run it for you), then invoke `spec-interview` telling it this is a continuation of issue `N`, then once approved invoke `task-filing`'s **append** operation (not the new-task operation) for issue `N` — or, if `spec-interview`'s Step 4 proposes and the user approves an independent-concerns split, hand off to `epic-filing` (Entry B) instead; or if a PR-group split is proposed and approved, see "Handling a split" — then run "Implementing one scope" for issue `N`.
2. Detect the test directory (see "Detecting the test directory" below).
   - **No `## PRグループ` section:** just run `coverage-check` (see "Running coverage-check" below) for issue `N` with no `--group` flag, and go to step 3.
   - **Has a `## PRグループ` section:** find the group to resume by PR state, not by `coverage-check` alone — `coverage-check` only tells you whether tests exist for a REQ, not whether that group's implementation is finished, so a group with generated-but-still-failing tests would look identical to a genuinely finished one if you went by coverage alone. For each group `G` starting from 1, in listed order: `gh pr list --search "\"[group G]\" in:title" --state all --json state,isDraft,number` (per the `[group G]` title tag required in "Creating the PR"). The first group with **no matching PR**, or whose PR is still a **Draft**, is the group to resume — stop the loop there. (Groups whose PR is ready-for-review or merged are done; skip past them.) Once you have that group `G`, run `coverage-check --group <G>` for issue `N` to find out *how* far it got, and go to step 3.
3. Interpret the result:
   - **A Draft PR already exists for this group** (found via the `gh pr list` lookup in step 2 — only relevant for a PR-group task): implementation and PR creation already happened in a prior session; mark TodoWrite items 1–3 and 6–10 `completed` and resume directly at "Requesting review" using that PR's number (from the same `gh pr list` lookup) — don't re-run `spec-to-tests`, implementation, or `sd-tdd:submit`.
   - **No PR yet, and coverage-check reports missing REQs, or the test directory has no `issue-<N>_REQ-` matches at all**: mark TodoWrite items 1–3 `completed`, and resume "Implementing one scope" from its step 1 (worktree creation) — a resumed run still needs its own isolated worktree even if one existed in a prior session, unless that worktree is still present and on the right branch, in which case reuse it. Resuming skips the investigation/design steps (items 4–5) — those are part of "Starting new work" only; a resumed issue is treated as already past that point.
   - **No PR yet, and coverage-check passes cleanly**: tests exist but implementation isn't done (no PR was ever created for this group — see "Creating the PR," which only runs once tests pass); mark TodoWrite items 1–3 and 6–8 `completed`, and resume "Implementing one scope" from "Implementing against the tests" onward.

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

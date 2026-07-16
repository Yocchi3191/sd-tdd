---
name: merge-cleanup
description: Use when the user reports that a PR/branch has just been merged (e.g. "merge done", "マージ完了", "マージ済みです") — verifies the merge actually happened via gh/git before touching anything, then updates the default branch and removes the merged branch and its dedicated worktree if any. Never runs based on the utterance alone; always confirms actual merged state first. Does not reinstall dependencies (node_modules etc.).
---

# Merge Cleanup

Cleans up local state after a PR is merged: refreshes the default branch, deletes the now-merged local branch, and removes its dedicated git worktree — but only after independently confirming the merge actually happened. A user saying "merge done" is a cue to check, never a license to act.

## Step 1: Recognize the trigger, then verify — never act on the utterance alone

Treat any utterance that plausibly reports a merge as a trigger *candidate* (e.g. "merge done", "マージ完了しました", "マージ済みです", "PRマージしました"). An utterance with no such signal (e.g. "テストを直して", unrelated requests) is not a candidate — do nothing and don't proceed to the steps below.

For a trigger candidate, do not perform any of the actions in Step 3 onward yet. First identify the PR tied to the current branch and check its actual state:

```bash
gh pr view --json state,mergedAt,headRefName
```

- **`state` is `MERGED`:** proceed to Step 2.
- **`state` is anything else (`OPEN`, `DRAFT`, etc.), or no PR is found for the current branch:** stop here. Report the actual state to the user (e.g. "PR #N はまだ OPEN です。マージが確認できないため、クリーンアップは行いませんでした。") and perform none of Step 2 onward. This check exists specifically so the utterance can't cause a destructive action on its own — never skip it, and never treat "the user said so" as sufficient confirmation by itself.

## Step 2: Identify the target branch and its worktree

- The target branch is `headRefName` from the PR checked in Step 1 — this is the *only* branch this run touches.
- Find whether it has a dedicated worktree:

```bash
git worktree list
```

Match a worktree whose checked-out branch is the target branch. If none matches, there is no dedicated worktree for it (see Step 5's non-worktree path).

## Step 3: Update the default branch without switching anything

Refresh the repository's default branch (from `gh repo view --json defaultBranchRef` or equivalent) by updating its local ref directly, without checking it out and without switching the current worktree/branch away from whatever it's currently on:

```bash
git fetch origin <default-branch>:<default-branch>
```

If the default branch happens to be checked out elsewhere (another worktree), this still works safely since it only updates the ref, not a working tree. Do this regardless of what happens in the steps below — it is never blocked by uncommitted changes or worktree state.

## Step 4: Check for uncommitted changes before deleting anything

In the target branch's working tree (its dedicated worktree if one exists, otherwise the location where it's checked out), check for staged, unstaged, and untracked changes:

```bash
git status --porcelain
```

**Any output (staged, unstaged, or untracked) present:** stop before deleting the branch or its worktree. Report to the user that uncommitted changes remain and nothing was deleted (e.g. "未コミットの変更が残っているため、ブランチ/worktreeの削除は行いませんでした。"). Step 3 has already run regardless — do not undo or skip it on account of this.

**No output (clean):** proceed to Step 5.

## Step 5: Remove the worktree, if any — but never the one you're standing in

If Step 2 found a dedicated worktree for the target branch:

- **That worktree is the current shell session's working directory:** do not remove it — git cannot remove a worktree that's the active cwd, and doing so out from under the running session would break it. Report that manual removal is needed once the user has moved elsewhere (e.g. "現在のカレントディレクトリのため、このworktreeは削除しませんでした。別ディレクトリに移動してから手動で削除してください。"). Continue to Step 6 for the branch itself — do not delete the branch either while its worktree is still in place and checked out.
- **Otherwise:** remove it:

```bash
git worktree remove <path>
```

If Step 2 found no dedicated worktree at all, skip this step entirely (nothing to remove) and continue to Step 6.

## Step 6: Delete the merged branch — only this one

Delete only the target branch identified in Step 2. Never touch any other local branch, merged or not — this is not a general branch-sweep, it only ever removes the branch tied to the merge just confirmed.

- **The branch had a dedicated worktree that was removed in Step 5:** the branch is no longer checked out anywhere; delete it directly:

```bash
git branch -d <target-branch>
```

- **The branch had a dedicated worktree that Step 5 skipped (cwd case):** don't delete the branch this run — it's still checked out in that worktree. Leave it for the user to clean up alongside the manual worktree removal from Step 5.
- **The branch had no dedicated worktree and is currently checked out directly in the main repository working tree:** git refuses to delete a checked-out branch, so first switch that working tree to the default branch, then delete:

```bash
git checkout <default-branch>
git branch -d <target-branch>
```

## Step 7: Never reinstall dependencies

This skill's scope ends at git/worktree cleanup. Never run `npm install`, `pip install`, or any other dependency-reinstallation command as part of or after cleanup, even if a removed worktree contained installed dependencies (e.g. `node_modules`). Re-provisioning dependencies elsewhere is left entirely to the user.

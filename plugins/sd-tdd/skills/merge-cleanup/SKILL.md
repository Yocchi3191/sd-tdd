---
name: merge-cleanup
description: Use when the user reports that a PR/branch has just been merged (e.g. "merge done", "マージ完了", "マージ済みです") — verifies the merge actually happened via gh/git before touching anything, then updates the default branch and removes the merged branch and its dedicated worktree if any. Never runs based on the utterance alone; always confirms actual merged state first. Does not reinstall dependencies (node_modules etc.).
---

# Merge Cleanup

Cleans up local state after a PR is merged: refreshes the default branch, deletes the now-merged local branch, and removes its dedicated git worktree — but only after independently confirming the merge actually happened. A user saying "merge done" is a cue to check, never a license to act.

## Step 1: Recognize the trigger, then verify — never act on the utterance alone

Treat any utterance that plausibly reports a merge as a trigger *candidate* (e.g. "merge done", "マージ完了しました", "マージ済みです", "PRマージしました"). An utterance with no such signal (e.g. "テストを直して", unrelated requests) is not a candidate — do nothing and don't proceed to the steps below.

For a trigger candidate, do not perform any of the actions in Step 3 onward yet. First identify the PR to check:

- If the utterance (or the ongoing conversation) names a specific branch or issue number, resolve that PR explicitly: `gh pr view <branch>`, or resolve the named issue to its PR first.
- Otherwise, default to the current branch (`gh pr view` with no argument) — but only after confirming the current branch is actually the one the user means. If the session's cwd has since moved to a different worktree/branch than the one the user is referring to, resolving against "current branch" would silently check the wrong PR; when in doubt, ask which branch/PR the user means rather than guessing.

```bash
gh pr view [<branch>] --json state,headRefName
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

(If the current branch is itself the default branch — not the normal case here, since the target branch identified in Step 1 is the just-merged feature branch — a plain `git pull` in place is simpler and fine to use instead.)

## Step 4: Check for uncommitted changes before deleting anything

In the target branch's working tree (its dedicated worktree if one exists, otherwise the location where it's checked out), check for staged, unstaged, and untracked changes:

```bash
git status --porcelain
```

**Any output (staged, unstaged, or untracked) present:** stop before deleting the branch or its worktree. Report to the user that uncommitted changes remain and nothing was deleted (e.g. "未コミットの変更が残っているため、ブランチ/worktreeの削除は行いませんでした。"). Step 3 has already run regardless — do not undo or skip it on account of this.

**No output (clean):** proceed to Step 5.

## Step 5: Remove the worktree, if any — relocating first if you're standing in it

If Step 2 found a dedicated worktree for the target branch:

- **That worktree is the current shell session's working directory:** git cannot remove a worktree that's the active cwd — but Step 1 already confirmed the merge authoritatively, so this is not a reason to stop and hand off to the user. Relocate, then remove it via whichever removal method below applies:
  - If the `ExitWorktree`/native-tool path below applies, just call it — its `remove` action already restores the session's working directory as part of removing the worktree, so no separate relocation step is needed.
  - Otherwise, first move the session's current directory to the repository's main working tree (its root checkout — not any other directory), then run `git worktree remove` as below.
  This applies regardless of who originally created the worktree — one from another session, or one created manually with `git worktree add`, is relocated-and-removed the same way once the merge is confirmed; it is not limited to worktrees this session itself entered.
- **Otherwise (not the cwd):** remove it directly via whichever removal method below applies.

**Removal method** (for either case above): if *this session itself* entered this exact worktree via a native tool (e.g. it's the harness's `EnterWorktree`-created worktree the current session's cwd is or was in), prefer that tool's removal action (e.g. `ExitWorktree` with a remove action) instead of the raw git command below — it also tears down anything else the native tool set up (locks, session cwd, attached processes). Native worktree-removal tools like `ExitWorktree` are typically scoped to worktrees *their own session* created; they no-op (without actually removing anything) on a worktree from a different or earlier session, so never use them for a worktree this session didn't itself enter — go straight to the git commands below for those, including ones locked by another session:

```bash
git worktree remove <path>
```

If this fails because the worktree is locked (`git worktree list` shows it as `locked`, or the command reports "is locked"), unlock it first, then retry:

```bash
git worktree unlock <path>
git worktree remove <path>
```

### If removal is refused over unmerged/lost commits (squash or rebase merges)

Either removal path above can refuse on the grounds that the branch's commits aren't a literal ancestor of anything else on disk — `ExitWorktree` surfaces this by requiring `discard_changes: true` (and listing the commits it would lose), or `git worktree remove` may need `--force` for the equivalent reason. This is expected for a squash- or rebase-merged branch: the commits were never going to appear as an ancestor anywhere locally, even though Step 1 already got authoritative proof from GitHub that the PR was genuinely merged.

Before overriding, verify no work would actually be lost — same check as Step 6's "not fully merged" case below:

```bash
git rev-list origin/<target-branch>..<target-branch>
```

- **No output (local is not ahead of what was pushed):** nothing beyond what GitHub already merged would be discarded. Confirm briefly with the user before overriding (e.g. "squash/rebaseマージのため削除時に〇コミット分の警告が出ていますが、push済み内容を超えるコミットはありません。worktreeを削除してよいですか？"). Once confirmed, retry with the override (`ExitWorktree` with `discard_changes: true`, or `git worktree remove --force <path>`).
- **Any output, or the command itself errors:** stop — don't override. Report to the user that commits beyond what was ever pushed would be lost; do not remove the worktree.

If Step 2 found no dedicated worktree at all, skip this step entirely (nothing to remove) and continue to Step 6.

## Step 6: Delete the merged branch — only this one

Delete only the target branch identified in Step 2. Never touch any other local branch, merged or not — this is not a general branch-sweep, it only ever removes the branch tied to the merge just confirmed.

- **The branch had a dedicated worktree that was removed in Step 5 (including a worktree that used to be the current shell session's cwd — see Step 5's relocation handling):** the branch is no longer checked out anywhere; delete it directly:

```bash
git branch -d <target-branch>
```

- **The branch had no dedicated worktree and is currently checked out directly in the main repository working tree:** git refuses to delete a checked-out branch, so first switch that working tree to the default branch, then delete:

```bash
git checkout <default-branch>
git branch -d <target-branch>
```

In either deletion case, if `git branch -d` refuses with "not fully merged", don't immediately force it — that refusal has two different causes and only one of them is safe to override:

```bash
git rev-list origin/<target-branch>..<target-branch>
```

If this command itself errors (e.g. "unknown revision" because the remote branch was already auto-deleted and pruned) rather than cleanly producing output or not, treat that the same as "stop and ask the user" — don't assume safety in the absence of a clean answer.

- **No output (local is not ahead of its last-pushed state):** the refusal is purely representational — a squash or rebase merge means the branch's commits are never literally an ancestor of the default branch, even though GitHub reports the PR as genuinely merged. Step 1 already obtained that authoritative proof from GitHub, which supersedes git's local ancestry heuristic here, so it's safe to fall back to `git branch -D <target-branch>`.
- **Any output (local has commits beyond what was ever pushed):** stop — those specific commits were never part of what GitHub confirmed as merged, so forcing the delete would genuinely lose work. Report this to the user instead of deleting (e.g. "ブランチ `<target-branch>` にpush済みの状態より先のコミットが残っているため、削除しませんでした。").

On a full, unblocked success, report what happened, e.g.: "PR #N のマージを確認しました。main を最新化し、ブランチ `<target-branch>` とそのworktreeを削除しました。"

## Step 7: Never reinstall dependencies

This skill's scope ends at git/worktree cleanup. Never run `npm install`, `pip install`, or any other dependency-reinstallation command as part of or after cleanup, even if a removed worktree contained installed dependencies (e.g. `node_modules`). Re-provisioning dependencies elsewhere is left entirely to the user.

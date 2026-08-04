---
name: submit
description: Use when the user wants to commit the current working-tree changes and open a Draft PR without running the full sd-tdd:run pipeline — e.g. "submitして", "今の変更をPRにして", or when run's own "Creating the PR" step delegates here. Commits any uncommitted changes with an inferred message, auto-detects the head/base branches, pushes, and opens a Draft PR from pr-template.md. Never converts a PR to ready for review — that is review-pr's job.
---

# Submit

Turns the current working tree into a pushed branch and a Draft PR, without requiring the rest of the sd-tdd pipeline to have run first. This is the single-command equivalent of `run`'s "Creating the PR" step, usable on its own when resuming mid-flow or when no REQ ledger orchestration is needed at all.

## Step 1: Commit any uncommitted changes

```bash
git status --porcelain
```

- **No output (clean):** nothing to commit — skip straight to Step 2. Never create an empty commit.
- **Any output (staged, unstaged, or untracked changes):** stage everything and commit with a message you infer from the change content — never ask the user to supply one:

```bash
git add -A
git diff --cached --stat
```

Read the staged diff, infer a concise commit message describing what changed (not why — that belongs in the PR body), then commit:

```bash
git commit -m "<inferred message>"
```

## Step 2: Detect head and base branches

The head branch is whatever is currently checked out:

```bash
git branch --show-current
```

The base branch is where that branch diverged from — find it against the repository's default branch:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git merge-base <head-branch> origin/<default-branch>
```

If the current branch *is* the default branch, stop and tell the user there's nothing to submit against — a PR needs a head branch distinct from its base.

## Step 3: Push

```bash
git push -u origin <head-branch>
```

If the branch is already up to date with its remote (no local commits ahead of `origin/<head-branch>`), skip this — don't push when there's nothing new to send.

## Step 4: Ensure pr-template.md exists

Check for `pr-template.md` in this skill's own directory (next to this `SKILL.md`). If it is missing, create it before continuing — don't improvise a PR body from scratch. Use this as the template:

```markdown
<!-- 対象issue番号が無い場合、この行ごと省略する -->
Closes #<ISSUE_NUMBER>

## 概要
<!-- このPRで何を実装したか、変更内容の要約 -->
<SUMMARY>

## 変更対象のREQ
<!-- issueのREQ台帳から、このPRのスコープに含まれるREQ-IDを列挙する -->
<REQ_LIST>
```

If it already exists, reuse it as-is — never overwrite it.

## Step 5: Fill the template and create the Draft PR

Read `pr-template.md` and fill in its placeholders:

- `<ISSUE_NUMBER>`: if an issue number was given to this invocation, fill it in and keep the `Closes #<ISSUE_NUMBER>` line. If no issue number was given, delete that line entirely — don't leave a dangling `Closes #` with nothing after it, and don't treat a missing issue number as an error.
- `<SUMMARY>`: a concise summary of what the committed changes do, inferred from the diff (and the issue's REQ ledger, if an issue number was given).
- `<REQ_LIST>`: if an issue number was given, the REQ-IDs in scope for this PR (fetch the ledger via `gh issue view <N> --json body -q .body` and list the active ones relevant to this diff). If no issue number was given, delete this section.

Derive a PR title from the summary (or the issue title, if an issue number was given).

```bash
gh pr create --draft --base <base-branch> --title "<title>" --body "<filled-in template>"
```

Report the created PR's URL back to the user. Never run `gh pr ready` here — this skill only ever creates Draft PRs; converting to ready for review is `review-pr`'s responsibility, not this one's.

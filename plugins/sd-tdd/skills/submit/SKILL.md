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
git diff --cached
```

Read the full staged diff (not just `--stat`) so the inferred message reflects what actually changed, not just which files and how many lines — fall back to `git diff --cached --stat` only as a truncation guard when the diff is too large to read in full. Infer a concise commit message describing what changed (not why — that belongs in the PR body), then commit:

```bash
git commit -m "<inferred message>"
```

## Step 2: Detect head and base branches

The head branch is whatever is currently checked out:

```bash
git branch --show-current
```

If this prints nothing (detached HEAD), stop and tell the user submit needs a named branch to open a PR from — check out or create one first.

The base branch is the repository's default branch:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

Use that name directly as `<base-branch>` in the steps below. (This skill only supports submitting against the default branch — it has no way to target a different base, such as a prior PR-group's branch. If a future caller needs that, it must be passed explicitly; this is out of scope here.)

If the current branch *is* the default branch, stop and tell the user there's nothing to submit against — a PR needs a head branch distinct from its base.

## Step 3: Push

Check whether there's anything new to send before pushing:

```bash
git rev-list --count '@{u}' 2>/dev/null && git rev-list --count '@{u}..HEAD'
```

- **The first command fails** (no upstream configured — branch has never been pushed): push.
- **The second command prints `0`** (local HEAD has no commits beyond its upstream): skip pushing — nothing new to send.
- **Otherwise:** push.

```bash
git push -u origin <head-branch>
```

## Step 4: Ensure pr-template.md exists

Check for `pr-template.md` in this skill's own directory (next to this `SKILL.md`). If it already exists, reuse it as-is — never overwrite it.

If it is missing, create it before continuing — don't improvise a PR body from scratch. Use this as the template (keep this copy in sync with the committed `pr-template.md` if that file is ever edited):

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

## Step 5: Fill the template and create the Draft PR

Read `pr-template.md` and fill in its placeholders:

- `<ISSUE_NUMBER>`: if an issue number was given to this invocation, fill it in and keep the `Closes #<ISSUE_NUMBER>` line. If no issue number was given, delete that line entirely — don't leave a dangling `Closes #` with nothing after it, and don't treat a missing issue number as an error.
- `<SUMMARY>`: a concise summary of what the committed changes do, inferred from the diff (and the issue's REQ ledger, if an issue number was given).
- `<REQ_LIST>`: if an issue number was given, the REQ-IDs in scope for this PR (fetch the ledger via `gh issue view <N> --json body -q .body` and list the active ones relevant to this diff). If no issue number was given, delete this section.

Derive a PR title from the summary, or, if an issue number was given, from the issue's title:

```bash
gh issue view <N> --json title -q .title
```

Create the PR using a heredoc for the body, since it's multi-line markdown that may itself contain backticks or quotes:

```bash
gh pr create --draft --base <base-branch> --title "<title>" --body "$(cat <<'EOF'
<filled-in template>
EOF
)"
```

Report the created PR's URL back to the user. Never run `gh pr ready` here — this skill only ever creates Draft PRs; converting to ready for review is `review-pr`'s responsibility, not this one's.

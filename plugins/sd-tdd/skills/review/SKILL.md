---
name: review
description: Use when the user wants their current working branch reviewed without needing a PR to exist first — e.g. "reviewして", "今の変更をレビューして", "コードレビューして". Dispatches a context-reset subagent (via superpowers:requesting-code-review) to review the diff between the branch's divergence point and its latest commit. Never converts any PR to ready for review — that is review-pr's job, which wraps this skill when a PR number is given.
---

# Review

Runs a code review of the current working branch's diff, without requiring a PR to exist. This is the review-body counterpart to `sd-tdd:submit`: where `submit` turns changes into a PR, `review` just reviews them — usable mid-flow, before a PR exists, or any time a second opinion is wanted. `sd-tdd:review-pr` is a thin adapter on top of this skill for when the input is a PR number instead of "the current branch."

## Step 1: Compute BASE_SHA and HEAD_SHA from the current branch

```bash
git branch --show-current
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git merge-base HEAD origin/<default-branch>
git rev-parse HEAD
```

- `BASE_SHA` = the `git merge-base` output — where the current branch diverged from the repository's default branch (`<default-branch>` is the name from `gh repo view` above).
- `HEAD_SHA` = the current branch's latest commit (`git rev-parse HEAD`).

Do this unconditionally and regardless of whether a PR exists for this branch — never ask the user for these SHAs, never require a PR to exist first, and never look one up. If the current branch *is* the default branch, stop and tell the user there's nothing to review — a review needs a branch with its own commits. If `git branch --show-current` prints nothing (detached HEAD), stop and tell the user review needs a named branch.

## Step 2: Determine PLAN_OR_REQUIREMENTS

- **An issue number was given to this invocation:** fetch that issue's REQ ledger and use it as PLAN_OR_REQUIREMENTS:

```bash
gh issue view <N> --json body -q .body
```

- **No issue number was given:** don't go looking for one. Infer a concise summary of what the branch is meant to accomplish from its commit log and diff content (`git log <BASE_SHA>..<HEAD_SHA>`, `git diff <BASE_SHA>..<HEAD_SHA>`), and use that inferred summary as PLAN_OR_REQUIREMENTS. A missing issue number is normal here, not an error.

## Step 3: Determine DESCRIPTION

A brief summary of what was implemented, inferred from the same commit log/diff used in Step 2 — one or two sentences.

## Step 4: Dispatch the reviewer via superpowers:requesting-code-review

Invoke `superpowers:requesting-code-review` exactly as documented there — this skill introduces no new review prompt or template. Fill its template with:

- `DESCRIPTION`: from Step 3.
- `PLAN_OR_REQUIREMENTS`: from Step 2.
- `BASE_SHA` / `HEAD_SHA`: from Step 1.

## Step 5: Report the result — never change PR state

Report the reviewer's Strengths / Issues / Recommendations / Assessment back to the user as-is.

Regardless of the review's outcome — including a clean pass with no Critical/Important findings — this skill never runs `gh pr ready`, `gh pr merge`, or any other PR-state-changing command. Converting a Draft PR to ready for review is `review-pr`'s responsibility, not this one's; `review` has no opinion on PR state because it doesn't assume a PR exists at all.

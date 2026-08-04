---
name: review-pr
description: Use when the user wants a specific PR reviewed and, if clean, converted to ready for review — e.g. "PR #40をレビューして", "review-pr 40", or when run's own review step (after a Draft PR already exists) delegates here. Resolves BASE_SHA/HEAD_SHA/PLAN_OR_REQUIREMENTS/DESCRIPTION from the PR itself, then delegates to sd-tdd:review for the actual review. On a clean result (no Critical/Important findings), converts the PR to ready for review via `gh pr ready`; otherwise leaves it Draft and reports the outstanding findings.
---

# Review PR

A thin adapter over `sd-tdd:review` for when the input is a PR number instead of "the current branch." `review` is the review body; this skill is the PR-shaped input adapter around it, plus the one piece of logic that only makes sense once a PR exists: converting it to ready for review on a clean pass.

## Step 1: PR number is required

This skill always needs a PR number. If none was given, ask for one — never guess it from the current branch (that's `review`'s job, not this one's).

## Step 2: Resolve BASE_SHA and HEAD_SHA from the PR

```bash
gh pr view <N> --json baseRefName,headRefName,title,body
```

Fetch both refs so local git has the commits to diff:

```bash
git fetch origin <baseRefName> <headRefName>
```

```bash
git merge-base origin/<baseRefName> origin/<headRefName>
git rev-parse origin/<headRefName>
```

- `BASE_SHA` = the `git merge-base` output — where the PR's head branch diverged from its actual base branch (not necessarily the repository's default branch — this is what makes `review-pr` work correctly for a stacked PR-group PR, unlike `review`'s own self-computation, which is limited to the default branch).
- `HEAD_SHA` = the PR's head branch latest commit (`git rev-parse origin/<headRefName>`).

## Step 3: Resolve PLAN_OR_REQUIREMENTS from the PR body

Search the PR body fetched in Step 2 for an issue reference:

```
/(?:Closes|Part of) #(\d+)/i
```

- **A match is found:** fetch that issue's REQ ledger and use it as PLAN_OR_REQUIREMENTS:

```bash
gh issue view <matched-N> --json body -q .body
```

- **No match:** don't go looking for an issue any other way. Use the PR's own title and body (from Step 2) as PLAN_OR_REQUIREMENTS instead. A PR with no `Closes`/`Part of` reference is normal, not an error.

## Step 4: Resolve DESCRIPTION

A brief summary of what the PR does, inferred from its title and body (Step 2) — one or two sentences.

## Step 5: Delegate to sd-tdd:review

Invoke `sd-tdd:review`, supplying it the four values resolved above (BASE_SHA, HEAD_SHA, PLAN_OR_REQUIREMENTS, DESCRIPTION) so it takes its Step 0 shortcut straight to dispatching `superpowers:requesting-code-review` — don't let `review` recompute these from "the current branch," and don't call `superpowers:requesting-code-review` directly from here; go through `review` so there's exactly one place that owns the actual review dispatch.

## Step 6: Act on the review result

Read the Assessment `review` reports back:

- **No Critical or Important findings** (Minor findings or none): convert the PR to ready for review:

```bash
gh pr ready <N>
```

Then report the PR URL and a short review summary (including any Minor findings) to the user.

- **Any Critical or Important finding:** leave the PR as Draft — do not run `gh pr ready`. Report the outstanding findings to the user as-is. This skill does not retry, auto-fix, or loop back for a re-review on its own; a fresh call to `review-pr` after fixes are pushed is what re-reviews it (the retry/escalation limits, if any, are `run`'s concern when it drives this skill in a loop — not this skill's own).

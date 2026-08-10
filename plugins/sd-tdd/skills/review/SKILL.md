---
name: review
description: Use when the user wants their current working branch reviewed without needing a PR to exist first — e.g. "reviewして", "今の変更をレビューして", "コードレビューして". Dispatches a context-reset subagent (via superpowers:requesting-code-review) to review the diff between the branch's divergence point and its latest commit. Never converts any PR to ready for review — that is review-pr's job, which wraps this skill when a PR number is given.
---

# Review

Runs a code review of the current working branch's diff, without requiring a PR to exist. This is the review-body counterpart to `sd-tdd:submit`: where `submit` turns changes into a PR, `review` just reviews them — usable mid-flow, before a PR exists, or any time a second opinion is wanted. `sd-tdd:review-pr` is a thin adapter on top of this skill for when the input is a PR number instead of "the current branch."

## Step 0: Already have BASE_SHA/HEAD_SHA/PLAN_OR_REQUIREMENTS/DESCRIPTION?

If this invocation was handed all four of these already resolved (e.g. by `sd-tdd:review-pr`, which resolves them from a PR's actual base/head and body) — skip Steps 1-3 entirely and go straight to Step 4 with the supplied values. Steps 1-3 below exist only to derive these values from "the current branch" when nothing was supplied.

## Step 1: Compute BASE_SHA and HEAD_SHA from the current branch

```bash
git branch --show-current
```

If this prints nothing (detached HEAD), stop and tell the user review needs a named branch.

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
```

If the current branch *is* this default branch, stop and tell the user there's nothing to review — a review needs a branch with its own commits.

Now, with the default branch name substituted in place of `<default-branch>`:

```bash
git merge-base HEAD origin/<default-branch>
git rev-parse HEAD
```

- `BASE_SHA` = the `git merge-base` output — where the current branch diverged from the repository's default branch.
- `HEAD_SHA` = the current branch's latest commit (`git rev-parse HEAD`).

Do this unconditionally and regardless of whether a PR exists for this branch — never ask the user for these SHAs, never require a PR to exist first, and never look one up.

**Scope limitation:** this always diffs against the repository's *default* branch. On a stacked branch (e.g. a PR-group branch based on another feature branch, not on the default branch), this will include that base branch's own commits in the reported diff too — it has no way to detect or target a non-default base. Treat this as a known limitation, not a bug: a caller that needs a different base (e.g. `review-pr` reviewing a PR stacked on another PR) must resolve its own BASE_SHA and supply it via Step 0 instead of relying on this step.

## Step 2: Determine PLAN_OR_REQUIREMENTS

- **An issue number was given to this invocation:** fetch that issue's REQ ledger and use it as PLAN_OR_REQUIREMENTS:

```bash
gh issue view <N> --json body -q .body
```

- **No issue number was given:** don't go looking for one. Infer a concise summary of what the branch is meant to accomplish from its commit log and diff content (`git log <BASE_SHA>..<HEAD_SHA>`, `git diff <BASE_SHA>..<HEAD_SHA>`), and use that inferred summary as PLAN_OR_REQUIREMENTS. A missing issue number is normal here, not an error.

## Step 3: Determine DESCRIPTION

A brief summary of what was implemented, inferred from the same commit log/diff used in Step 2 — one or two sentences.

## Step 4: Record a pre-dispatch git-state snapshot

The reviewer subagent dispatched in Step 5 is instructed to be strictly read-only, but a prompt-level instruction is not an enforced guarantee — record a snapshot now so Step 6 can mechanically check whether that instruction was actually honored.

Reuse the branch name Step 1 already computed via `git branch --show-current`; if you arrived here via Step 0's shortcut (so Step 1 didn't run), compute it now the same way. Use this same `<current-branch>` value again in Step 6 — don't re-query it, since the reviewer subagent isn't expected to switch branches and re-querying could mask the very change being checked for.

Run the `review-guard` commands below from the sd-tdd plugin root (same convention as `coverage-check`):

```bash
node scripts/review-guard/cli.js snapshot --branch <current-branch> > /tmp/review-guard-before.json
```

## Step 5: Dispatch the reviewer via superpowers:requesting-code-review

Invoke `superpowers:requesting-code-review` exactly as documented there — this skill introduces no new review prompt or template. Fill its template with:

- `DESCRIPTION`: from Step 3.
- `PLAN_OR_REQUIREMENTS`: from Step 2.
- `BASE_SHA` / `HEAD_SHA`: from Step 1.

## Step 6: Record a post-dispatch snapshot and compare

Once the subagent returns, capture a second snapshot the same way and compare it against the one from Step 4:

```bash
node scripts/review-guard/cli.js snapshot --branch <current-branch> > /tmp/review-guard-after.json
node scripts/review-guard/cli.js compare --before /tmp/review-guard-before.json --after /tmp/review-guard-after.json
```

`compare` exits 1 (and prints `"violated": true` with a `reasons` array) when the two snapshots differ; it exits 0 (`"violated": false`) when they match.

- **`violated: false`:** no read-only violation — continue to Step 7 and report normally.
- **`violated: true`:** the reviewer subagent mutated the working tree, git history, or the remote-tracking branch despite Step 5's read-only instructions. Skip Step 7's normal report entirely and go to Step 7a instead.
- **Either `snapshot` or `compare` itself fails to run cleanly** (non-JSON output, a `git`/`node` error, one of the snapshot files missing) rather than exiting with a clean `violated: true`/`false` result: treat this as inconclusive, not as "no violation." Don't report a normal review in this case — stop and tell the user the read-only check itself could not be completed, so they can investigate before trusting the review result either way.

## Step 7: Report the result — never change PR state

Report the reviewer's Strengths / Issues / Recommendations / Assessment back to the user as-is.

Regardless of the review's outcome — including a clean pass with no Critical/Important findings — this skill never runs `gh pr ready`, `gh pr merge`, or any other PR-state-changing command. Converting a Draft PR to ready for review is `review-pr`'s responsibility, not this one's; `review` has no opinion on PR state because it doesn't assume a PR exists at all.

## Step 7a: Report a read-only violation instead

Only reached when Step 6 found `violated: true`. Return a violation report in place of the normal Strengths/Issues/Recommendations/Assessment format — do not present this as if it were an ordinary review result. Include:

- An explicit statement that the reviewer subagent violated its read-only instructions.
- The specific `reasons` from Step 6's `compare` output (e.g. which of HEAD SHA / working tree state / remote-tracking branch changed, and the before/after values).

This report is not a Critical/Important finding to be fixed and re-reviewed — it is a report about the review process itself, not about the code under review. `review-pr` is expected to treat a violation report differently from an ordinary finding-bearing result (see issue #50 REQ-5/REQ-6, landing in a separate PR group stacked immediately after this one) — until that lands, a caller invoking this skill through `review-pr` should not assume `review-pr`'s existing Draft/ready branching already accounts for this case.

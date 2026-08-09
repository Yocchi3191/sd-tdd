---
name: eval-runner
description: Use when you want to actually execute a skill's evals/evals.json and grade the result — e.g. "このskillのevalを実行して", "evals.jsonを走らせて判定して", or before merging a skill change to confirm it behaves as the evals describe. Runs each eval's prompt against the target skill as a `claude -p --plugin-dir <worktree>` subprocess, grades the captured output against expected_output/expectations in this same session, and reports a pass/fail summary as text or JSON. Also use for verifying a skill description's trigger accuracy, by invoking skill-creator's run_eval.py directly. This is an on-demand tool only — it is never invoked automatically by sd-tdd:run, and it never runs in CI.
---

# Eval Runner

Connects a skill's `evals/evals.json` to an actual execution engine: runs each eval's prompt against the target skill, grades the output, and reports pass/fail. Without this skill, `evals.json` files are inert documentation — nothing reads or executes them.

**Never automatic.** This skill is only ever invoked on demand, by a human or by Claude choosing to run it explicitly. It is not a step in `sd-tdd:run`'s pipeline (that pipeline never calls it) and it is not wired into CI (GitHub Actions or otherwise) — mutation testing and unit tests run on their normal schedules per `test-infra-setup`, but evals graded by this skill are always a manual, on-demand check.

## Inputs needed before starting

- **Target skill's `evals/evals.json` path** — e.g. `plugins/sd-tdd/skills/task-filing/evals/evals.json`.
- **Target plugin's worktree path** — the filesystem path to check out/read the plugin from when running `claude -p --plugin-dir <path>` (this can be the plugin's normal install location, or an unmerged worktree if you're validating in-flight changes before merge).
- **Which eval(s) to run** — default to all evals in the file unless the user names specific `id`s or `name`s.

If any of these is missing or ambiguous, ask before proceeding rather than guessing a path.

## Step 1: Run each eval's prompt as an executor subprocess

For each eval object being run, read its `prompt` field and execute it as a fresh, non-interactive `claude -p` subprocess scoped to the target plugin:

```bash
claude -p --plugin-dir <target-plugin-worktree-path> "<eval.prompt>"
```

Use the default (plain text) output mode — not `--output-format stream-json` or `--verbose` — so what you capture is the executor's final answer text, not its intermediate tool-call transcript or internal reasoning. Capture that stdout text as this eval's **executor output**. If the subprocess exits non-zero or produces no output, record that as the executor output too (an empty/errored run is still a real result to grade, not a reason to skip the eval).

Do this once per eval being run before moving to grading — keep each eval's prompt and captured executor output paired together for Step 2.

## Step 2: Grade the executor output against expected_output/expectations

For each eval, compare its captured **executor output** (Step 1) against that eval's `expected_output` and `expectations` fields from `evals.json`:

- For every string in `expectations[]`, decide **pass** or **fail**, and give a one- or two-sentence **evidence** note pointing at the specific part of the executor output text that justifies the verdict (quote or closely paraphrase it).
- Base every verdict **only on the captured executor output text** from Step 1. Never use the executor subprocess's own tool-call log, retries, or intermediate reasoning as evidence, even if you happened to see it (e.g. because you ran with `--verbose` by mistake) — an eval that only passes because the grader peeked at scratch work isn't actually verifying the final behavior.
- Grading happens inline, in this same skill invocation's session — do not spawn a separate grading subagent. Since the grader (this session) is a different process/context from the executor subprocess, judging the executor's output textually is not self-grading and carries no bias risk.

## Step 3: Report the summary

Once every requested eval has been run and graded, report:

- Overall pass/fail counts (e.g. `3/5 passed`).
- Per-eval results: eval `id`/`name`, each expectation's pass/fail with its evidence.

Output this as plain text or JSON, in your response — whichever the user's request implies, defaulting to text. **Never** generate or open an HTML viewer (`eval-viewer`) for these results; that tool exists in `skill-creator` for its own workflow and is out of scope here.

## Verifying a skill description's trigger accuracy (separate from Steps 1–3)

Trigger accuracy — whether a skill's `description` makes Claude invoke it on the right queries — is a different question from whether a skill *behaves* correctly once invoked (Steps 1–3 above), and uses a different eval-set shape (`{query, should_trigger}`, not `{prompt, expected_output, expectations}`). Don't reimplement this: call `skill-creator`'s own script directly.

```bash
python <skill-creator-plugin-path>/skills/skill-creator/scripts/run_eval.py --eval-set <trigger-eval-set.json> --skill-path <target-skill-path>
```

See that script's own `--help` for its full flag set (`--description`, `--num-workers`, `--timeout`, `--runs-per-query`, `--trigger-threshold`, `--model`, `--verbose`). Report whatever it outputs back to the user as-is — don't post-process or re-summarize it through Steps 2–3's grading format, since it already produces its own trigger-rate result.

## Authoring evals.json for a skill this runner will grade

When writing or updating an `evals/evals.json` that this skill will execute, use `skill-creator`'s schema — an `expectations` array of plain verifiable-statement strings per eval, not an `assertions` array of `{name, description}` objects:

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 0,
      "name": "issue-N_REQ-M_short_description",
      "prompt": "...",
      "expected_output": "...",
      "files": [],
      "expectations": ["...", "..."]
    }
  ]
}
```

This skill's own `evals/evals.json` (next to this file) follows that format. Existing sd-tdd skills whose `evals.json` still use the older `assertions` shape are not migrated by this skill — that backfill is a separate, later task; this runner's grading step (Step 2) only reads `expected_output`/`expectations`, so an unmigrated `assertions`-shaped file won't grade correctly here until it's converted.

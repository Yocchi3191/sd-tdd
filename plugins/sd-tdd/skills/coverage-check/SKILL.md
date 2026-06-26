---
name: coverage-check
description: Use after spec-to-tests has generated tests for an issue's REQ ledger, or whenever a new REQ is appended during implementation — mechanically verifies every active REQ-ID has at least one test before moving forward. Never substitute LLM judgment for this check; always run the script.
---

# Coverage Check

Verifies the REQ ledger on a GitHub issue and the test suite agree, without relying on LLM judgment — this is a mechanical grep/diff, not a read-through.

## When to run

- Right after `spec-to-tests` generates tests for an issue.
- Any time a new REQ is appended to the ledger during implementation (a newly discovered edge case, or a supersede correction) — re-run, don't assume coverage still holds.

## How to run

```bash
node scripts/coverage-check/cli.js --issue <N> --tests <path-to-test-dir>
```

(Path is relative to the sd-tdd plugin root; adjust `--tests` to wherever the target project's tests live.)

## Interpreting the result

- **Exit 0, no output about missing/orphans:** every active REQ has a test. Proceed — hand off to `superpowers:test-driven-development` to implement against the now-failing tests.
- **"Missing tests for: REQ-X, REQ-Y" (exit 1):** go back to the `spec-to-tests` skill and write tests for exactly those REQ-IDs. Do not edit the ledger to remove them — the ledger is append-only; if a REQ turns out to be wrong, it gets superseded (see `spec-interview`), not deleted.
- **"Tests reference REQ-IDs not in the issue ledger" (warning, exit 0):** a test exists whose `issue-N_REQ-XX` key has no matching ledger line. Two valid resolutions:
  1. It's a genuinely new requirement discovered while writing tests or implementing — invoke `spec-interview` to append it to the ledger as a new REQ-N+1, then re-run this check.
  2. It's a mistake (typo'd issue/REQ number, accidental scope creep) — fix or remove the test, then re-run this check.

Never silently ignore an orphan. The whole point of the ledger is that every test traces back to a recorded reason it exists.

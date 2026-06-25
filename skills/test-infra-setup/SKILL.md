---
name: test-infra-setup
description: Use before spec-to-tests, or whenever a target project might be missing a test framework or mutation-testing setup. Detects and installs both, and makes sure mutation testing runs as a scheduled CI job instead of per-commit. Idempotent — skips anything already present.
---

# Test Infrastructure Setup

`spec-to-tests` only produces something meaningful if the project can run tests, and "tests pass" only proves something if a weak test (e.g. `expect(result).toBeDefined()`) would actually fail under mutation. This skill makes sure both exist before any REQ-to-test generation happens.

## Step 1: Detect or install a test framework

Check for an existing test framework using whatever signal matches the project's ecosystem (not exhaustive — use judgment for ecosystems not listed):

- Node/TS: `devDependencies` in `package.json` for `vitest`, `jest`, `mocha`, `node:test` usage.
- Python: `pytest`/`unittest` in `pyproject.toml`, `requirements*.txt`, or existing `test_*.py` files.
- Go: built-in `testing` package — Go projects almost always already have this; just confirm `*_test.go` files exist or can.
- Rust: built-in `cargo test` — confirm a `tests/` dir or `#[test]` usage is possible.
- Java/Kotlin: JUnit in `pom.xml`/`build.gradle`.

If found: skip to Step 2.

If missing: install the ecosystem-idiomatic minimal default (e.g. `vitest` for a bare JS/TS project, `pytest` for a bare Python project) and write one trivial smoke test to confirm the runner actually executes (e.g. `assert 1 + 1 == 2`). Run it and confirm it passes before moving on.

## Step 2: Detect or install a mutation-testing tool

Mutation testing deliberately introduces small bugs ("mutants") into the code and checks whether the test suite catches them. This is the only reliable signal that tests are actually asserting something, as opposed to merely existing.

- Node/TS: Stryker (`@stryker-mutator/core`).
- Python: `mutmut` or `cosmic-ray`.
- Rust: `cargo-mutants`.
- Go: `go-mutesting`.
- Java: PIT (`pitest`).

If found (config file or dependency already present): skip to Step 3.

If missing: install it with a minimal config targeting the project's source directory, and confirm it runs at least once locally (`--dry-run` or equivalent if available, to avoid a slow full run during setup).

## Step 3: Wire mutation testing into a scheduled CI job — never per-commit

Mutation testing is expensive (it reruns the suite once per mutant). It must never run synchronously on every push or PR.

- If CI config already exists (e.g. `.github/workflows/*.yml`) and already has a scheduled (`schedule:` / `cron`) job running mutation testing: skip.
- If CI config exists but has no scheduled mutation job: add a new workflow file with a `schedule: cron` trigger (weekly is a reasonable default absent other signal) that runs only the mutation-testing command. Leave existing per-push/per-PR jobs untouched — they should keep running the regular (fast) test suite only.
- If no CI config exists at all: create a minimal one with two jobs — a per-push job running the test suite, and a scheduled job running mutation testing.

## Step 4: Report

Summarize what was detected vs. installed (test framework, mutation tool, CI scheduling) so the user can review the diff before it's committed alongside actual feature work.

# sd-tdd Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `sd-tdd` Claude Code plugin: four skills (`test-infra-setup`, `spec-interview`, `spec-to-tests`, `coverage-check`) that turn a vague feature request into a REQ-traceable, machine-verified failing test suite, then hand off to `superpowers:test-driven-development` for implementation.

**Architecture:** A persistent "spec document" is never created. `spec-interview` writes a numbered, append-only REQ ledger into the GitHub issue body. `spec-to-tests` generates failing tests whose names embed an `issue-N_REQ-XX` compound key. `coverage-check` is a deterministic Node.js script (no LLM judgment) that greps test files for that key and diffs it against the ledger. `test-infra-setup` is a precondition skill ensuring a test framework and a scheduled (CI, not per-commit) mutation-testing job exist before any of this is useful.

**Tech Stack:** Claude Code plugin format (`.claude-plugin/plugin.json`, `skills/<name>/SKILL.md`), Node.js built-in test runner (`node:test`, `node:assert/strict`) for the one deterministic component, `gh` CLI for issue read/write.

## Global Constraints

- No persisted spec document is ever created — the issue's REQ ledger and the tests are the only two artifacts (see design doc `docs/superpowers/specs/2026-06-25-sd-tdd-plugin-design.md`).
- REQ-IDs are issue-local (each issue starts at REQ-1). Every test name and every coverage check uses the compound key `issue-<issueNumber>_REQ-<reqId>` to stay unique across issues.
- The REQ ledger is append-only: existing `REQ-N: ...` lines are never rewritten. Corrections/conflicts are recorded as a new REQ entry plus a `[superseded by REQ-M]` annotation on the old line. Tests, unlike the ledger, may be freely edited or deleted.
- `coverage-check`'s pass/fail logic must be mechanical (regex/diff), never delegated to LLM judgment.
- Mutation testing must run on a scheduled CI job, never synchronously per commit.
- `plugin.json` declares a dependency on `superpowers` (`^6.0.0`); the implementation phase itself is out of scope for this plugin and is handed off to `superpowers:test-driven-development`.

---

## File Structure

```
sd-tdd/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── coverage-check/
│   │   └── SKILL.md
│   ├── test-infra-setup/
│   │   └── SKILL.md
│   ├── spec-interview/
│   │   └── SKILL.md
│   └── spec-to-tests/
│       └── SKILL.md
├── scripts/
│   └── coverage-check/
│       ├── parse.js          # parse the REQ ledger out of an issue body
│       ├── parse.test.js
│       ├── coverage.js        # diff covered REQ-IDs against the ledger
│       ├── coverage.test.js
│       ├── files.js           # recursively read test file contents
│       ├── files.test.js
│       ├── cli.js              # wires gh + the above into a command
│       └── cli.test.js
└── package.json
```

Each skill gets one file with one responsibility. The only code with real unit tests is `scripts/coverage-check/*`, because that is the one piece the design explicitly requires to be mechanical rather than LLM-judgment-driven. The four `SKILL.md` files are prompt content for the LLM-judgment-driven phases (interviewing, detecting conventions, generating tests, setting up tooling) — their "test cycle" is a scripted manual walkthrough against a toy fixture, done in Task 8.

---

### Task 1: Scaffold the plugin manifest

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `package.json`

**Interfaces:**
- Produces: a loadable plugin named `sd-tdd` with a declared dependency on `superpowers`.

- [ ] **Step 1: Write the plugin manifest**

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "sd-tdd",
  "version": "0.1.0",
  "description": "Spec-driven TDD: tighten requirements into a testable REQ ledger, generate REQ-traceable failing tests, verify coverage, then hand off to superpowers TDD for implementation.",
  "dependencies": [
    { "name": "superpowers", "version": "^6.0.0" }
  ]
}
```

- [ ] **Step 2: Write a minimal package.json for the bundled scripts**

```json
{
  "name": "sd-tdd",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test:coverage-check": "node --test scripts/coverage-check/"
  }
}
```

- [ ] **Step 3: Validate the manifest**

Run: `claude plugin validate . --strict`
Expected: passes with no errors (skills/ is empty at this point, which is fine).

- [ ] **Step 4: Commit**

```bash
git add .claude-plugin/plugin.json package.json
git commit -m "Scaffold sd-tdd plugin manifest"
```

---

### Task 2: REQ ledger parsing and coverage diffing (core logic)

**Files:**
- Create: `scripts/coverage-check/parse.js`
- Create: `scripts/coverage-check/parse.test.js`
- Create: `scripts/coverage-check/coverage.js`
- Create: `scripts/coverage-check/coverage.test.js`

**Interfaces:**
- Produces: `parseRequirements(issueBody) -> Array<{ id: number, supersededBy: number|null }>`
- Produces: `findCoveredReqIds(testFileContents: string[], issueNumber: number) -> Set<number>`
- Produces: `computeCoverage(requirements, coveredIds) -> { missing: number[], orphans: number[] }`

- [ ] **Step 1: Write the failing tests for `parseRequirements`**

```js
// scripts/coverage-check/parse.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRequirements } = require('./parse');

test('returns empty array when there are no REQ lines', () => {
  assert.deepEqual(parseRequirements('just a description, no requirements'), []);
});

test('parses plain REQ lines as not superseded', () => {
  const body = [
    'REQ-1: ユーザーが空文字を送信したら400を返す',
    'REQ-2: リトライは3回まで',
  ].join('\n');
  assert.deepEqual(parseRequirements(body), [
    { id: 1, supersededBy: null },
    { id: 2, supersededBy: null },
  ]);
});

test('extracts supersededBy from a superseded annotation', () => {
  const body = [
    'REQ-3: リトライは3回まで [superseded by REQ-12]',
    'REQ-12: リトライは5回まで — vendor APIの上限が5回だったため',
  ].join('\n');
  assert.deepEqual(parseRequirements(body), [
    { id: 3, supersededBy: 12 },
    { id: 12, supersededBy: null },
  ]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/coverage-check/parse.test.js`
Expected: FAIL — `Cannot find module './parse'`

- [ ] **Step 3: Implement `parse.js`**

```js
// scripts/coverage-check/parse.js
const REQ_LINE_RE = /^REQ-(\d+):\s*(.+)$/gm;
const SUPERSEDED_RE = /\[superseded by REQ-(\d+)\]/i;

function parseRequirements(issueBody) {
  const requirements = [];
  let match;
  REQ_LINE_RE.lastIndex = 0;
  while ((match = REQ_LINE_RE.exec(issueBody)) !== null) {
    const id = Number(match[1]);
    const rest = match[2];
    const supersededMatch = rest.match(SUPERSEDED_RE);
    requirements.push({
      id,
      supersededBy: supersededMatch ? Number(supersededMatch[1]) : null,
    });
  }
  return requirements;
}

module.exports = { parseRequirements };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test scripts/coverage-check/parse.test.js`
Expected: PASS (3/3)

- [ ] **Step 5: Write the failing tests for `findCoveredReqIds` and `computeCoverage`**

```js
// scripts/coverage-check/coverage.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { findCoveredReqIds, computeCoverage } = require('./coverage');

test('findCoveredReqIds extracts REQ ids scoped to the given issue number', () => {
  const files = [
    'it("issue-12_REQ-3_空文字を送信したら400を返す", () => {});',
    'it("issue-12_REQ-5_nullのとき400を返す", () => {});',
    'it("issue-7_REQ-3_別issueの同名REQ", () => {});',
  ];
  assert.deepEqual(findCoveredReqIds(files, 12), new Set([3, 5]));
});

test('computeCoverage flags an active requirement with no test', () => {
  const requirements = [
    { id: 1, supersededBy: null },
    { id: 2, supersededBy: null },
  ];
  const covered = new Set([1]);
  assert.deepEqual(computeCoverage(requirements, covered), {
    missing: [2],
    orphans: [],
  });
});

test('computeCoverage does not require a test for a superseded requirement', () => {
  const requirements = [
    { id: 3, supersededBy: 12 },
    { id: 12, supersededBy: null },
  ];
  const covered = new Set([12]);
  assert.deepEqual(computeCoverage(requirements, covered), {
    missing: [],
    orphans: [],
  });
});

test('computeCoverage flags a covered id with no matching requirement at all', () => {
  const requirements = [{ id: 1, supersededBy: null }];
  const covered = new Set([1, 99]);
  assert.deepEqual(computeCoverage(requirements, covered), {
    missing: [],
    orphans: [99],
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `node --test scripts/coverage-check/coverage.test.js`
Expected: FAIL — `Cannot find module './coverage'`

- [ ] **Step 7: Implement `coverage.js`**

```js
// scripts/coverage-check/coverage.js
function findCoveredReqIds(testFileContents, issueNumber) {
  const re = new RegExp(`issue-${issueNumber}_REQ-(\\d+)`, 'g');
  const covered = new Set();
  for (const content of testFileContents) {
    let match;
    re.lastIndex = 0;
    while ((match = re.exec(content)) !== null) {
      covered.add(Number(match[1]));
    }
  }
  return covered;
}

function computeCoverage(requirements, coveredIds) {
  const activeIds = requirements
    .filter((r) => r.supersededBy === null)
    .map((r) => r.id);
  const allDeclaredIds = new Set(requirements.map((r) => r.id));

  const missing = activeIds.filter((id) => !coveredIds.has(id)).sort((a, b) => a - b);
  const orphans = [...coveredIds]
    .filter((id) => !allDeclaredIds.has(id))
    .sort((a, b) => a - b);

  return { missing, orphans };
}

module.exports = { findCoveredReqIds, computeCoverage };
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test scripts/coverage-check/coverage.test.js`
Expected: PASS (4/4)

- [ ] **Step 9: Commit**

```bash
git add scripts/coverage-check/parse.js scripts/coverage-check/parse.test.js scripts/coverage-check/coverage.js scripts/coverage-check/coverage.test.js
git commit -m "Add REQ ledger parsing and coverage diffing logic"
```

---

### Task 3: Test-file reading and the CLI wrapper

**Files:**
- Create: `scripts/coverage-check/files.js`
- Create: `scripts/coverage-check/files.test.js`
- Create: `scripts/coverage-check/cli.js`
- Create: `scripts/coverage-check/cli.test.js`

**Interfaces:**
- Consumes: `parseRequirements` and `{ findCoveredReqIds, computeCoverage }` from Task 2.
- Produces: `collectTestFileContents(dir: string) -> string[]`
- Produces: `parseArgs(argv: string[]) -> { issue: number, tests: string }`
- Produces: a runnable CLI at `scripts/coverage-check/cli.js --issue <N> --tests <dir>`, exit code `1` when any REQ is missing a test, `0` otherwise.

- [ ] **Step 1: Write the failing test for `collectTestFileContents`**

```js
// scripts/coverage-check/files.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectTestFileContents } = require('./files');

test('collects file contents recursively from a directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-check-'));
  fs.writeFileSync(path.join(dir, 'a.test.js'), 'it("issue-1_REQ-1_a", () => {});');
  fs.mkdirSync(path.join(dir, 'nested'));
  fs.writeFileSync(path.join(dir, 'nested', 'b.test.js'), 'it("issue-1_REQ-2_b", () => {});');

  const contents = collectTestFileContents(dir).sort();

  assert.deepEqual(contents, [
    'it("issue-1_REQ-1_a", () => {});',
    'it("issue-1_REQ-2_b", () => {});',
  ]);

  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/coverage-check/files.test.js`
Expected: FAIL — `Cannot find module './files'`

- [ ] **Step 3: Implement `files.js`**

```js
// scripts/coverage-check/files.js
const fs = require('node:fs');
const path = require('node:path');

function collectTestFileContents(dir) {
  const contents = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      contents.push(...collectTestFileContents(fullPath));
    } else if (entry.isFile()) {
      contents.push(fs.readFileSync(fullPath, 'utf8'));
    }
  }
  return contents;
}

module.exports = { collectTestFileContents };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/coverage-check/files.test.js`
Expected: PASS (1/1)

- [ ] **Step 5: Write the failing tests for `parseArgs`**

```js
// scripts/coverage-check/cli.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('./cli');

test('parses --issue and --tests flags', () => {
  assert.deepEqual(parseArgs(['--issue', '12', '--tests', './tests']), {
    issue: 12,
    tests: './tests',
  });
});

test('throws when required flags are missing', () => {
  assert.throws(() => parseArgs(['--issue', '12']), /Usage: coverage-check/);
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `node --test scripts/coverage-check/cli.test.js`
Expected: FAIL — `Cannot find module './cli'`

- [ ] **Step 7: Implement `cli.js`**

```js
#!/usr/bin/env node
// scripts/coverage-check/cli.js
const { execFileSync } = require('node:child_process');
const { parseRequirements } = require('./parse');
const { findCoveredReqIds, computeCoverage } = require('./coverage');
const { collectTestFileContents } = require('./files');

function parseArgs(argv) {
  const args = { issue: null, tests: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--issue') args.issue = Number(argv[i + 1]);
    if (argv[i] === '--tests') args.tests = argv[i + 1];
  }
  if (!args.issue || !args.tests) {
    throw new Error('Usage: coverage-check --issue <N> --tests <dir>');
  }
  return args;
}

function fetchIssueBody(issueNumber) {
  return execFileSync(
    'gh',
    ['issue', 'view', String(issueNumber), '--json', 'body', '-q', '.body'],
    { encoding: 'utf8' },
  );
}

function main(argv) {
  const { issue, tests } = parseArgs(argv);
  const body = fetchIssueBody(issue);
  const requirements = parseRequirements(body);
  const testContents = collectTestFileContents(tests);
  const covered = findCoveredReqIds(testContents, issue);
  const { missing, orphans } = computeCoverage(requirements, covered);

  if (missing.length > 0) {
    console.error(`Missing tests for: ${missing.map((id) => `REQ-${id}`).join(', ')}`);
  }
  if (orphans.length > 0) {
    console.warn(`Tests reference REQ-IDs not in the issue ledger: ${orphans.map((id) => `REQ-${id}`).join(', ')}`);
  }
  if (missing.length === 0 && orphans.length === 0) {
    console.log(`Coverage OK for issue #${issue}: all active requirements have at least one test.`);
  }

  process.exitCode = missing.length > 0 ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { parseArgs, main };
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `node --test scripts/coverage-check/cli.test.js`
Expected: PASS (2/2)

- [ ] **Step 9: Run the whole coverage-check test suite**

Run: `npm run test:coverage-check`
Expected: all 9 tests across `parse.test.js`, `coverage.test.js`, `files.test.js`, `cli.test.js` PASS

- [ ] **Step 10: Commit**

```bash
git add scripts/coverage-check/files.js scripts/coverage-check/files.test.js scripts/coverage-check/cli.js scripts/coverage-check/cli.test.js
git commit -m "Add test-file scanning and the coverage-check CLI"
```

---

### Task 4: `coverage-check` skill

**Files:**
- Create: `skills/coverage-check/SKILL.md`

**Interfaces:**
- Consumes: `scripts/coverage-check/cli.js` from Task 3.
- Produces: skill `coverage-check`, invocable by name or auto-triggered per its description.

- [ ] **Step 1: Write the skill**

```markdown
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
```

- [ ] **Step 2: Validate the plugin still loads correctly**

Run: `claude plugin validate . --strict`
Expected: passes; `coverage-check` listed under skills.

- [ ] **Step 3: Commit**

```bash
git add skills/coverage-check/SKILL.md
git commit -m "Add coverage-check skill"
```

---

### Task 5: `test-infra-setup` skill

**Files:**
- Create: `skills/test-infra-setup/SKILL.md`

**Interfaces:**
- Produces: skill `test-infra-setup`, the precondition `spec-to-tests` (Task 7) refers to.

- [ ] **Step 1: Write the skill**

```markdown
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
```

- [ ] **Step 2: Validate the plugin still loads correctly**

Run: `claude plugin validate . --strict`
Expected: passes; `test-infra-setup` listed under skills.

- [ ] **Step 3: Commit**

```bash
git add skills/test-infra-setup/SKILL.md
git commit -m "Add test-infra-setup skill"
```

---

### Task 6: `spec-interview` skill

**Files:**
- Create: `skills/spec-interview/SKILL.md`

**Interfaces:**
- Produces: skill `spec-interview`. Output format consumed by `spec-to-tests` (Task 7) and `coverage-check` (Task 4): a GitHub issue body containing `REQ-<n>: <falsifiable statement>` lines, optionally annotated `[superseded by REQ-<m>]`.

- [ ] **Step 1: Write the skill**

```markdown
---
name: spec-interview
description: Use when a feature or bug request has no structured, testable requirements yet — before any test or code is written. Interviews the user one question at a time and converts a vague request into a numbered, falsifiable REQ ledger recorded on a GitHub issue. Also use to append newly discovered requirements to an existing ledger during implementation.
---

# Spec Interview

Converts a vague request into a REQ ledger — the only record of "what we believed, when." No separate spec document is ever created; this ledger plus the tests it produces (via `spec-to-tests`) are the whole spec.

## Step 1: Check for an existing ledger

```bash
gh issue view <N> --json body -q .body
```

If the issue already has `REQ-` lines, this is an **append session**: new items become `REQ-<max+1>`, `REQ-<max+2>`, ... Existing lines are never rewritten. If you're correcting or replacing an old REQ, append a new one and add `[superseded by REQ-<new id>]` to the old line — don't edit its original text otherwise.

If there's no existing issue, this is a fresh interview; the ledger starts at `REQ-1`.

## Step 2: Interview one question at a time

- Ask one question per message. Prefer multiple choice.
- Each REQ must be a single falsifiable fact — one behavior, one expected outcome. Split anything joined by "and"/"or" into separate REQs.
- Push back on vagueness. "Handle errors gracefully" is not a REQ. "If the input is empty, return a 400 with message X" is.
- Keep asking until you can write the whole feature as a list of REQ lines with no ambiguity left.

## Step 3: Decide where the "why" goes

Default: leave rationale for the test code (`spec-to-tests` will embed it as a comment or in the test name). Only write the rationale directly into a REQ line when at least one of these holds:

1. It requires explaining an alternative that was considered and rejected.
2. It depends on context the code can't reveal (a stakeholder ask, a compliance rule, a specific past incident).
3. It can't be stated in one sentence.

## Step 4: Write the ledger to the issue

```bash
gh issue create --title "<feature title>" --body "$(cat <<'EOF'
## Requirements

REQ-1: ユーザーが空文字を送信したら400を返す
REQ-2: リトライは3回まで — vendor APIのレート制限による
EOF
)"
```

For an append session, use `gh issue edit <N> --body "$(cat <<'EOF' ... EOF)"` with the full existing body plus the new REQ lines appended at the end — never with old lines removed or reworded.

## Step 5: Get explicit approval

Show the user the final REQ list before handing off. Once approved, tell them: "REQ ledger written to issue #<N>. Next: run `test-infra-setup` (if not already done for this project) and then `spec-to-tests`."
```

- [ ] **Step 2: Validate the plugin still loads correctly**

Run: `claude plugin validate . --strict`
Expected: passes; `spec-interview` listed under skills.

- [ ] **Step 3: Commit**

```bash
git add skills/spec-interview/SKILL.md
git commit -m "Add spec-interview skill"
```

---

### Task 7: `spec-to-tests` skill

**Files:**
- Create: `skills/spec-to-tests/SKILL.md`

**Interfaces:**
- Consumes: the REQ ledger format from Task 6, the precondition from Task 5 (`test-infra-setup`).
- Produces: failing tests named with the `issue-<N>_REQ-<id>_<description>` compound key, which Task 4's `coverage-check` reads.

- [ ] **Step 1: Write the skill**

```markdown
---
name: spec-to-tests
description: Use after spec-interview has written a REQ ledger to an issue — generates one or more failing tests per active REQ-ID, named with an issue-N_REQ-XX compound key for traceability. Requires a test framework to already exist (see test-infra-setup).
---

# Spec to Tests

Turns each REQ-ID in an issue's ledger into a failing test. The test name *is* the traceability link back to the ledger — there is no separate mapping file to maintain.

## Step 0: Confirm test infrastructure exists

If the project has no detectable test framework, stop and say so — invoke `test-infra-setup` first. Don't generate tests into a project that can't run them.

## Step 1: Read the ledger

```bash
gh issue view <N> --json body -q .body
```

Parse the `REQ-<id>: ...` lines. Skip any line annotated `[superseded by REQ-<m>]` — only active (non-superseded) REQs need a test.

## Step 2: Detect the project's test conventions

Look at existing test files (naming, assertion style, `describe`/`it` vs. bare `test`, fixture setup patterns) and match them. Don't introduce a second test style into a project that already has one.

## Step 3: Generate one test per REQ-ID, named with the compound key

```ts
it("issue-12_REQ-3_空文字を送信したら400を返す", () => {
  // ...
});
```

A REQ may need more than one test (happy path, edge cases) — give each the same `issue-N_REQ-XX` prefix; `coverage-check` only requires at least one match per REQ-ID, not exactly one.

## Step 4: Decide where the "why" goes, per test

If the reason a REQ holds is a single sentence derivable from the code/domain itself, put it in the test name or a one-line comment. If it needs the longer treatment (alternatives considered, external context, multi-sentence) it belongs on the ledger, not here — if it isn't already on the ledger, invoke `spec-interview` to append it, then add a short pointer comment in the test (e.g. `// see issue #12`).

## Step 5: Discovered a case the ledger doesn't mention?

Don't silently add a test for it. Invoke `spec-interview` to append a new REQ first (this is what keeps the ledger honest), then write the test against the new REQ-ID.

## Step 6: Confirm red for the right reason

Run the new tests once before handing off:

```bash
<project's test command> <new test files>
```

Expected: every new test FAILS with an assertion/not-implemented error — not a syntax error, import error, or setup crash. If it's failing for the wrong reason, fix the test itself before moving on.

## Step 7: Hand off

Invoke `coverage-check` to mechanically verify every active REQ now has a test before implementation starts.
```

- [ ] **Step 2: Validate the plugin still loads correctly**

Run: `claude plugin validate . --strict`
Expected: passes; `spec-to-tests` listed under skills.

- [ ] **Step 3: Commit**

```bash
git add skills/spec-to-tests/SKILL.md
git commit -m "Add spec-to-tests skill"
```

---

### Task 8: End-to-end smoke test against a toy fixture

**Files:**
- None created — this task is a manual verification pass using a throwaway fixture outside the repo (e.g. `/tmp/sd-tdd-smoke`).

**Interfaces:**
- Consumes: all four skills (Tasks 4-7) and the CLI (Task 3).

- [ ] **Step 1: Load the plugin locally**

Run: `claude --plugin-dir D:/Projects/sd-tdd`
Expected: starts without error; `/plugin` (or `claude plugin list` in another shell) shows `sd-tdd` with 4 skills.

- [ ] **Step 2: Create a throwaway fixture project with a real GitHub issue**

Create a scratch repo with a trivial function to build (e.g. a string validator), push it somewhere `gh` can target, or use an existing personal scratch repo. Run `spec-interview` against a small made-up feature request and answer its questions; confirm it writes a `REQ-1`, `REQ-2`, ... ledger to a real issue via `gh issue view <N>`.

- [ ] **Step 3: Run test-infra-setup against the fixture**

Confirm it correctly detects (or installs, if the fixture starts with nothing) a test framework and reports its mutation-testing/CI decisions without performing a synchronous mutation run.

- [ ] **Step 4: Run spec-to-tests**

Confirm the generated tests use the `issue-<N>_REQ-<id>_...` naming convention, and that running them fails for the expected reason (not implemented yet).

- [ ] **Step 5: Run coverage-check and verify it catches a deliberately introduced gap**

Delete one generated test, run:

```bash
node /path/to/sd-tdd/scripts/coverage-check/cli.js --issue <N> --tests <fixture-tests-dir>
```

Expected: exit code `1`, "Missing tests for: REQ-X" naming exactly the REQ whose test was deleted. Restore the test, re-run, expect exit `0`.

- [ ] **Step 6: Verify an orphan is caught**

Add a test named `issue-<N>_REQ-999_...` (a REQ-ID that doesn't exist in the ledger), re-run `coverage-check`. Expected: exit `0` but a warning naming `REQ-999` as an orphan. Remove the test afterward.

- [ ] **Step 7: Record the result**

If all five checks in Steps 2-6 behaved as expected, the plugin is ready for real use. No code changes are expected from this task — it's a confirmation pass. If anything diverged, file it as a follow-up task before considering the plan done.

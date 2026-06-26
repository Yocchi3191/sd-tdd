#!/usr/bin/env node
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

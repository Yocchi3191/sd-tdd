#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { parseRequirements, parsePrGroups } = require('./parse');
const { findCoveredReqIds, computeCoverage } = require('./coverage');
const { collectTestFileContents } = require('./files');

function parseArgs(argv) {
  const args = { issue: null, tests: null, group: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--issue') args.issue = Number(argv[i + 1]);
    if (argv[i] === '--tests') args.tests = argv[i + 1];
    if (argv[i] === '--group') args.group = Number(argv[i + 1]);
  }
  if (!args.issue || !args.tests) {
    throw new Error('Usage: coverage-check --issue <N> --tests <dir> [--group <N>]');
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

function resolveTargetIds(body, issue, group) {
  if (group === null) return null;
  const groups = parsePrGroups(body);
  const target = groups.find((g) => g.groupNumber === group);
  if (!target) {
    throw new Error(`PR group ${group} not found in issue #${issue}'s "## PRグループ" section`);
  }
  return target.reqIds;
}

function main(argv) {
  const { issue, tests, group } = parseArgs(argv);
  const body = fetchIssueBody(issue);
  const requirements = parseRequirements(body);
  const testContents = collectTestFileContents(tests);
  const covered = findCoveredReqIds(testContents, issue);
  const targetIds = resolveTargetIds(body, issue, group);
  const { missing, orphans } = computeCoverage(requirements, covered, targetIds);

  if (missing.length > 0) {
    console.error(`Missing tests for: ${missing.map((id) => `REQ-${id}`).join(', ')}`);
  }
  if (orphans.length > 0) {
    console.warn(`Tests reference REQ-IDs not in the issue ledger: ${orphans.map((id) => `REQ-${id}`).join(', ')}`);
  }
  if (missing.length === 0 && orphans.length === 0) {
    const scope = group !== null ? `group ${group} of ` : '';
    console.log(`Coverage OK for ${scope}issue #${issue}: all active requirements have at least one test.`);
  }

  process.exitCode = missing.length > 0 ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { parseArgs, main };

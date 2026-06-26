// plugins/sd-tdd/scripts/coverage-check/coverage.test.js
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

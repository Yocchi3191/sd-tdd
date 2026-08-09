// plugins/sd-tdd/scripts/review-guard/compare.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { compareSnapshots } = require('./compare');

function baseSnapshot() {
  return {
    headSha: 'abc123',
    statusPorcelain: '',
    remoteRef: { exists: true, sha: 'def456' },
  };
}

test('issue-50_REQ-3_compareSnapshots reports no violation when all three fields are unchanged', () => {
  const before = baseSnapshot();
  const after = baseSnapshot();
  assert.deepEqual(compareSnapshots(before, after), { violated: false, reasons: [] });
});

test('issue-50_REQ-3_compareSnapshots detects violation when HEAD SHA changed', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), headSha: 'zzz999' };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_compareSnapshots detects violation when working tree status changed', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), statusPorcelain: ' M SKILL.md' };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_compareSnapshots detects violation when remote tracking branch SHA changed', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), remoteRef: { exists: true, sha: 'newsha000' } };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_compareSnapshots detects violation when remote tracking branch newly appeared', () => {
  const before = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const after = baseSnapshot();
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_compareSnapshots detects violation when remote tracking branch disappeared', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_compareSnapshots reports one reason per changed dimension when multiple fields change', () => {
  const before = baseSnapshot();
  const after = {
    headSha: 'zzz999',
    statusPorcelain: ' M SKILL.md',
    remoteRef: { exists: true, sha: 'newsha000' },
  };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 3);
});

test('issue-50_REQ-3_compareSnapshots reports no violation when remote ref absent both before and after', () => {
  const before = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const after = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  assert.deepEqual(compareSnapshots(before, after), { violated: false, reasons: [] });
});

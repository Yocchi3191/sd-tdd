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

test('issue-50_REQ-3_3項目すべてが変化していない場合、compareSnapshotsは違反なしと報告する', () => {
  const before = baseSnapshot();
  const after = baseSnapshot();
  assert.deepEqual(compareSnapshots(before, after), { violated: false, reasons: [] });
});

test('issue-50_REQ-3_HEAD SHAが変化した場合、compareSnapshotsは違反を検出する', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), headSha: 'zzz999' };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
  assert.match(result.reasons[0], /HEAD SHA changed: abc123 -> zzz999/);
});

test('issue-50_REQ-3_作業ツリーの状態が変化した場合、compareSnapshotsは違反を検出する', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), statusPorcelain: ' M SKILL.md' };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
  assert.match(result.reasons[0], /working tree\/index state changed/);
});

test('issue-50_REQ-3_リモート追跡ブランチのSHAが変化した場合、compareSnapshotsは違反を検出する', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), remoteRef: { exists: true, sha: 'newsha000' } };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
  assert.match(result.reasons[0], /remote tracking branch SHA changed: def456 -> newsha000/);
});

test('issue-50_REQ-3_リモート追跡ブランチが新たに出現した場合、compareSnapshotsは違反を検出する', () => {
  const before = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const after = baseSnapshot();
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
  assert.match(result.reasons[0], /remote tracking branch existence changed: false -> true/);
});

test('issue-50_REQ-3_リモート追跡ブランチが消失した場合、compareSnapshotsは違反を検出する', () => {
  const before = baseSnapshot();
  const after = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const result = compareSnapshots(before, after);
  assert.equal(result.violated, true);
  assert.equal(result.reasons.length, 1);
});

test('issue-50_REQ-3_複数フィールドが変化した場合、compareSnapshotsは変化した項目ごとに理由を1つ報告する', () => {
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

test('issue-50_REQ-3_リモート参照が前後とも不在の場合、compareSnapshotsは違反なしと報告する', () => {
  const before = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  const after = { ...baseSnapshot(), remoteRef: { exists: false, sha: null } };
  assert.deepEqual(compareSnapshots(before, after), { violated: false, reasons: [] });
});

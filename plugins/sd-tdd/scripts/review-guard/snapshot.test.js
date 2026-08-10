// plugins/sd-tdd/scripts/review-guard/snapshot.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { captureSnapshot } = require('./snapshot');
const { compareSnapshots } = require('./compare');

test('issue-50_REQ-1_captureSnapshotはHEAD SHA・status porcelainの出力・存在するリモート参照のSHAを返す', () => {
  const fakeGit = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123\n';
    if (args[0] === 'status') return ' M SKILL.md\n';
    if (args[0] === 'rev-parse' && args[3] === 'origin/feature-x') return 'def456\n';
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  const snapshot = captureSnapshot('feature-x', { git: fakeGit });
  assert.deepEqual(snapshot, {
    headSha: 'abc123',
    statusPorcelain: ' M SKILL.md',
    remoteRef: { exists: true, sha: 'def456' },
  });
});

test('issue-50_REQ-1_git rev-parse --verify -qがstderr無しでexit 1した場合、captureSnapshotはリモート参照を存在しないとマークする', () => {
  const fakeGit = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123\n';
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[3] === 'origin/no-upstream') {
      const error = new Error('Command failed');
      error.status = 1;
      error.stderr = '';
      throw error;
    }
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  const snapshot = captureSnapshot('no-upstream', { git: fakeGit });
  assert.deepEqual(snapshot, {
    headSha: 'abc123',
    statusPorcelain: '',
    remoteRef: { exists: false, sha: null },
  });
});

test('issue-50_REQ-1_captureSnapshotはリモート参照検索での予期しないエラーを、不在として隠蔽せず再送出する', () => {
  const fakeGit = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123\n';
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[3] === 'origin/feature-x') {
      const error = new Error('fatal: unable to access repository: permission denied');
      error.status = 128;
      error.stderr = error.message;
      throw error;
    }
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  assert.throws(() => captureSnapshot('feature-x', { git: fakeGit }), /permission denied/);
});

test('issue-50_REQ-1_stderrが空でないstatus-1の失敗（「参照不在」のシグネチャではない）の場合も、captureSnapshotは再送出する', () => {
  const fakeGit = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123\n';
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[3] === 'origin/feature-x') {
      const error = new Error('fatal: something unexpected happened');
      error.status = 1;
      error.stderr = error.message;
      throw error;
    }
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  assert.throws(() => captureSnapshot('feature-x', { git: fakeGit }), /something unexpected happened/);
});

test('issue-50_REQ-2_同じリポジトリ状態を2回キャプチャすると、比較結果は違反なしになる', () => {
  const fakeGit = (args) => {
    if (args[0] === 'rev-parse' && args[1] === 'HEAD') return 'abc123\n';
    if (args[0] === 'status') return '';
    if (args[0] === 'rev-parse' && args[3] === 'origin/feature-x') return 'def456\n';
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
  const before = captureSnapshot('feature-x', { git: fakeGit });
  const after = captureSnapshot('feature-x', { git: fakeGit });
  assert.deepEqual(compareSnapshots(before, after), { violated: false, reasons: [] });
});

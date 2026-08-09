// plugins/sd-tdd/scripts/review-guard/snapshot.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { captureSnapshot } = require('./snapshot');
const { compareSnapshots } = require('./compare');

test('issue-50_REQ-1_captureSnapshot returns HEAD SHA, status porcelain output, and existing remote ref SHA', () => {
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

test('issue-50_REQ-1_captureSnapshot marks remote ref as not existing when git rev-parse --verify -q exits 1 with no stderr', () => {
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

test('issue-50_REQ-1_captureSnapshot rethrows an unexpected error from the remote ref lookup instead of masking it as absent', () => {
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

test('issue-50_REQ-1_captureSnapshot rethrows even a status-1 failure if stderr is non-empty (not the "ref absent" signature)', () => {
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

test('issue-50_REQ-2_capturing the same repository state twice yields snapshots that compare as no violation', () => {
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

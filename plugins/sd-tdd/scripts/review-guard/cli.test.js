// plugins/sd-tdd/scripts/review-guard/cli.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, main } = require('./cli');

test('--branchフラグ付きのsnapshotサブコマンドをパースする', () => {
  assert.deepEqual(parseArgs(['snapshot', '--branch', 'feature-x']), {
    command: 'snapshot',
    branch: 'feature-x',
  });
});

test('--beforeと--afterフラグ付きのcompareサブコマンドをパースする', () => {
  assert.deepEqual(parseArgs(['compare', '--before', 'a.json', '--after', 'b.json']), {
    command: 'compare',
    before: 'a.json',
    after: 'b.json',
  });
});

test('snapshotサブコマンドに--branchが無い場合は例外を投げる', () => {
  assert.throws(() => parseArgs(['snapshot']), /Usage: review-guard snapshot/);
});

test('compareサブコマンドに--beforeまたは--afterが無い場合は例外を投げる', () => {
  assert.throws(() => parseArgs(['compare', '--before', 'a.json']), /Usage: review-guard compare/);
});

test('サブコマンドが指定されない場合は例外を投げる', () => {
  assert.throws(() => parseArgs([]), /Usage: review-guard <snapshot\|compare>/);
});

test('未知のサブコマンドが指定された場合は例外を投げる', () => {
  assert.throws(() => parseArgs(['bogus']), /Usage: review-guard <snapshot\|compare>/);
});

test('mainのsnapshotサブコマンドは注入されたbranchでキャプチャし、JSONスナップショットをログ出力する', () => {
  const logged = [];
  const fakeSnapshot = { headSha: 'abc', statusPorcelain: '', remoteRef: { exists: true, sha: 'def' } };
  let capturedBranch = null;
  main(['snapshot', '--branch', 'feature-x'], {
    captureSnapshot: (branch) => {
      capturedBranch = branch;
      return fakeSnapshot;
    },
    log: (line) => logged.push(line),
  });
  assert.equal(capturedBranch, 'feature-x');
  assert.deepEqual(JSON.parse(logged[0]), fakeSnapshot);
});

test('mainのcompareサブコマンドは両ファイルを読み込み、比較し、JSON結果をログ出力する', () => {
  const originalExitCode = process.exitCode;
  try {
    const logged = [];
    const files = {
      'before.json': JSON.stringify({ headSha: 'a', statusPorcelain: '', remoteRef: { exists: false, sha: null } }),
      'after.json': JSON.stringify({ headSha: 'b', statusPorcelain: '', remoteRef: { exists: false, sha: null } }),
    };
    main(['compare', '--before', 'before.json', '--after', 'after.json'], {
      readFile: (path) => files[path],
      compareSnapshots: (before, after) => ({
        violated: true,
        reasons: [`head changed ${before.headSha}->${after.headSha}`],
      }),
      log: (line) => logged.push(line),
    });
    assert.deepEqual(JSON.parse(logged[0]), {
      violated: true,
      reasons: ['head changed a->b'],
    });
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('compareSnapshotsが違反なしと報告した場合、mainのcompareサブコマンドはexitCodeを0にする', () => {
  const originalExitCode = process.exitCode;
  try {
    main(['compare', '--before', 'before.json', '--after', 'after.json'], {
      readFile: () => '{}',
      compareSnapshots: () => ({ violated: false, reasons: [] }),
      log: () => {},
    });
    assert.equal(process.exitCode, 0);
  } finally {
    process.exitCode = originalExitCode;
  }
});

test('compareSnapshotsが違反ありと報告した場合、mainのcompareサブコマンドはexitCodeを1にする', () => {
  const originalExitCode = process.exitCode;
  try {
    main(['compare', '--before', 'before.json', '--after', 'after.json'], {
      readFile: () => '{}',
      compareSnapshots: () => ({ violated: true, reasons: ['HEAD SHA changed'] }),
      log: () => {},
    });
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = originalExitCode;
  }
});

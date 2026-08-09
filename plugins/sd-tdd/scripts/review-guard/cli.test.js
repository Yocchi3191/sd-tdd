// plugins/sd-tdd/scripts/review-guard/cli.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, main } = require('./cli');

test('parses the snapshot subcommand with a --branch flag', () => {
  assert.deepEqual(parseArgs(['snapshot', '--branch', 'feature-x']), {
    command: 'snapshot',
    branch: 'feature-x',
  });
});

test('parses the compare subcommand with --before and --after flags', () => {
  assert.deepEqual(parseArgs(['compare', '--before', 'a.json', '--after', 'b.json']), {
    command: 'compare',
    before: 'a.json',
    after: 'b.json',
  });
});

test('throws when the snapshot subcommand is missing --branch', () => {
  assert.throws(() => parseArgs(['snapshot']), /Usage: review-guard snapshot/);
});

test('throws when the compare subcommand is missing --before or --after', () => {
  assert.throws(() => parseArgs(['compare', '--before', 'a.json']), /Usage: review-guard compare/);
});

test('throws when no subcommand is given', () => {
  assert.throws(() => parseArgs([]), /Usage: review-guard <snapshot\|compare>/);
});

test('throws when an unknown subcommand is given', () => {
  assert.throws(() => parseArgs(['bogus']), /Usage: review-guard <snapshot\|compare>/);
});

test('main snapshot subcommand captures via the injected branch and logs the JSON snapshot', () => {
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

test('main compare subcommand reads both files, compares them, and logs the JSON result', () => {
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

test('main compare subcommand sets exitCode 0 when compareSnapshots reports no violation', () => {
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

test('main compare subcommand sets exitCode 1 when compareSnapshots reports a violation', () => {
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

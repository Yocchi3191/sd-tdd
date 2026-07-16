const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('./cli');

test('parses --issue and --tests flags', () => {
  assert.deepEqual(parseArgs(['--issue', '12', '--tests', './tests']), {
    issue: 12,
    tests: './tests',
    group: null,
  });
});

test('parses an optional --group flag', () => {
  assert.deepEqual(parseArgs(['--issue', '12', '--tests', './tests', '--group', '2']), {
    issue: 12,
    tests: './tests',
    group: 2,
  });
});

test('throws when required flags are missing', () => {
  assert.throws(() => parseArgs(['--issue', '12']), /Usage: coverage-check/);
});

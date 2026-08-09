// plugins/sd-tdd/scripts/review-guard/cli.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs } = require('./cli');

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

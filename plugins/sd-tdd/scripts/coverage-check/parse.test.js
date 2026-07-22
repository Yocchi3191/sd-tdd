// plugins/sd-tdd/scripts/coverage-check/parse.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRequirements } = require('./parse');

test('returns empty array when there are no REQ lines', () => {
  assert.deepEqual(parseRequirements('just a description, no requirements'), []);
});

test('parses plain REQ lines as not superseded', () => {
  const body = [
    'REQ-1: ユーザーが空文字を送信したら400を返す',
    'REQ-2: リトライは3回まで',
  ].join('\n');
  assert.deepEqual(parseRequirements(body), [
    { id: 1, supersededBy: null, structural: false },
    { id: 2, supersededBy: null, structural: false },
  ]);
});

test('extracts supersededBy from a superseded annotation', () => {
  const body = [
    'REQ-3: リトライは3回まで [superseded by REQ-12]',
    'REQ-12: リトライは5回まで — vendor APIの上限が5回だったため',
  ].join('\n');
  assert.deepEqual(parseRequirements(body), [
    { id: 3, supersededBy: 12, structural: false },
    { id: 12, supersededBy: null, structural: false },
  ]);
});

test('issue-26_REQ-1_parses a [structural] tag on a REQ line', () => {
  const body = 'REQ-3: [structural] namespaceがFoo.Barであること';
  assert.deepEqual(parseRequirements(body), [
    { id: 3, supersededBy: null, structural: true },
  ]);
});

test('issue-26_REQ-1_a REQ line without the structural tag is not structural', () => {
  const body = 'REQ-4: 空文字を送信したら400を返す';
  assert.deepEqual(parseRequirements(body), [
    { id: 4, supersededBy: null, structural: false },
  ]);
});

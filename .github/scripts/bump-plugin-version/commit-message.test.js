const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommitMessage, buildTags } = require('./commit-message');

test('1件のときは単一行のコミットメッセージになる', () => {
  const msg = buildCommitMessage([{ name: 'rally', version: '0.1.1' }]);
  assert.equal(msg, 'chore: rally v0.1.1');
});

test('複数件のときは列挙形式のコミットメッセージになる', () => {
  const msg = buildCommitMessage([
    { name: 'rally', version: '0.1.1' },
    { name: 'sd-tdd', version: '0.1.40' },
  ]);
  assert.equal(
    msg,
    'chore: bump plugin versions\n\n- rally v0.1.1\n- sd-tdd v0.1.40'
  );
});

test('タグ名はプラグイン名とバージョンから生成する', () => {
  const tags = buildTags([
    { name: 'rally', version: '0.1.1' },
    { name: 'sd-tdd', version: '0.1.40' },
  ]);
  assert.deepEqual(tags, ['rally--v0.1.1', 'sd-tdd--v0.1.40']);
});

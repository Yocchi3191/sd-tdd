const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCommitMessage, buildTags } = require('./commit-message');

test('1件のときは単一行のコミットメッセージになる', () => {
  const msg = buildCommitMessage([{ name: 'knowledge', version: '0.1.1' }]);
  assert.equal(msg, 'chore: knowledge v0.1.1');
});

test('複数件のときは列挙形式のコミットメッセージになる', () => {
  const msg = buildCommitMessage([
    { name: 'knowledge', version: '0.1.1' },
    { name: 'development', version: '0.1.40' },
  ]);
  assert.equal(
    msg,
    'chore: bump plugin versions\n\n- knowledge v0.1.1\n- development v0.1.40'
  );
});

test('タグ名はプラグイン名とバージョンから生成する', () => {
  const tags = buildTags([
    { name: 'knowledge', version: '0.1.1' },
    { name: 'development', version: '0.1.40' },
  ]);
  assert.deepEqual(tags, ['knowledge--v0.1.1', 'development--v0.1.40']);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { bumpPatch } = require('./version');

test('patchを1つ上げる', () => {
  assert.equal(bumpPatch('0.1.0'), '0.1.1');
});

test('patchが2桁以上でも正しく繰り上がる', () => {
  assert.equal(bumpPatch('1.2.9'), '1.2.10');
});

test('major/minorはそのまま維持する', () => {
  assert.equal(bumpPatch('3.4.5'), '3.4.6');
});

test('semver形式でない文字列はエラーを投げる', () => {
  assert.throws(() => bumpPatch('v1.2'), /Invalid version/);
});

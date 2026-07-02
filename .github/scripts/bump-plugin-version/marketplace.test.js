const test = require('node:test');
const assert = require('node:assert/strict');
const { setPluginVersion } = require('./marketplace');

test('該当プラグインのversionを上書きする', () => {
  const doc = {
    plugins: [
      { name: 'other-plugin', version: '2.0.0' },
      { name: 'sd-tdd', version: '0.1.0' },
    ],
  };
  const result = setPluginVersion(doc, 'sd-tdd', '0.1.1');
  assert.equal(result.plugins[1].version, '0.1.1');
  assert.equal(result.plugins[0].version, '2.0.0');
});

test('該当プラグインが見つからない場合はエラーを投げる', () => {
  const doc = { plugins: [{ name: 'other-plugin', version: '2.0.0' }] };
  assert.throws(() => setPluginVersion(doc, 'sd-tdd', '0.1.1'), /sd-tdd/);
});

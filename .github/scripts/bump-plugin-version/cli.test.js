const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { bumpPlugin } = require('./cli');

function makeTempPluginDir(name, { version = '0.1.0', withPackageJson = true } = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-plugin-version-'));
  const pluginDir = path.join(baseDir, 'plugins', name);
  fs.mkdirSync(path.join(pluginDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name, version }, null, 2)
  );
  if (withPackageJson) {
    fs.writeFileSync(
      path.join(pluginDir, 'package.json'),
      JSON.stringify({ name, version, private: true }, null, 2)
    );
  }
  return baseDir;
}

test('plugin.jsonとpackage.jsonの両方をbumpし、marketplaceも更新する', () => {
  const baseDir = makeTempPluginDir('sample');
  const marketplaceJson = { plugins: [{ name: 'sample', version: '0.1.0' }] };

  const result = bumpPlugin('sample', marketplaceJson, baseDir);

  assert.deepEqual(result, { name: 'sample', version: '0.1.1' });
  const pluginJson = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'plugins', 'sample', '.claude-plugin', 'plugin.json'), 'utf8')
  );
  assert.equal(pluginJson.version, '0.1.1');
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(baseDir, 'plugins', 'sample', 'package.json'), 'utf8')
  );
  assert.equal(packageJson.version, '0.1.1');
  assert.equal(marketplaceJson.plugins[0].version, '0.1.1');
});

test('package.jsonが無いプラグインでもplugin.jsonとmarketplaceだけbumpする', () => {
  const baseDir = makeTempPluginDir('no-package', { withPackageJson: false });
  const marketplaceJson = { plugins: [{ name: 'no-package', version: '0.1.0' }] };

  const result = bumpPlugin('no-package', marketplaceJson, baseDir);

  assert.deepEqual(result, { name: 'no-package', version: '0.1.1' });
  assert.equal(
    fs.existsSync(path.join(baseDir, 'plugins', 'no-package', 'package.json')),
    false
  );
});

test('plugin.jsonが存在しないプラグインはnullを返しスキップする', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-plugin-version-'));
  const marketplaceJson = { plugins: [{ name: 'ghost', version: '0.1.0' }] };

  const result = bumpPlugin('ghost', marketplaceJson, baseDir);

  assert.equal(result, null);
  assert.equal(marketplaceJson.plugins[0].version, '0.1.0');
});

test('不正なプラグイン名はエラーを投げる', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bump-plugin-version-'));
  const marketplaceJson = { plugins: [] };

  assert.throws(
    () => bumpPlugin('../evil', marketplaceJson, baseDir),
    /Invalid plugin name/
  );
});

test('marketplaceに掲載されていないプラグインはエラーを投げる', () => {
  const baseDir = makeTempPluginDir('unlisted');
  const marketplaceJson = { plugins: [] };

  assert.throws(
    () => bumpPlugin('unlisted', marketplaceJson, baseDir),
    /unlisted/
  );
});

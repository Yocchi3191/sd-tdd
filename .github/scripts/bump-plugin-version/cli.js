#!/usr/bin/env node
// .github/scripts/bump-plugin-version/cli.js
const fs = require('node:fs');
const path = require('node:path');
const { bumpPatch } = require('./version');
const { setPluginVersion } = require('./marketplace');
const { buildCommitMessage, buildTags } = require('./commit-message');

const MARKETPLACE_JSON_PATH = '.claude-plugin/marketplace.json';
// plugins/<name>/ のパスセグメントとして安全な名前のみ許可する。
const PLUGIN_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(relPath, 'utf8'));
}

function writeJson(relPath, doc) {
  fs.writeFileSync(relPath, `${JSON.stringify(doc, null, 2)}\n`);
}

// 削除・リネームされたプラグインディレクトリ名がdiffに残っていても
// plugin.jsonがもう存在しない場合はスキップする（対象外はnullを返す）。
function bumpPlugin(name, marketplaceJson, baseDir = process.cwd()) {
  if (!PLUGIN_NAME_RE.test(name)) {
    throw new Error(`Invalid plugin name: "${name}"`);
  }

  const pluginJsonPath = path.join(baseDir, 'plugins', name, '.claude-plugin', 'plugin.json');
  const packageJsonPath = path.join(baseDir, 'plugins', name, 'package.json');

  if (!fs.existsSync(pluginJsonPath)) {
    console.warn(`Skipping "${name}": ${pluginJsonPath} not found (deleted or renamed?)`);
    return null;
  }

  const pluginJson = readJson(pluginJsonPath);
  const newVersion = bumpPatch(pluginJson.version);
  pluginJson.version = newVersion;
  writeJson(pluginJsonPath, pluginJson);

  if (fs.existsSync(packageJsonPath)) {
    const packageJson = readJson(packageJsonPath);
    packageJson.version = newVersion;
    writeJson(packageJsonPath, packageJson);
  }

  setPluginVersion(marketplaceJson, name, newVersion);

  return { name, version: newVersion };
}

function writeGithubOutput(commitMessage, tags) {
  if (!process.env.GITHUB_OUTPUT) return;
  const delimiter = `EOF_${Date.now()}`;
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `commit_message<<${delimiter}\n${commitMessage}\n${delimiter}\ntags=${tags.join(' ')}\n`
  );
}

function main() {
  const pluginNames = process.argv.slice(2);
  if (pluginNames.length === 0) {
    console.error('Usage: cli.js <plugin-name> [<plugin-name> ...]');
    process.exit(1);
  }

  const marketplaceJson = readJson(MARKETPLACE_JSON_PATH);
  const bumps = pluginNames
    .map((name) => bumpPlugin(name, marketplaceJson))
    .filter(Boolean);

  if (bumps.length === 0) {
    console.log('No plugins to bump.');
    return;
  }

  writeJson(MARKETPLACE_JSON_PATH, marketplaceJson);

  const commitMessage = buildCommitMessage(bumps);
  const tags = buildTags(bumps);

  console.log(commitMessage);
  writeGithubOutput(commitMessage, tags);
}

if (require.main === module) {
  main();
}

module.exports = { main, bumpPlugin };

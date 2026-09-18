#!/usr/bin/env node
// .github/scripts/bump-plugin-version/cli.js
const fs = require('node:fs');
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

function bumpPlugin(name, marketplaceJson) {
  if (!PLUGIN_NAME_RE.test(name)) {
    throw new Error(`Invalid plugin name: "${name}"`);
  }

  const pluginJsonPath = `plugins/${name}/.claude-plugin/plugin.json`;
  const packageJsonPath = `plugins/${name}/package.json`;

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
  const bumps = pluginNames.map((name) => bumpPlugin(name, marketplaceJson));
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

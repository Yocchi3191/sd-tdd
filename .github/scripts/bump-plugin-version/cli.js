#!/usr/bin/env node
// .github/scripts/bump-plugin-version/cli.js
const fs = require('node:fs');
const { bumpPatch } = require('./version');
const { setPluginVersion } = require('./marketplace');

const PLUGIN_JSON_PATH = 'plugins/sd-tdd/.claude-plugin/plugin.json';
const PACKAGE_JSON_PATH = 'plugins/sd-tdd/package.json';
const MARKETPLACE_JSON_PATH = '.claude-plugin/marketplace.json';
const PLUGIN_NAME = 'sd-tdd';

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(relPath, 'utf8'));
}

function writeJson(relPath, doc) {
  fs.writeFileSync(relPath, `${JSON.stringify(doc, null, 2)}\n`);
}

function main() {
  const pluginJson = readJson(PLUGIN_JSON_PATH);
  const packageJson = readJson(PACKAGE_JSON_PATH);
  const marketplaceJson = readJson(MARKETPLACE_JSON_PATH);

  const newVersion = bumpPatch(pluginJson.version);

  pluginJson.version = newVersion;
  packageJson.version = newVersion;
  setPluginVersion(marketplaceJson, PLUGIN_NAME, newVersion);

  writeJson(PLUGIN_JSON_PATH, pluginJson);
  writeJson(PACKAGE_JSON_PATH, packageJson);
  writeJson(MARKETPLACE_JSON_PATH, marketplaceJson);

  console.log(newVersion);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${newVersion}\n`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

// .github/scripts/bump-plugin-version/marketplace.js
function setPluginVersion(marketplaceDoc, pluginName, newVersion) {
  const entry = (marketplaceDoc.plugins || []).find((p) => p.name === pluginName);
  if (!entry) {
    throw new Error(`Plugin "${pluginName}" not found in marketplace.json`);
  }
  entry.version = newVersion;
  return marketplaceDoc;
}

module.exports = { setPluginVersion };

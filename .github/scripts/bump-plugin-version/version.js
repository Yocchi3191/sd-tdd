// .github/scripts/bump-plugin-version/version.js
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function bumpPatch(version) {
  const match = version.match(SEMVER_RE);
  if (!match) {
    throw new Error(`Invalid version: "${version}" (expected "x.y.z")`);
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

module.exports = { bumpPatch };

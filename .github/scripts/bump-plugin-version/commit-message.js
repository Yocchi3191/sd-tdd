// .github/scripts/bump-plugin-version/commit-message.js
function buildCommitMessage(bumps) {
  if (bumps.length === 1) {
    return `chore: ${bumps[0].name} v${bumps[0].version}`;
  }
  return [
    'chore: bump plugin versions',
    '',
    ...bumps.map((b) => `- ${b.name} v${b.version}`),
  ].join('\n');
}

function buildTags(bumps) {
  return bumps.map((b) => `${b.name}--v${b.version}`);
}

module.exports = { buildCommitMessage, buildTags };

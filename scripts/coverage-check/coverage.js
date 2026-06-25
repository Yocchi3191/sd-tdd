// scripts/coverage-check/coverage.js
function findCoveredReqIds(testFileContents, issueNumber) {
  const re = new RegExp(`issue-${issueNumber}_REQ-(\\d+)`, 'g');
  const covered = new Set();
  for (const content of testFileContents) {
    let match;
    re.lastIndex = 0;
    while ((match = re.exec(content)) !== null) {
      covered.add(Number(match[1]));
    }
  }
  return covered;
}

function computeCoverage(requirements, coveredIds) {
  const activeIds = requirements
    .filter((r) => r.supersededBy === null)
    .map((r) => r.id);
  const allDeclaredIds = new Set(requirements.map((r) => r.id));

  const missing = activeIds.filter((id) => !coveredIds.has(id)).sort((a, b) => a - b);
  const orphans = [...coveredIds]
    .filter((id) => !allDeclaredIds.has(id))
    .sort((a, b) => a - b);

  return { missing, orphans };
}

module.exports = { findCoveredReqIds, computeCoverage };

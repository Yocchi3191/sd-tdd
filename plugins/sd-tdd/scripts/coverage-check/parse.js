// plugins/sd-tdd/scripts/coverage-check/parse.js
const REQ_LINE_RE = /^REQ-(\d+):\s*(.+)$/gm;
const SUPERSEDED_RE = /\[superseded by REQ-(\d+)\]/i;
const PR_GROUP_LINE_RE = /^グループ(\d+):\s*(.+?)\s*\(([^)]+)\)$/gm;

function parseRequirements(issueBody) {
  const requirements = [];
  let match;
  REQ_LINE_RE.lastIndex = 0;
  while ((match = REQ_LINE_RE.exec(issueBody)) !== null) {
    const id = Number(match[1]);
    const rest = match[2];
    const supersededMatch = rest.match(SUPERSEDED_RE);
    requirements.push({
      id,
      supersededBy: supersededMatch ? Number(supersededMatch[1]) : null,
    });
  }
  return requirements;
}

// Parses the "## PRグループ" section's `グループ<N>: <名前> (REQ-a, REQ-b, ...)` lines
// (see task-filing's task-template.md for the format contract).
function parsePrGroups(issueBody) {
  const groups = [];
  let match;
  PR_GROUP_LINE_RE.lastIndex = 0;
  while ((match = PR_GROUP_LINE_RE.exec(issueBody)) !== null) {
    const groupNumber = Number(match[1]);
    const name = match[2];
    const reqIds = [...match[3].matchAll(/REQ-(\d+)/g)].map((m) => Number(m[1]));
    groups.push({ groupNumber, name, reqIds });
  }
  return groups;
}

module.exports = { parseRequirements, parsePrGroups };

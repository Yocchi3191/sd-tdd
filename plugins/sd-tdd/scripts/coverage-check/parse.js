// plugins/sd-tdd/scripts/coverage-check/parse.js
const REQ_LINE_RE = /^REQ-(\d+):\s*(.+)$/gm;
const SUPERSEDED_RE = /\[superseded by REQ-(\d+)\]/i;

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

module.exports = { parseRequirements };

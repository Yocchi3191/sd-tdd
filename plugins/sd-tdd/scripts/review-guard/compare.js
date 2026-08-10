// plugins/sd-tdd/scripts/review-guard/compare.js
function compareSnapshots(before, after) {
  const reasons = [];

  if (before.headSha !== after.headSha) {
    reasons.push(`HEAD SHA changed: ${before.headSha} -> ${after.headSha}`);
  }

  if (before.statusPorcelain !== after.statusPorcelain) {
    reasons.push('working tree/index state changed (git status --porcelain differs)');
  }

  const beforeRemote = before.remoteRef;
  const afterRemote = after.remoteRef;
  if (beforeRemote.exists !== afterRemote.exists) {
    reasons.push(
      `remote tracking branch existence changed: ${beforeRemote.exists} -> ${afterRemote.exists}`,
    );
  } else if (beforeRemote.exists && afterRemote.exists && beforeRemote.sha !== afterRemote.sha) {
    reasons.push(`remote tracking branch SHA changed: ${beforeRemote.sha} -> ${afterRemote.sha}`);
  }

  return { violated: reasons.length > 0, reasons };
}

module.exports = { compareSnapshots };

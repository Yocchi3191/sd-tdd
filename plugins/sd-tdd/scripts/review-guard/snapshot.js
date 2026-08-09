// plugins/sd-tdd/scripts/review-guard/snapshot.js
const { execFileSync } = require('node:child_process');

function defaultGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function captureSnapshot(branch, { git = defaultGit } = {}) {
  const headSha = git(['rev-parse', 'HEAD']).trim();
  const statusPorcelain = git(['status', '--porcelain']).replace(/\n$/, '');

  let remoteRef;
  try {
    const sha = git(['rev-parse', `origin/${branch}`]).trim();
    remoteRef = { exists: true, sha };
  } catch {
    remoteRef = { exists: false, sha: null };
  }

  return { headSha, statusPorcelain, remoteRef };
}

module.exports = { captureSnapshot };

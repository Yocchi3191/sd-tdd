// plugins/sd-tdd/scripts/review-guard/snapshot.js
const { execFileSync } = require('node:child_process');

function defaultGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

// Detects a `git push` to `origin` specifically, via the local
// refs/remotes/origin/<branch> ref (updated immediately on a successful
// push, no fetch needed). Out of scope: pushes to a remote other than
// `origin`, force-pushes/deletions of the local branch itself, or
// `git push --delete` against the remote (see issue #50 decision log).
function captureSnapshot(branch, { git = defaultGit } = {}) {
  const headSha = git(['rev-parse', 'HEAD']).trim();
  const statusPorcelain = git(['status', '--porcelain']).replace(/\n$/, '');

  let remoteRef;
  try {
    // --verify -q: exit 1 with empty stderr when the ref doesn't exist,
    // vs. a nonzero exit with a `fatal:` message for a genuine error
    // (not a repo, permission denied, etc.) — this distinction is exit
    // code/stderr-based, not tied to git's (locale-dependent) message text.
    const sha = git(['rev-parse', '--verify', '-q', `origin/${branch}`]).trim();
    remoteRef = { exists: true, sha };
  } catch (error) {
    if (error.status === 1 && !error.stderr) {
      remoteRef = { exists: false, sha: null };
    } else {
      throw error;
    }
  }

  return { headSha, statusPorcelain, remoteRef };
}

module.exports = { captureSnapshot };

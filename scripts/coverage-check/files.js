const fs = require('node:fs');
const path = require('node:path');

function collectTestFileContents(dir) {
  const contents = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      contents.push(...collectTestFileContents(fullPath));
    } else if (entry.isFile()) {
      contents.push(fs.readFileSync(fullPath, 'utf8'));
    }
  }
  return contents;
}

module.exports = { collectTestFileContents };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { collectTestFileContents } = require('./files');

test('collects file contents recursively from a directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cov-check-'));
  fs.writeFileSync(path.join(dir, 'a.test.js'), 'it("issue-1_REQ-1_a", () => {});');
  fs.mkdirSync(path.join(dir, 'nested'));
  fs.writeFileSync(path.join(dir, 'nested', 'b.test.js'), 'it("issue-1_REQ-2_b", () => {});');

  const contents = collectTestFileContents(dir).sort();

  assert.deepEqual(contents, [
    'it("issue-1_REQ-1_a", () => {});',
    'it("issue-1_REQ-2_b", () => {});',
  ]);

  fs.rmSync(dir, { recursive: true, force: true });
});

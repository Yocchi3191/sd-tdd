#!/usr/bin/env node
const fs = require('node:fs');
const { captureSnapshot } = require('./snapshot');
const { compareSnapshots } = require('./compare');

function parseArgs(argv) {
  const [command, ...rest] = argv;

  if (command === 'snapshot') {
    const args = { command, branch: null };
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--branch') args.branch = rest[i + 1];
    }
    if (!args.branch) {
      throw new Error('Usage: review-guard snapshot --branch <name>');
    }
    return args;
  }

  if (command === 'compare') {
    const args = { command, before: null, after: null };
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === '--before') args.before = rest[i + 1];
      if (rest[i] === '--after') args.after = rest[i + 1];
    }
    if (!args.before || !args.after) {
      throw new Error('Usage: review-guard compare --before <file> --after <file>');
    }
    return args;
  }

  throw new Error('Usage: review-guard <snapshot|compare> ...');
}

function main(argv) {
  const args = parseArgs(argv);

  if (args.command === 'snapshot') {
    const snapshot = captureSnapshot(args.branch);
    console.log(JSON.stringify(snapshot, null, 2));
    process.exitCode = 0;
    return;
  }

  const before = JSON.parse(fs.readFileSync(args.before, 'utf8'));
  const after = JSON.parse(fs.readFileSync(args.after, 'utf8'));
  const result = compareSnapshots(before, after);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.violated ? 1 : 0;
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { parseArgs, main };

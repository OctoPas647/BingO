#!/usr/bin/env node
/* Scan past-exam JSON files for choice/multi tasks with fewer than 4 options.
   Usage: node tools/check-options.js [--min=4] [--json]
   Exit code: 0 when no issues are found, 1 otherwise. */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = [
  path.join(ROOT, 'content', 'past-exams'),
  path.join(ROOT, 'content', 'past-exams-en'),
];

function parseArgs(argv) {
  const args = { min: 4, json: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--min=')) {
      const value = Number(arg.slice(6));
      if (!Number.isInteger(value) || value < 1) {
        console.error(`Invalid --min value: ${arg.slice(6)}`);
        process.exit(2);
      }
      args.min = value;
    } else if (arg === '--json') {
      args.json = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

/* Recursively collect objects that look like tasks. This supports the current
   exams[].parts[].tasks[] layout and remains tolerant of future nesting. */
function collectTasks(value, tasks = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTasks(item, tasks));
  } else if (value && typeof value === 'object') {
    if (typeof value.type === 'string' && (value.type === 'choice' || value.type === 'multi')) {
      tasks.push(value);
    }
    Object.values(value).forEach((child) => collectTasks(child, tasks));
  }
  return tasks;
}

function auditFile(file, minOptions) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return { file, error: error.message, issues: [] };
  }

  const issues = collectTasks(data)
    .filter((task) => !Array.isArray(task.options) || task.options.length < minOptions)
    .map((task) => ({
      id: task.id || '(missing id)',
      type: task.type,
      options: Array.isArray(task.options) ? task.options.length : 0,
    }));

  return { file, error: null, issues };
}

function main() {
  const args = parseArgs(process.argv);
  const files = DIRS.flatMap((dir) => listJsonFiles(dir));
  const results = files.map((file) => auditFile(file, args.min));
  const problemFiles = results.filter((result) => result.error || result.issues.length > 0);
  const totalIssues = results.reduce((sum, result) => sum + result.issues.length, 0);

  if (args.json) {
    console.log(JSON.stringify({ minOptions: args.min, filesScanned: files.length, totalIssues, results: problemFiles }, null, 2));
  } else {
    console.log(`Options audit: minimum ${args.min} options`);
    console.log(`Scanned ${files.length} JSON files in content/past-exams and content/past-exams-en.`);

    if (problemFiles.length === 0) {
      console.log('No choice or multi tasks with too few options were found.');
    } else {
      for (const result of problemFiles) {
        const relative = path.relative(ROOT, result.file);
        if (result.error) {
          console.log(`\n${relative}\n  ERROR: ${result.error}`);
          continue;
        }
        console.log(`\n${relative}`);
        for (const issue of result.issues) {
          console.log(`  ${issue.id} (${issue.type}): ${issue.options} options`);
        }
      }
      console.log(`\nFound ${totalIssues} task(s) with fewer than ${args.min} options in ${problemFiles.length} file(s).`);
    }
  }

  process.exitCode = totalIssues > 0 || results.some((result) => result.error) ? 1 : 0;
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs, listJsonFiles, collectTasks, auditFile, main };

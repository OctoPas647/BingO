/* A simulated class for building the Looker Studio dashboard -> data/sample-class.csv */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = require('./load-engine')();
const csv = vm.runInContext('logCSV(simulateClass())', ctx);
const out = path.resolve(__dirname, '../data/sample-class.csv'); fs.writeFileSync(out, csv);
console.log('  class    ->', path.relative(process.cwd(), out), (csv.match(/\n/g) || []).length, 'rows');

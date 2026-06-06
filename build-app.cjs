const fs = require('fs');
const p = require('path');
const f = p.join(process.env.HOME,'projects/record-check/src/App.jsx');
const current = fs.readFileSync(f, 'utf8');
console.log('Current App.jsx lines:', current.split('\n').length);
console.log('First line:', current.split('\n')[0]);

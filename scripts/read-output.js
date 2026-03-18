import fs from 'fs';
const data = fs.readFileSync('resource_output.txt', 'utf8');
console.log('--- CLEAN OUTPUT ---');
console.log(data);

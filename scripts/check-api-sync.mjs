import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const a = path.join(root, 'api');
const b = path.join(root, 'frontend/api');
const files = (dir, prefix = '') => readdirSync(dir, {withFileTypes:true}).flatMap(item => item.isDirectory() ? files(path.join(dir,item.name), prefix+item.name+'/') : [prefix+item.name]);
const names = new Set([...files(a), ...files(b)]);
let differences = 0;
for (const name of names) {
  try {
    const read = dir => readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n');
    if (read(a) === read(b)) continue;
  } catch { /* A missing counterpart is also drift. */ }
  console.error(`API copies differ: ${name}`);
  differences++;
}
if (differences) process.exitCode = 1;
else console.log(`All ${names.size} API files match between api/ and frontend/api/.`);

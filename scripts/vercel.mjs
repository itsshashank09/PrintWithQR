import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const cli = fileURLToPath(new URL('../node_modules/vercel/dist/index.js', import.meta.url));
const args = process.argv.slice(2);
const childEnv = { ...process.env };
// Reuse the Windows login at its existing location without copying credentials.
const config = path.join(os.homedir(), 'AppData', 'Roaming', 'com.vercel.cli');
if (process.platform === 'win32' && existsSync(path.join(config, 'auth.json')) && !args.includes('--global-config')) {
  if (args[0] === 'curl') {
    // Vercel's beta curl command forwards unknown global flags to curl itself.
    childEnv.XDG_DATA_HOME = path.dirname(config);
  } else {
    args.unshift('--global-config', config);
  }
}
// Resolve configuration beside an explicit working directory, rather than an ancestor.
const cwdIndex = args.indexOf('--cwd');
if (cwdIndex >= 0 && args[cwdIndex + 1] && !args.includes('--local-config')) {
  const localConfig = path.resolve(args[cwdIndex + 1], 'vercel.json');
  if (existsSync(localConfig)) {
    const separator = args.indexOf('--');
    args.splice(separator < 0 ? args.length : separator, 0, '--local-config', localConfig);
  }
}
const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', windowsHide: true, env: childEnv });
if (result.error) console.error(`Vercel CLI could not start: ${result.error.code}`);
process.exitCode = result.status ?? 1;

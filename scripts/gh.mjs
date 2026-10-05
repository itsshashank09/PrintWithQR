import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const portable = fileURLToPath(new URL('../.tools/gh/bin/gh.exe', import.meta.url));
const command = process.platform === 'win32' && existsSync(portable) ? portable : 'gh';
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
// Reuse the existing Git credential manager without printing or saving a token.
if (!env.GH_TOKEN && !env.GITHUB_TOKEN) {
  const credential = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
    env: { ...env, GCM_INTERACTIVE: 'never' }, windowsHide: true, timeout: 10000
  });
  if (credential.status === 0) {
    const match = credential.stdout.match(/^password=(.+)$/m);
    if (match) env.GH_TOKEN = match[1].trim();
  }
}
const result = spawnSync(command, process.argv.slice(2), { env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error(`GitHub CLI could not start: ${result.error.code}. See docs/OPERATIONS.md.`);
process.exitCode = result.status ?? 1;

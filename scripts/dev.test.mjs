import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function until(check, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail('Timed out waiting for development processes');
}
async function healthy(port) {
  try {
    return (
      await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(250),
      })
    ).ok;
  } catch {
    return false;
  }
}

test(
  'dev shutdown exits the launcher, releases both ports and removes watcher/runner groups',
  { skip: process.platform === 'win32', timeout: 20_000 },
  async () => {
    const port = await freePort(),
      webPort = await freePort();
    const child = spawn(process.execPath, ['scripts/dev.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, PORT: String(port), WEB_PORT: String(webPort) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    const exited = once(child, 'exit');
    let groups = [];
    try {
      await until(
        async () => (await healthy(port)) && (await healthy(webPort)),
      );
      groups = execFileSync('ps', ['-o', 'pid=', '--ppid', String(child.pid)], {
        encoding: 'utf8',
      })
        .trim()
        .split(/\s+/)
        .map(Number);
      assert.equal(groups.length, 2, output);
      child.kill('SIGINT');
      const [code] = await Promise.race([
        exited,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('SIGINT did not exit the launcher')),
            4000,
          ).unref(),
        ),
      ]);
      assert.equal(code, 0, output);
      await until(
        async () => !(await healthy(port)) && !(await healthy(webPort)),
      );
      await until(() =>
        groups.every((pid) => {
          try {
            process.kill(-pid, 0);
            return false;
          } catch (error) {
            return error.code === 'ESRCH';
          }
        }),
      );
    } finally {
      for (const pid of groups) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {}
      }
      if (child.exitCode === null) child.kill('SIGTERM');
    }
  },
);

import { spawn } from 'node:child_process';

// Separate groups let shutdown reach Bun's watcher and the workspace runner's
// descendants, not just their immediate wrapper processes.
const grouped = process.platform !== 'win32';
const processes = [
  spawn(process.execPath, ['--watch', 'apps/server/src/index.ts'], {
    stdio: 'inherit',
    detached: grouped,
  }),
  spawn(process.execPath, ['run', '--filter', '@board-games/web', 'dev'], {
    stdio: 'inherit',
    detached: grouped,
  }),
];
let stopping = false;
let exitCode = 0;
function signalChildren(signal) {
  for (const child of processes) {
    if (!child.pid) continue;
    try {
      if (grouped) process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error);
    }
  }
}
function forceStop() {
  signalChildren('SIGKILL');
  process.exit(exitCode);
}
function stop(code = 0) {
  if (stopping) return forceStop();
  stopping = true;
  exitCode = code;
  signalChildren('SIGTERM');
  // Watch mode can keep Bun alive after the HTTP server has closed. Keep this
  // timer referenced even if wrappers exit first, so no descendants survive.
  setTimeout(forceStop, 1200);
}
for (const child of processes) {
  child.on('exit', (code) => {
    if (!stopping) stop(code ?? 1);
  });
  child.on('error', (error) => {
    console.error(error);
    if (!stopping) stop(1);
  });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

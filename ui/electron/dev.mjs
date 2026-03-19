import {spawn} from 'node:child_process';
import http from 'node:http';
import process from 'node:process';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const uiDir = path.resolve(import.meta.dirname, '..');
const devUrl = 'http://127.0.0.1:1420/';

function waitForServer(url, timeoutMs = 30000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, res => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryOnce, intervalMs);
      });
    };

    tryOnce();
  });
}

const vite = spawn('pnpm', ['run', 'dev'], {
  cwd: uiDir,
  env: process.env,
  stdio: 'inherit'
});

let electron = null;
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (electron && !electron.killed) {
    electron.kill('SIGTERM');
  }
  if (vite && !vite.killed) {
    vite.kill('SIGTERM');
  }
  process.exit(code);
}

vite.on('exit', code => {
  if (!shuttingDown) {
    shutdown(code ?? 0);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}

waitForServer(devUrl)
  .then(() => {
    electron = spawn(electronBinary, ['.'], {
      cwd: uiDir,
      env: process.env,
      stdio: 'inherit'
    });

    electron.on('exit', code => {
      if (!shuttingDown) {
        shutdown(code ?? 0);
      }
    });
  })
  .catch(error => {
    console.error(`[electron:dev] ${error.message}`);
    shutdown(1);
  });

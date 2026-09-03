import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _staticTest } = require('../../claudeville/server.js');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serverPath = path.join(repoRoot, 'claudeville/server.js');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function startFixtureServer({ root } = {}) {
  return freePort().then(port => new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      HERMES_OFFICE_HOST: '127.0.0.1',
      HERMES_OFFICE_PORT: String(port),
    };
    if (root) env.HERMES_OFFICE_LOCAL_ASSET_ROOT = root;
    else delete env.HERMES_OFFICE_LOCAL_ASSET_ROOT;
    const child = spawn(process.execPath, [serverPath], { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const timer = setTimeout(() => finish(new Error(`server startup timed out: ${output}`)), 10_000);
    const finish = error => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      if (error) {
        child.kill('SIGTERM');
        reject(error);
      } else resolve({ child, port });
    };
    const onData = chunk => {
      output += chunk.toString();
      if (output.includes('Server running:')) finish();
    };
    child.once('error', finish);
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  }));
}

function rawStatus(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
    request.end();
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

test('local asset roots must be configured as existing absolute directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-assets-'));
  try {
    assert.equal(_staticTest.resolveLocalAssetRoot(''), null);
    assert.equal(_staticTest.resolveLocalAssetRoot('relative/path'), null);
    assert.equal(_staticTest.resolveLocalAssetRoot(path.join(root, 'missing')), null);
    assert.equal(_staticTest.resolveLocalAssetRoot(root), fs.realpathSync(root));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('local asset request paths strip the mount prefix and reject the mount root', () => {
  assert.equal(_staticTest.localAssetRelativePath('/local-assets/theme/manifest.yaml'), 'theme/manifest.yaml');
  assert.equal(_staticTest.localAssetRelativePath('/local-assets/'), null);
  assert.equal(_staticTest.localAssetRelativePath('/assets/theme.png'), null);
});

test('local asset mount serves contained files and rejects missing, traversal, and outside symlinks', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-local-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-office-outside-'));
  fs.mkdirSync(path.join(root, 'theme'));
  fs.writeFileSync(path.join(root, 'theme/manifest.yaml'), 'style: {}\n');
  fs.writeFileSync(path.join(outside, 'secret.txt'), 'private');
  fs.symlinkSync(path.join(outside, 'secret.txt'), path.join(root, 'theme/outside.txt'));
  fs.symlinkSync(outside, path.join(root, 'theme/outside-dir'));
  const { child, port } = await startFixtureServer({ root });
  try {
    const valid = await fetch(`http://127.0.0.1:${port}/local-assets/theme/manifest.yaml`);
    assert.equal(valid.status, 200);
    assert.equal(valid.headers.get('content-type'), 'text/yaml; charset=utf-8');
    assert.equal(await valid.text(), 'style: {}\n');
    assert.equal(await rawStatus(port, '/local-assets/'), 404);
    assert.equal(await rawStatus(port, '/local-assets/theme/missing.png'), 404);
    assert.ok([403, 404].includes(await rawStatus(port, '/local-assets/%2e%2e/secret.txt')));
    assert.equal(await rawStatus(port, '/local-assets/theme/outside.txt'), 403);
    assert.equal(await rawStatus(port, '/local-assets/theme/outside-dir/secret.txt'), 403);
  } finally {
    await stopServer(child);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('local asset mount is disabled when no root is configured', async () => {
  const { child, port } = await startFixtureServer();
  try {
    assert.equal(await rawStatus(port, '/local-assets/theme/manifest.yaml'), 404);
  } finally {
    await stopServer(child);
  }
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { prepareConfig } = require('../src/prepare-config');

test('prepareConfig copies config.example.cjs to config.local.cjs', async () => {
  const packageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-prepare-config-'));
  const examplePath = path.join(packageDir, 'config.example.cjs');
  const localPath = path.join(packageDir, 'config.local.cjs');
  await fs.writeFile(examplePath, 'module.exports = { restAppToken: "" };\n');

  const result = await prepareConfig({ packageDir });

  assert.deepEqual(result, {
    copied: true,
    examplePath,
    localPath,
  });
  assert.equal(await fs.readFile(localPath, 'utf8'), 'module.exports = { restAppToken: "" };\n');
});

test('prepareConfig does not overwrite existing config.local.cjs', async () => {
  const packageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-prepare-config-existing-'));
  const examplePath = path.join(packageDir, 'config.example.cjs');
  const localPath = path.join(packageDir, 'config.local.cjs');
  await fs.writeFile(examplePath, 'module.exports = { restAppToken: "" };\n');
  await fs.writeFile(localPath, 'module.exports = { restAppToken: "real-token" };\n');

  const result = await prepareConfig({ packageDir });

  assert.equal(result.copied, false);
  assert.equal(await fs.readFile(localPath, 'utf8'), 'module.exports = { restAppToken: "real-token" };\n');
});

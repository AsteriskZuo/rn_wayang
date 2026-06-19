'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const PACKAGE_DIR = path.resolve(__dirname, '..');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function prepareConfig({ packageDir = PACKAGE_DIR } = {}) {
  const examplePath = path.join(packageDir, 'config.example.cjs');
  const localPath = path.join(packageDir, 'config.local.cjs');

  if (await fileExists(localPath)) {
    return { copied: false, examplePath, localPath };
  }

  await fs.copyFile(examplePath, localPath, fs.constants.COPYFILE_EXCL);
  return { copied: true, examplePath, localPath };
}

async function runCli() {
  try {
    const result = await prepareConfig();
    if (result.copied) {
      console.log(`Copied ${path.basename(result.examplePath)} to ${path.basename(result.localPath)}`);
    } else {
      console.log(`${path.basename(result.localPath)} already exists; not overwritten`);
    }
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  prepareConfig,
};

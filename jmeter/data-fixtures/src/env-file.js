'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function serializeEnv(env) {
  const lines = [];
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env key: ${key}`);
    }
    const stringValue = String(value);
    if (/[\r\n]/.test(stringValue)) {
      throw new Error(`Invalid env value for ${key}: newlines are not allowed`);
    }
    lines.push(`${key}=${stringValue}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseEnvFile(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      throw new Error(`Invalid env line: ${rawLine}`);
    }
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env key: ${key}`);
    }
    env[key] = value;
  }
  return env;
}

async function readEnvFileIfExists(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return parseEnvFile(text);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeEnvFileAtomic(filePath, env) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, serializeEnv(env), 'utf8');
  await fs.rename(tempPath, filePath);
}

module.exports = {
  parseEnvFile,
  readEnvFileIfExists,
  serializeEnv,
  writeEnvFileAtomic,
};

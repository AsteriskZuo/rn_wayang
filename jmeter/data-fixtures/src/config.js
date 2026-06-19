'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const REQUIRED_FIELDS = [
  'restHost',
  'restOrgName',
  'restAppName',
  'restAppToken',
  'userPrefix',
  'defaultPassword',
];

function requireNonEmptyString(rawConfig, fieldName) {
  const value = rawConfig[fieldName];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing required config field: ${fieldName}`);
  }
  return value.trim();
}

function validateConfig(rawConfig, configPath) {
  if (!rawConfig || typeof rawConfig !== 'object') {
    throw new Error('Config must export an object');
  }

  for (const fieldName of REQUIRED_FIELDS) {
    requireNonEmptyString(rawConfig, fieldName);
  }

  const restHost = requireNonEmptyString(rawConfig, 'restHost').replace(/\/+$/, '');
  const restOrgName = requireNonEmptyString(rawConfig, 'restOrgName');
  const restAppName = requireNonEmptyString(rawConfig, 'restAppName');
  const restAppToken = requireNonEmptyString(rawConfig, 'restAppToken');
  const userPrefix = requireNonEmptyString(rawConfig, 'userPrefix');
  const defaultPassword = requireNonEmptyString(rawConfig, 'defaultPassword');
  const requestTimeoutMs = rawConfig.requestTimeoutMs === undefined
    ? 30000
    : Number(rawConfig.requestTimeoutMs);

  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(userPrefix)) {
    throw new Error('Invalid userPrefix: use letters, numbers, underscore, or hyphen');
  }

  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error('Invalid requestTimeoutMs: use a positive integer');
  }

  return {
    restHost,
    restOrgName,
    restAppName,
    restAppToken,
    userPrefix,
    defaultPassword,
    requestTimeoutMs,
    appKey: `${restOrgName}#${restAppName}`,
    configPath,
  };
}

async function loadConfig(packageDir = path.resolve(__dirname, '..')) {
  const configPath = path.join(packageDir, 'config.local.cjs');

  try {
    await fs.access(configPath);
  } catch (error) {
    throw new Error(`Missing config.local.cjs at ${configPath}. Copy config.example.cjs first.`);
  }

  delete require.cache[require.resolve(configPath)];
  const rawConfig = require(configPath);
  return validateConfig(rawConfig, configPath);
}

module.exports = {
  loadConfig,
  validateConfig,
};

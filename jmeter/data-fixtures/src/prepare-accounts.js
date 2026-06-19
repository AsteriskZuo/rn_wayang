'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./config');
const { buildAccountEnv, buildFixtureUsers, getAllUsernames } = require('./fixture-users');
const { readEnvFileIfExists, writeEnvFileAtomic } = require('./env-file');
const { createLogger } = require('./logger');
const { EasemobRestClient, isDuplicateUserError, isMissingResourceError } = require('./rest-client');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(PACKAGE_DIR, '.state');

async function prepareAccounts({ config, client, logger, stateDir = DEFAULT_STATE_DIR }) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);

  logger.info('Preparing fixture accounts', { count: usernames.length });

  for (const username of usernames) {
    try {
      logger.info('Registering account', { username });
      await client.registerUsers([{ username, password: config.defaultPassword }]);
    } catch (error) {
      if (!isDuplicateUserError(error)) {
        throw error;
      }
      logger.info('Account exists; resetting password', { username });
      await client.getUser(username);
      await client.resetPassword(username, config.defaultPassword);
    }
  }

  const accountsPath = path.join(stateDir, 'accounts.env');
  await writeEnvFileAtomic(accountsPath, buildAccountEnv({
    appKey: config.appKey,
    userPrefix: config.userPrefix,
    defaultPassword: config.defaultPassword,
    users,
  }));

  logger.info('Wrote account fixture data', { accountsPath });
  return { accountsPath };
}

async function deleteAccounts({ config, client, logger, stateDir = DEFAULT_STATE_DIR }) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);
  const relationshipsPath = path.join(stateDir, 'relationships.env');
  const previousRelationships = await readEnvFileIfExists(relationshipsPath);

  logger.info('Deleting fixture accounts', { count: usernames.length });

  if (previousRelationships.GROUP_ID) {
    try {
      logger.info('Deleting previous group before account cleanup', { groupId: previousRelationships.GROUP_ID });
      await client.deleteGroup(previousRelationships.GROUP_ID);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Previous group already missing', { groupId: previousRelationships.GROUP_ID });
    }
  }

  if (previousRelationships.ROOM_ID) {
    try {
      logger.info('Deleting previous chat room before account cleanup', { roomId: previousRelationships.ROOM_ID });
      await client.deleteChatRoom(previousRelationships.ROOM_ID);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Previous chat room already missing', { roomId: previousRelationships.ROOM_ID });
    }
  }

  for (const username of usernames) {
    try {
      logger.info('Deleting account', { username });
      await client.deleteUser(username);
    } catch (error) {
      if (!isMissingResourceError(error)) {
        throw error;
      }
      logger.info('Account already missing', { username });
    }
  }

  const accountsPath = path.join(stateDir, 'accounts.env');
  await fs.rm(accountsPath, { force: true });
  await fs.rm(relationshipsPath, { force: true });
  logger.info('Removed account fixture data', { accountsPath });
  logger.info('Removed relationship fixture data', { relationshipsPath });
  return { accountsPath };
}

async function runCli() {
  const mode = process.argv[2];
  if (!['prepare', 'delete'].includes(mode)) {
    console.error('Usage: node src/prepare-accounts.js <prepare|delete>');
    process.exitCode = 1;
    return;
  }

  let logger;
  try {
    const config = await loadConfig(PACKAGE_DIR);
    logger = await createLogger({
      stateDir: DEFAULT_STATE_DIR,
      commandName: mode === 'prepare' ? 'prepare-accounts' : 'delete-accounts',
      token: config.restAppToken,
    });
    logger.info('Loaded config', { configPath: config.configPath });
    const client = new EasemobRestClient({ ...config, logger });
    const result = mode === 'prepare'
      ? await prepareAccounts({ config, client, logger })
      : await deleteAccounts({ config, client, logger });
    await logger.close();

    console.log(`${mode === 'prepare' ? 'Prepared' : 'Deleted'} fixture accounts`);
    console.log(`Data file: ${result.accountsPath}`);
    console.log(`Log file: ${logger.logPath}`);
  } catch (error) {
    if (logger) {
      logger.error('Command failed', {
        message: error.message,
        method: error.method,
        path: error.path,
        status: error.status,
        error: error.body?.error,
        exception: error.body?.exception,
        error_description: error.body?.error_description,
      });
      await logger.close();
      console.error(`Command failed. Log file: ${logger.logPath}`);
    } else {
      console.error(`Command failed: ${error.message}`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  runCli();
}

module.exports = {
  deleteAccounts,
  prepareAccounts,
};

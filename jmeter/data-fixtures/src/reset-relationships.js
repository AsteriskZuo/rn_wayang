'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const { loadConfig } = require('./config');
const { readEnvFileIfExists, writeEnvFileAtomic } = require('./env-file');
const {
  CONTACT_CANDIDATE_KEYS,
  RECIPROCAL_FRIEND_KEYS,
  TARGET_FRIEND_KEYS,
  buildFixtureUsers,
  getAllUsernames,
} = require('./fixture-users');
const { createLogger } = require('./logger');
const { EasemobRestClient, isMissingResourceError } = require('./rest-client');

const PACKAGE_DIR = path.resolve(__dirname, '..');
const DEFAULT_STATE_DIR = path.join(PACKAGE_DIR, '.state');

async function ensureAccountExists(client, username) {
  try {
    const response = await client.getUser(username);
    if (response.count === 0) {
      throw new Error(`Missing required fixture account: ${username}`);
    }
  } catch (error) {
    if (isMissingResourceError(error)) {
      throw new Error(`Missing required fixture account: ${username}`);
    }
    throw error;
  }
}

function buildRelationshipsEnv({ config, users, groupId, roomId }) {
  return {
    APP_KEY: config.appKey,
    USER_PREFIX: config.userPrefix,
    PRIMARY_USERNAME: users.PRIMARY_USERNAME,
    CONTACT_FRIEND_USERNAME: users.CONTACT_FRIEND_USERNAME,
    CONTACT_NON_FRIEND_USERNAME: users.CONTACT_NON_FRIEND_USERNAME,
    CONTACT_EXISTING_FRIEND_USERNAME: users.CONTACT_EXISTING_FRIEND_USERNAME,
    CONTACT_FRIEND_TO_ADD_USERNAME: users.CONTACT_FRIEND_TO_ADD_USERNAME,
    CONTACT_INVITATION_SMOKE_USERNAME: users.CONTACT_INVITATION_SMOKE_USERNAME,
    CONTACT_FIXTURE_READY: 'true',
    GROUP_ID: groupId,
    GROUP_OWNER_USERNAME: users.GROUP_OWNER_USERNAME,
    GROUP_MEMBER_USERNAME_1: users.GROUP_MEMBER_USERNAME_1,
    GROUP_MEMBER_USERNAME_2: users.GROUP_MEMBER_USERNAME_2,
    GROUP_NON_MEMBER_USERNAME_1: users.GROUP_NON_MEMBER_USERNAME_1,
    GROUP_NON_MEMBER_USERNAME_2: users.GROUP_NON_MEMBER_USERNAME_2,
    ROOM_ID: roomId,
    ROOM_OWNER_USERNAME: users.ROOM_OWNER_USERNAME,
    ROOM_MEMBER_USERNAME_1: users.ROOM_MEMBER_USERNAME_1,
    ROOM_MEMBER_USERNAME_2: users.ROOM_MEMBER_USERNAME_2,
    ROOM_NON_MEMBER_USERNAME_1: users.ROOM_NON_MEMBER_USERNAME_1,
    ROOM_NON_MEMBER_USERNAME_2: users.ROOM_NON_MEMBER_USERNAME_2,
  };
}

async function ignoreMissingResource(operation, logger, message, details) {
  try {
    await operation();
  } catch (error) {
    if (!isMissingResourceError(error)) {
      throw error;
    }
    logger.info(message, details);
  }
}

async function rollbackNewResources({ client, logger, originalError, createdGroupId, createdRoomId }) {
  if (createdRoomId) {
    try {
      await ignoreMissingResource(
        () => client.deleteChatRoom(createdRoomId),
        logger,
        'New chat room already missing during rollback',
        { roomId: createdRoomId },
      );
    } catch (cleanupError) {
      logger.error('Failed to delete new chat room during rollback', {
        originalError: originalError.message,
        cleanupError: cleanupError.message,
        roomId: createdRoomId,
      });
    }
  }

  if (createdGroupId) {
    try {
      await ignoreMissingResource(
        () => client.deleteGroup(createdGroupId),
        logger,
        'New group already missing during rollback',
        { groupId: createdGroupId },
      );
    } catch (cleanupError) {
      logger.error('Failed to delete new group during rollback', {
        originalError: originalError.message,
        cleanupError: cleanupError.message,
        groupId: createdGroupId,
      });
    }
  }
}

async function resetRelationships({
  config,
  client,
  logger,
  stateDir = DEFAULT_STATE_DIR,
  writeEnvFile = writeEnvFileAtomic,
}) {
  const users = buildFixtureUsers(config.userPrefix, config.defaultPassword);
  const usernames = getAllUsernames(users);
  const relationshipsPath = path.join(stateDir, 'relationships.env');

  logger.info('Validating fixture accounts', { count: usernames.length });
  for (const username of usernames) {
    await ensureAccountExists(client, username);
  }

  const previousEnv = await readEnvFileIfExists(relationshipsPath);

  await fs.rm(relationshipsPath, { force: true });
  logger.info('Removed stale relationship fixture data', { relationshipsPath });

  if (previousEnv.GROUP_ID) {
    logger.info('Deleting previous group', { groupId: previousEnv.GROUP_ID });
    await ignoreMissingResource(
      () => client.deleteGroup(previousEnv.GROUP_ID),
      logger,
      'Previous group already missing',
      { groupId: previousEnv.GROUP_ID },
    );
  }

  if (previousEnv.ROOM_ID) {
    logger.info('Deleting previous chat room', { roomId: previousEnv.ROOM_ID });
    await ignoreMissingResource(
      () => client.deleteChatRoom(previousEnv.ROOM_ID),
      logger,
      'Previous chat room already missing',
      { roomId: previousEnv.ROOM_ID },
    );
  }

  let createdGroupId;
  let createdRoomId;

  try {
    logger.info('Clearing primary contact candidate relationships');
    for (const contactKey of CONTACT_CANDIDATE_KEYS) {
      const friendUsername = users[contactKey];
      await ignoreMissingResource(
        () => client.deleteFriend(users.PRIMARY_USERNAME, friendUsername),
        logger,
        'Primary contact relationship already missing',
        { owner: users.PRIMARY_USERNAME, friend: friendUsername },
      );
    }

    logger.info('Clearing reciprocal contact candidate relationships');
    for (const contactKey of CONTACT_CANDIDATE_KEYS) {
      const friendUsername = users[contactKey];
      await ignoreMissingResource(
        () => client.deleteFriend(friendUsername, users.PRIMARY_USERNAME),
        logger,
        'Reciprocal contact candidate relationship already missing',
        { owner: friendUsername, friend: users.PRIMARY_USERNAME },
      );
    }

    logger.info('Clearing primary block-list contact candidates');
    for (const contactKey of CONTACT_CANDIDATE_KEYS) {
      const blockedUsername = users[contactKey];
      await ignoreMissingResource(
        () => client.removeBlockUser(users.PRIMARY_USERNAME, blockedUsername),
        logger,
        'Primary block-list entry already missing',
        { owner: users.PRIMARY_USERNAME, blocked: blockedUsername },
      );
    }

    logger.info('Adding target primary contact relationships');
    for (const contactKey of TARGET_FRIEND_KEYS) {
      await client.addFriend(users.PRIMARY_USERNAME, users[contactKey]);
    }

    logger.info('Adding reciprocal stable friend relationships');
    for (const contactKey of RECIPROCAL_FRIEND_KEYS) {
      await client.addFriend(users[contactKey], users.PRIMARY_USERNAME);
    }

    const groupName = `${config.userPrefix}_group`;
    const groupResponse = await client.createGroup({
      name: groupName,
      description: 'wayang data fixture group',
      owner: users.GROUP_OWNER_USERNAME,
      members: [users.GROUP_MEMBER_USERNAME_1, users.GROUP_MEMBER_USERNAME_2],
    });
    createdGroupId = groupResponse?.data?.groupid;
    if (!createdGroupId) {
      throw new Error('Missing group ID in group create response');
    }
    logger.info('Created group', { groupId: createdGroupId });

    const roomName = `${config.userPrefix}_room`;
    const roomResponse = await client.createChatRoom({
      name: roomName,
      description: 'wayang data fixture chat room',
      owner: users.ROOM_OWNER_USERNAME,
      members: [users.ROOM_MEMBER_USERNAME_1, users.ROOM_MEMBER_USERNAME_2],
    });
    createdRoomId = roomResponse?.data?.id;
    if (!createdRoomId) {
      throw new Error('Missing room ID in chat room create response');
    }
    logger.info('Created chat room', { roomId: createdRoomId });

    await writeEnvFile(relationshipsPath, buildRelationshipsEnv({
      config,
      users,
      groupId: createdGroupId,
      roomId: createdRoomId,
    }));
    logger.info('Wrote relationship fixture data', {
      relationshipsPath,
      groupId: createdGroupId,
      roomId: createdRoomId,
    });

    return { relationshipsPath, groupId: createdGroupId, roomId: createdRoomId };
  } catch (error) {
    logger.error('Relationship reset failed; cleaning newly created resources', { message: error.message });
    await rollbackNewResources({ client, logger, originalError: error, createdGroupId, createdRoomId });
    throw error;
  }
}

async function runCli() {
  let logger;
  try {
    const config = await loadConfig(PACKAGE_DIR);
    logger = await createLogger({
      stateDir: DEFAULT_STATE_DIR,
      commandName: 'reset-relationships',
      token: config.restAppToken,
    });
    logger.info('Loaded config', { configPath: config.configPath });
    const client = new EasemobRestClient({ ...config, logger });
    const result = await resetRelationships({ config, client, logger });
    await logger.close();

    console.log('Reset fixture relationships');
    console.log(`Data file: ${result.relationshipsPath}`);
    console.log(`GROUP_ID: ${result.groupId}`);
    console.log(`ROOM_ID: ${result.roomId}`);
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
  buildRelationshipsEnv,
  resetRelationships,
};

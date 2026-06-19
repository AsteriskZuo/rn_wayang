'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createLogger, redactToken, timestampForFile } = require('../src/logger');

test('redactToken removes configured token from log details', () => {
  const text = redactToken('Authorization: Bearer secret-token', 'secret-token');
  assert.equal(text, 'Authorization: Bearer [REDACTED]');
});

test('timestampForFile creates sortable timestamp', () => {
  const timestamp = timestampForFile(new Date('2026-06-19T07:08:09Z'));
  assert.match(timestamp, /^20260619-\d{6}-\d{3}$/);
});

test('createLogger writes timestamped log file with redaction', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-logger-'));
  const logger = await createLogger({
    stateDir: path.join(dir, '.state'),
    commandName: 'prepare-accounts',
    token: 'secret-token',
    now: () => new Date('2026-06-19T07:08:09Z'),
  });

  logger.info('loaded token secret-token');
  logger.error('request failed', { path: '/users/user1', authorization: 'Bearer secret-token' });
  await logger.close();

  assert.match(path.basename(logger.logPath), /^prepare-accounts-20260619-070809-000-pid\d+\.log$/);
  const text = await fs.readFile(logger.logPath, 'utf8');
  assert.match(text, /INFO loaded token \[REDACTED\]/);
  assert.match(text, /ERROR request failed/);
  assert.match(text, /"authorization":"Bearer \[REDACTED\]"/);
});

test('createLogger avoids overwriting same-second log files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wayang-logger-collision-'));
  const options = {
    stateDir: path.join(dir, '.state'),
    commandName: 'reset-relationships',
    token: 'secret-token',
    now: () => new Date('2026-06-19T07:08:09.123Z'),
  };
  const first = await createLogger(options);
  first.info('first');
  await first.close();

  const second = await createLogger(options);
  second.info('second');
  await second.close();

  assert.notEqual(first.logPath, second.logPath);
  assert.match(path.basename(second.logPath), /^reset-relationships-20260619-070809-123-pid\d+-1\.log$/);
  assert.match(await fs.readFile(first.logPath, 'utf8'), /first/);
  assert.match(await fs.readFile(second.logPath, 'utf8'), /second/);
});

'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

function pad(number) {
  return String(number).padStart(2, '0');
}

function timestampForFile(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    '-',
    String(date.getUTCMilliseconds()).padStart(3, '0'),
  ].join('');
}

function redactToken(value, token) {
  if (!token) {
    return String(value);
  }
  return String(value).split(token).join('[REDACTED]');
}

function redactDetails(details, token) {
  return JSON.parse(redactToken(JSON.stringify(details), token));
}

async function createLogger({ stateDir, commandName, token, now = () => new Date() }) {
  const logsDir = path.join(stateDir, 'logs');
  await fs.mkdir(logsDir, { recursive: true });
  const baseName = `${commandName}-${timestampForFile(now())}-pid${process.pid}`;
  let logPath = path.join(logsDir, `${baseName}.log`);
  for (let index = 1; ; index += 1) {
    try {
      const handle = await fs.open(logPath, 'wx');
      await handle.close();
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
      logPath = path.join(logsDir, `${baseName}-${index}.log`);
    }
  }
  const lines = [];

  function write(level, message, details) {
    const safeMessage = redactToken(message, token);
    const suffix = details === undefined ? '' : ` ${JSON.stringify(redactDetails(details, token))}`;
    lines.push(`${new Date().toISOString()} ${level} ${safeMessage}${suffix}`);
  }

  return {
    logPath,
    info(message, details) {
      write('INFO', message, details);
    },
    error(message, details) {
      write('ERROR', message, details);
    },
    async close() {
      await fs.writeFile(logPath, `${lines.join('\n')}\n`, 'utf8');
    },
  };
}

module.exports = {
  createLogger,
  redactToken,
  timestampForFile,
};

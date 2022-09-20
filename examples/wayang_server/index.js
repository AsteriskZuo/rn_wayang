'use strict';

const session = require('express-session');
const express = require('express');
const http = require('http');

const {WebSocketServer} = require('ws');

const app = express();
const map = new Map();

const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false,
});

app.use(sessionParser);

const server = http.createServer(app);

const wss = new WebSocketServer({clientTracking: false, noServer: true});

function checkTopic(request) {
  do {
    const url = request.url;
    const session = request.session;
    if (!url.includes('?topic=')) {
      break;
    }
    session.group = url.split('=')[1];
    if (!map.has(session.group)) {
      console.log(`New group: ${session.group}`);
      map.set(session.group, new Map());
    }
    return true;
  } while (false);
  return false;
}

server.on('upgrade', function (request, socket, head) {
  console.log('Parsing session from request...');

  sessionParser(request, {}, () => {
    console.log('Session is parsed!');
    if (!checkTopic(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit('connection', ws, request);
    });
  });
});

wss.on('connection', function (ws, request) {
  const id = request.session.id;
  const groupKey = request.session.group;
  const group = map.get(groupKey);
  console.log(`New connection: ${id}`);
  Object.defineProperty(ws, 'id', {
    value: id,
    writable: false,
  });
  group.set(id, ws);
  ws.on('message', function (message) {
    console.log(`Received message ${message} from user ${id}`);
    group.forEach((value, key) => {
      console.log(`test: ${ws.id}, ${key}`);
      if (ws.id !== key) {
        value.send(message);
      }
    });
  });

  ws.on('close', function () {
    console.log(`Destroy connection: ${id}`);
    group.delete(id);
    if (group.size === 0) {
      console.log(`Destroy group: ${group}`);
      map.delete(groupKey);
    }
  });
});

server.listen(8080, function () {
  console.log('Listening on http://localhost:8080');
});

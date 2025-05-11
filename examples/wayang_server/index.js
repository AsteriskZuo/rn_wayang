'use strict';

const session = require('express-session');
const express = require('express');
const http = require('http');

const {WebSocketServer} = require('ws');

const app = express();
const map = new Map();
// const trans = new Map();
let seq = 0;

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
    const s = request.session;
    if (!url.includes('?topic=')) {
      break;
    }
    s.group = url.split('=')[1];
    if (!map.has(s.group)) {
      console.log(`New group: ${s.group}`);
      map.set(s.group, new Map());
    }
    return true;
  } while (false);
  return false;
}

/**
 * simple multi-connections data forward handler
 *
 * @param {*} allWs web socket list.
 * @param {*} senderWs the web socket that received the data.
 * @param {*} data to forward data.
 */
function simpleForward(allWs, senderWs, data, isBinary) {
  allWs.forEach((ws, key) => {
    console.log(`ws: ${senderWs.id}, ${key}`);
    if (senderWs.id !== key) {
      ws.send(data, {binary: isBinary});
    } else {
      senderWs.send('receive data and forward data.');
    }
  });
}

// function Transaction({seq, senderWs}) {
//   this.seq = seq;
//   this.senderWs = senderWs;
// }

/**
 * Find initiator in the group or set new initiator
 * @param {Map} allWs websocket connections map
 * @param {WebSocket} senderWs current sender
 * @returns {WebSocket} initiator websocket
 */
function determineInitiator(allWs, senderWs) {
  let initiator = null;
  allWs.forEach(ws => {
    if (ws.isInitiator === true) {
      initiator = ws;
    }
  });

  if (!initiator) {
    Object.defineProperty(senderWs, 'isInitiator', {
      value: true,
      writable: false,
    });
    return senderWs;
  }
  return initiator;
}

/**
 * Reply forward handler
 * @param {Map} allWs websocket connections map
 * @param {WebSocket} senderWs sender websocket
 * @param {*} data message data
 * @param {boolean} isBinary is binary data
 */
function replyForward(allWs, senderWs, data, isBinary) {
  const initiatorWs = determineInitiator(allWs, senderWs);
  if (senderWs.isInitiator === true) {
    allWs.forEach((ws, key) => {
      if (ws.id !== senderWs.id && ws.readyState === ws.OPEN) {
        console.log('test:send:', ws.id, data);
        ws.send(data, {binary: isBinary});
      }
    });
  } else {
    if (initiatorWs && initiatorWs.readyState === initiatorWs.OPEN) {
      console.log('test:send:', initiatorWs.id, data);
      initiatorWs.send(data, {binary: isBinary});
    }
  }
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
  if (mode === 1) {
    Object.defineProperty(ws, 'seq', {
      value: 0,
      writable: true,
    });
  }

  group.set(id, ws);
  ws.on('message', function (data, isBinary) {
    // const isBinary = true;
    console.log(
      `Received message: ${data}, ${typeof data}, ${isBinary}, from user ${id}`,
    );
    if (mode === 0) {
      simpleForward(group, ws, data, isBinary);
    } else if (mode === 1) {
      // wss.clients.forEach(function each(client) {
      //   if (client !== ws && client.readyState === WebSocket.OPEN) {
      //     client.send(data, { binary: isBinary });
      //   }
      // });
      replyForward(group, ws, data, isBinary);
    } else {
      throw 'mode is error';
    }
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

const port = 8083;
const host = `http://localhost:${port}`;
/**
 * 0.simple 1.reply
 */
const mode = 1;

server.listen(8083, function () {
  console.log(`Listening on ${host}, mode is ${mode}`);
});

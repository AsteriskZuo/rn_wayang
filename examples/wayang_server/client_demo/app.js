(function () {
  const messages = document.querySelector('#messages');
  const wsStartButton = document.querySelector('#wsStartButton');
  const wsStopButton = document.querySelector('#wsStopButton');
  const wsSendButton = document.querySelector('#wsSendButton');
  const host = 'localhost:8083';
  const topic = 'rn';
  let uuid = 0;
  const map = new Map();
  let curWs;

  function showMessage(message) {
    messages.textContent += `\n${message}`;
    messages.scrollTop = messages.scrollHeight;
  }

  wsStartButton.onclick = function () {
    const ws = new WebSocket(`ws://${host}/iov/websocket/dual?topic=${topic}`);
    ws.onerror = (event) => {
      showMessage(`${ws.id}: WebSocket error: ${event}`);
    };
    ws.onopen = function () {
      showMessage(`${ws.id}: WebSocket connection established`);
    };
    ws.onclose = function (event) {
      showMessage(`${ws.id}: WebSocket connection closed`);
      const id = ws.id;
      map.delete(ws.id);
      if (map.size === 0) {
        curWs = null;
      } else {
        const key = map.keys().next().value;
        curWs = map.get(key);
      }
    };
    ws.onmessage = function (message) {
      // showMessage(`${socket.id}: WebSocket message: ${JSON.stringify(event)}`);
      console.log(
        `${ws.id}: onmessage: ${message.type}, ${message.data}`,
      );
      // message.data
      //   .arrayBuffer()
      //   .then(msg => {
      //     console.log(`test: ${msg}`);
      //   })
      //   .catch(error => {
      //     console.log(`test: ${error}`);
      //   });
      // message.data
      //   .text()
      //   .then(msg => {
      //     console.log(`test: ${msg}`);
      //   })
      //   .catch(error => {
      //     console.log(`test: ${error}`);
      //   });
    };
    Object.defineProperty(ws, 'id', {
      value: uuid++,
      writable: false,
    });
    curWs = ws;
    map.set(ws.id, ws);
  };

  wsSendButton.onclick = function () {
    if (!curWs) {
      showMessage('No WebSocket connection');
      return;
    }
    // curWs.send('你好中文，哈哈。');
    curWs.send({key: 'value'});
    // curWs.send(JSON.stringify({key: 'value'}));
    showMessage(`${curWs.id}: Sent "Hello World!"`);
  };

  wsStopButton.onclick = function () {
    if (!curWs) {
      showMessage('No WebSocket connection');
      return;
    }
    curWs.close();
    showMessage(`${curWs.id}: WebSocket connection close`);
  };
})();

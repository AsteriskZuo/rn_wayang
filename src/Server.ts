import WebSocket, {WebSocketServer as WSWebSocketServer, Server} from 'ws';

export function ServerStart(_params: any) {
  const wss = new WSWebSocketServer();
  wss.on('connection', function connection(ws) {
    console.log('onConnect:', ws);
    ws.onopen = () => {
      // connection opened
      console.log('onopen:');
      ws.send('something'); // send a message
    };

    ws.onmessage = e => {
      // a message was received
      console.log('onmessage:', e.data);
    };

    ws.onerror = e => {
      // an error occurred
      console.log('onerror:', e.message);
    };

    ws.onclose = e => {
      // connection closed
      console.log('onclose: ', e.code, e.reason);
    };
    ws.send('something');
  });
}

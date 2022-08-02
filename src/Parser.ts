import {ServerStart} from './Server';

export class Parser {
  protected TAG = 'Parser';
  private topic: string;
  private address: string;

  private static _instance: Parser;
  public static getInstance(): Parser {
    if (Parser._instance === null || Parser._instance === undefined) {
      Parser._instance = new Parser();
    }
    return Parser._instance;
  }

  constructor() {
    this.topic = 'rn';
    this.address = `wss://webdemo.agora.io:8083/iov/websocket/dual?topic=${this.topic}`;
  }

  start(): void {
    // ref: https://reactnative.dev/docs/network
    const ws = new WebSocket(this.address);

    ws.onopen = () => {
      // connection opened
      console.log('onopen:');
      ws.send('something'); // send a message
    };

    ws.onmessage = e => {
      // a message was received
      console.log('onmessage:', e.data);
      ws.send('ok');
    };

    ws.onerror = e => {
      // an error occurred
      console.log('onerror:', e.message);
    };

    ws.onclose = e => {
      // connection closed
      console.log('onclose: ', e.code, e.reason);
    };
  }
  stop(): void {}

  start2(): void {
    ServerStart('');
  }
}

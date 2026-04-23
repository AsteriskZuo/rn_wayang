export type ReturnCallback = (data: any) => void;

export interface WSMessageListener {
  /**
   * 网络数据发送接收接口
   * @param data [in] 接收到的数据
   * @param callback [out] 返回的数据的回调接口，必须调用，否则超时
   * - 如果输入数据为`null`或者`undefined`，则默认没有数据需要返回，否则有数据需要返回
   * - 一般地，行为接口是不需要数据返回的。
   */
  onMessage(data: any, callback: ReturnCallback): void;
}

export class RNWS {
  private static TAG = 'RNWS';
  private topic: string;
  private host: string;
  private port: number;
  private address: string;
  private ws?: WebSocket;
  private listeners: Array<WSMessageListener>;

  private static _instance: RNWS;
  public static getInstance(): RNWS {
    if (RNWS._instance === null || RNWS._instance === undefined) {
      RNWS._instance = new RNWS();
    }
    return RNWS._instance;
  }

  constructor() {
    this.topic = 'rn';
    this.host = 'localhost';
    this.port = 8083;
    // this.host = 'webdemo.agora.io';
    // this.address = `wss://webdemo.agora.io:8083/iov/websocket/dual?topic=${this.topic}`;
    // ws://${host}/iov/websocket/dual?topic=${topic}
    this.address = `ws://${this.host}:${this.port}/iov/websocket/dual?topic=${this.topic}`;
    this.listeners = [];
  }

  addListener(listener: WSMessageListener): void {
    this.listeners.push(listener);
  }

  clearListener(): void {
    this.listeners = [];
  }

  start(): void {
    // ref: https://reactnative.dev/docs/network
    this.ws = new WebSocket(this.address);

    this.ws.onopen = () => {
      // connection opened
      console.log(`${RNWS.TAG}: onopen:`);
    };

    this.ws.onmessage = e => {
      // a message was received
      console.log(`${RNWS.TAG}: onmessage:`, e.data);
      // this.ws?.send('ok');
      for (let index = 0; index < this.listeners.length; index++) {
        const listener = this.listeners[index];
        listener.onMessage(e.data, this.send.bind(this));
      }
    };

    this.ws.onerror = e => {
      // an error occurred
      console.log(`${RNWS.TAG}: onerror:`, e.message);
    };

    this.ws.onclose = e => {
      // connection closed
      console.log(`${RNWS.TAG}: onclose: `, e.code, e.reason);
    };
  }

  stop(): void {
    console.log(`${RNWS.TAG}: stop:`);
    this.ws?.close();
  }

  send(data: any): void {
    console.log(`${RNWS.TAG}: send:`, data);
    if (!(data === null || data === undefined)) {
      this.ws?.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      this.ws?.send('no return data');
    }
  }
}

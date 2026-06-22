import {Logger} from './Logger';

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
  /**
   * 服务器地址和端口
   * 默认地址为`localhost:8083`
   * Android模拟器地址为为`10.0.2.2:8083`
   */
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
    this.address = this.buildAddress();
    this.listeners = [];
  }

  private buildAddress(): string {
    return `ws://${this.host}:${this.port}/iov/websocket/dual?topic=${this.topic}`;
  }

  setHost(host: string): void {
    this.host = host;
    this.address = this.buildAddress();
  }

  setPort(port: number): void {
    this.port = port;
    this.address = this.buildAddress();
  }

  addListener(listener: WSMessageListener): void {
    this.listeners.push(listener);
  }

  clearListener(): void {
    this.listeners = [];
  }

  start(): void {
    // ref: https://reactnative.dev/docs/network
    this.ws?.close();
    this.ws = new WebSocket(this.address);

    this.ws.onopen = () => {
      // connection opened
      Logger.raw.log(`${RNWS.TAG}: onopen:`);
    };

    this.ws.onmessage = e => {
      // a message was received
      Logger.raw.log(`${RNWS.TAG}: onmessage:`, e.data);
      Logger.json.log(`${RNWS.TAG}: recv:`, e.data);
      // this.ws?.send('ok');
      for (let index = 0; index < this.listeners.length; index++) {
        const listener = this.listeners[index];
        listener.onMessage(e.data, this.send.bind(this));
      }
    };

    this.ws.onerror = e => {
      // an error occurred
      Logger.raw.error(`${RNWS.TAG}: onerror:`, e.message);
    };

    this.ws.onclose = e => {
      // connection closed
      Logger.raw.log(`${RNWS.TAG}: onclose: `, e.code, e.reason);
    };
  }

  stop(): void {
    Logger.raw.log(`${RNWS.TAG}: stop:`);
    this.ws?.close();
    this.ws = undefined;
  }

  send(data: any): void {
    Logger.raw.log(`${RNWS.TAG}: send:`, data);
    Logger.json.log(`${RNWS.TAG}: send:`, data);
    const payload = data === undefined ? {ok: true, value: null} : data;
    this.ws?.send(
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
  }
}

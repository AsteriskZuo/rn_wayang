import {ReturnCallback} from '../RNWS';

export class BizChatClient {
  static login(data: any, callback: ReturnCallback): void {
    callback('ok');
  }
  static logout(data: any, callback: ReturnCallback): void {
    callback(null);
  }
}

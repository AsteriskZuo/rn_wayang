import {BizChatClient} from './biz/BizChatClient';
import {ReturnCallback, WSMessageListener} from './RNWS';

export class Dispatch implements WSMessageListener {
  private static TAG = 'Dispatch';

  constructor() {}

  onMessage(data: any, callback: ReturnCallback): void {
    if (data === null || data === undefined) {
      throw new Error('data is invalid.');
    }
    if (!this.dispatch(data, callback)) {
      callback(undefined);
    }
  }

  dispatch(data: any, callback: ReturnCallback): boolean {
    let ret: boolean = true;
    const dataObject = JSON.parse(data);
    const cmd = dataObject.cmd;
    const info = dataObject.info;
    // console.log(`${Dispatch.TAG}: dispatch: `, cmd, info);
    switch (cmd) {
      case 'login': {
        BizChatClient.login(info, callback);
        break;
      }
      case 'logout': {
        BizChatClient.logout(info, callback);
        break;
      }

      default:
        ret = false;
        break;
    }
    return ret;
  }
}

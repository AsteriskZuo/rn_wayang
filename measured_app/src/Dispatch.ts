import {
  dispatchChatClient,
  dispatchChatContactManager,
  dispatchChatGroupManager,
  dispatchChatManager,
  dispatchChatPresenceManager,
  dispatchChatPushManager,
  dispatchChatRoomManager,
  dispatchChatUserInfoManager,
  dispatchInternal,
} from './dispatch/index';
import {Logger} from './Logger';
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
    if (data === null || data === undefined || data === '') {
      return false;
    }

    let dataObject;
    try {
      dataObject = JSON.parse(data);
    } catch (error) {
      Logger.json.warn(`${Dispatch.TAG}: dispatch parse failed:`, data, error);
      return false;
    }

    const cmd = dataObject.cmd;
    const info = dataObject.info;
    Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);

    const handled =
      dispatchChatClient(cmd, info, callback, false) ||
      dispatchChatManager(cmd, info, callback, false) ||
      dispatchChatGroupManager(cmd, info, callback, false) ||
      dispatchChatRoomManager(cmd, info, callback, false) ||
      dispatchChatContactManager(cmd, info, callback, false) ||
      dispatchChatPresenceManager(cmd, info, callback, false) ||
      dispatchChatPushManager(cmd, info, callback, false) ||
      dispatchChatUserInfoManager(cmd, info, callback, false) ||
      dispatchInternal(cmd, info, callback);

    if (!handled) {
      Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    }

    return handled;
  }
}

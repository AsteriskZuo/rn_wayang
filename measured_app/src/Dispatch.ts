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

type DispatchRoute = (
  cmd: string,
  info: any,
  callback: ReturnCallback,
  logUnknown?: boolean,
) => boolean;

const SDK_ROUTES: DispatchRoute[] = [
  dispatchChatClient,
  dispatchChatManager,
  dispatchChatGroupManager,
  dispatchChatRoomManager,
  dispatchChatContactManager,
  dispatchChatPresenceManager,
  dispatchChatPushManager,
  dispatchChatUserInfoManager,
];

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

    for (const dispatchRoute of SDK_ROUTES) {
      if (dispatchRoute(cmd, info, callback, false)) {
        return true;
      }
    }

    const handled = dispatchInternal(cmd, info, callback);

    if (!handled) {
      Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    }

    return handled;
  }
}

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
import {protocolError, wrapApiCallback} from './dispatch/Response';
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
    this.dispatch(data, callback);
  }

  dispatch(data: any, callback: ReturnCallback): boolean {
    let dataObject;
    try {
      dataObject = JSON.parse(data);
    } catch (error) {
      Logger.json.warn(`${Dispatch.TAG}: dispatch parse failed:`, data, error);
      callback(
        protocolError('invalid_json', 'request body is not valid JSON', {
          data,
        }),
      );
      return false;
    }

    const cmd = dataObject?.cmd;
    if (typeof cmd !== 'string' || cmd.trim().length === 0) {
      callback(
        protocolError('invalid_command', 'request cmd must be a non-empty string', {
          cmd,
        }),
      );
      return false;
    }

    const info = dataObject.info;
    Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);

    const apiCallback = wrapApiCallback(callback);

    for (const dispatchRoute of SDK_ROUTES) {
      if (dispatchRoute(cmd, info, apiCallback, false)) {
        return true;
      }
    }

    if (dispatchInternal(cmd, info, apiCallback)) {
      return true;
    }

    Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    callback(protocolError('unknown_command', `unknown command: ${cmd}`, {cmd}));
    return false;
  }
}

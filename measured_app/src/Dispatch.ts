import {
  dispatchChatClient,
  dispatchChatClientCommands,
  dispatchChatContactManager,
  dispatchChatContactManagerCommands,
  dispatchChatGroupManager,
  dispatchChatGroupManagerCommands,
  dispatchChatManager,
  dispatchChatManagerCommands,
  dispatchChatPresenceManager,
  dispatchChatPresenceManagerCommands,
  dispatchChatPushManager,
  dispatchChatPushManagerCommands,
  dispatchChatRoomManager,
  dispatchChatRoomManagerCommands,
  dispatchChatUserInfoManager,
  dispatchChatUserInfoManagerCommands,
  dispatchInternal,
} from './dispatch/index';
import {Logger} from './Logger';
import {ReturnCallback, WSMessageListener} from './RNWS';

type DispatchRoute = {
  key: string;
  commands: Set<string>;
  dispatch: (cmd: string, info: any, callback: ReturnCallback) => boolean;
};

const SDK_ROUTES: DispatchRoute[] = [
  {
    key: 'ChatClient',
    commands: dispatchChatClientCommands,
    dispatch: dispatchChatClient,
  },
  {
    key: 'ChatManager',
    commands: dispatchChatManagerCommands,
    dispatch: dispatchChatManager,
  },
  {
    key: 'ChatGroupManager',
    commands: dispatchChatGroupManagerCommands,
    dispatch: dispatchChatGroupManager,
  },
  {
    key: 'ChatRoomManager',
    commands: dispatchChatRoomManagerCommands,
    dispatch: dispatchChatRoomManager,
  },
  {
    key: 'ChatContactManager',
    commands: dispatchChatContactManagerCommands,
    dispatch: dispatchChatContactManager,
  },
  {
    key: 'ChatPresenceManager',
    commands: dispatchChatPresenceManagerCommands,
    dispatch: dispatchChatPresenceManager,
  },
  {
    key: 'ChatPushManager',
    commands: dispatchChatPushManagerCommands,
    dispatch: dispatchChatPushManager,
  },
  {
    key: 'ChatUserInfoManager',
    commands: dispatchChatUserInfoManagerCommands,
    dispatch: dispatchChatUserInfoManager,
  },
];

function normalizeRouteKey(value: any): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  return value.startsWith('Biz') ? value.slice(3) : value;
}

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
    const routeKey = normalizeRouteKey(
      dataObject.manager ?? dataObject.target ?? dataObject.bizClass,
    );
    Logger.json.log(`${Dispatch.TAG}: dispatch:`, cmd, info);

    const candidateRoutes = SDK_ROUTES.filter(route =>
      route.commands.has(cmd),
    );

    if (routeKey !== undefined) {
      const route = candidateRoutes.find(item => item.key === routeKey);
      if (route !== undefined) {
        return route.dispatch(cmd, info, callback);
      }
      Logger.raw.warn(
        `${Dispatch.TAG}: unknown manager for cmd: ${cmd}, manager: ${routeKey}`,
      );
      return false;
    }

    if (candidateRoutes.length === 1) {
      return candidateRoutes[0].dispatch(cmd, info, callback);
    }

    if (candidateRoutes.length > 1) {
      Logger.raw.warn(
        `${Dispatch.TAG}: ambiguous cmd: ${cmd}, managers: ${candidateRoutes
          .map(route => route.key)
          .join(',')}`,
      );
      return false;
    }

    const handled = dispatchInternal(cmd, info, callback);

    if (!handled) {
      Logger.raw.warn(`${Dispatch.TAG}: unknown cmd: ${cmd}`);
    }

    return handled;
  }
}

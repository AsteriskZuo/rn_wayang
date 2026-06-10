import {
  ChatClient,
  ChatConnectEventListener,
  ChatMultiDeviceEvent,
  ChatMultiDeviceEventListener,
  ChatOptions,
  ChatPushConfig,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatClient extends BizBase {
  static init(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().init(
        ChatOptions.withAppKey({
          appKey: info.appKey,
          autoLogin: info.autoLogin,
          debugModel: info.debugModel,
        }),
      ),
      callback,
      ChatClient.getInstance().getCurrentUsername.name,
    );
  }
  static getCurrentUsername(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().getCurrentUsername(),
      callback,
      ChatClient.getInstance().getCurrentUsername.name,
    );
  }
  static isConnected(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().isConnected(),
      callback,
      ChatClient.getInstance().isConnected.name,
    );
  }
  static getImSdkVersion(_info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static getIsLoggedIn(info: any, callback: ReturnCallback) {
    const isLoggedIn = ChatClient.getInstance().currentUserName.length > 0;
    callback(isLoggedIn);
  }
  static isLoginBefore(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().isLoginBefore(),
      callback,
      ChatClient.getInstance().isLoginBefore.name,
    );
  }
  static getAccessToken(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().getAccessToken(),
      callback,
      ChatClient.getInstance().getAccessToken.name,
    );
  }
  static renewAgoraToken(info: any, callback: ReturnCallback) {
    const agoraToken = info.token;
    this.tryCatch(
      ChatClient.getInstance().renewAgoraToken(agoraToken),
      callback,
      ChatClient.getInstance().renewAgoraToken.name,
    );
  }
  static loginWithToken(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const token = info.token;
    this.tryCatch(
      ChatClient.getInstance().loginWithToken(userName, token),
      callback,
      ChatClient.getInstance().loginWithToken.name,
    );
  }
  static createAccount(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const password = info.password;
    this.tryCatch(
      ChatClient.getInstance().createAccount(userName, password),
      callback,
      ChatClient.getInstance().createAccount.name,
    );
  }
  static changeAppKey(info: any, callback: ReturnCallback) {
    const appKey = info.appKey;
    this.tryCatch(
      ChatClient.getInstance().changeAppKey(appKey),
      callback,
      ChatClient.getInstance().changeAppKey.name,
    );
  }
  static changeAppId(info: any, callback: ReturnCallback) {
    const appId = info.appId;
    this.tryCatch(
      ChatClient.getInstance().changeAppId(appId),
      callback,
      ChatClient.getInstance().changeAppId.name,
    );
  }
  static compressLogs(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().compressLogs(),
      callback,
      ChatClient.getInstance().compressLogs.name,
    );
  }
  static getLoggedInDevicesFromServer(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const password = info.password ?? info.token;
    const isPassword = info.isPassword ?? true;
    this.tryCatch(
      ChatClient.getInstance().getLoggedInDevicesFromServer(
        userName,
        password,
        isPassword,
      ),
      callback,
      ChatClient.getInstance().getLoggedInDevicesFromServer.name,
    );
  }
  static kickDevice(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const password = info.password ?? info.token;
    const resource = info.resource;
    const isPassword = info.isPassword ?? true;
    this.tryCatch(
      ChatClient.getInstance().kickDevice(
        userName,
        password,
        resource,
        isPassword,
      ),
      callback,
      ChatClient.getInstance().kickDevice.name,
    );
  }
  static kickAllDevices(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const password = info.password ?? info.token;
    const isPassword = info.isPassword ?? true;
    this.tryCatch(
      ChatClient.getInstance().kickAllDevices(userName, password, isPassword),
      callback,
      ChatClient.getInstance().kickAllDevices.name,
    );
  }
  static updatePushConfig(info: any, callback: ReturnCallback) {
    const deviceId = info.deviceId;
    const deviceToken = info.deviceToken;
    this.tryCatch(
      ChatClient.getInstance().updatePushConfig(
        new ChatPushConfig({deviceId, deviceToken}),
      ),
      callback,
      ChatClient.getInstance().updatePushConfig.name,
    );
  }
  static getRTCTokenInfoWithChannelName(info: any, callback: ReturnCallback) {
    const channelName = info.channelName;
    this.tryCatch(
      ChatClient.getInstance().getRTCTokenInfoWithChannelName(channelName),
      callback,
      ChatClient.getInstance().getRTCTokenInfoWithChannelName.name,
    );
  }
  static getUserIdsWithRTCUids(info: any, callback: ReturnCallback) {
    const uids = Array.isArray(info.uids)
      ? info.uids
      : (info.uids as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().getUserIdsWithRTCUids(
        uids.map((uid: string | number) => Number(uid)),
      ),
      callback,
      ChatClient.getInstance().getUserIdsWithRTCUids.name,
    );
  }
  static addConnectionDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().addConnectionListener(
      new (class implements ChatConnectEventListener {
        onConnected(): void {
          console.log(this.onConnected.name);
        }
        onDisconnected(errorCode?: number | undefined): void {
          console.log(this.onDisconnected.name, errorCode);
        }
        onTokenWillExpire(): void {
          console.log(this.onTokenWillExpire.name);
        }
        onTokenDidExpire(): void {
          console.log(this.onTokenDidExpire.name);
        }
      })(),
    );
    callback(null);
  }
  static deleteConnectionDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().removeAllConnectionListener();
    callback(null);
  }
  static addMultiDeviceDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().addMultiDeviceListener(
      new (class implements ChatMultiDeviceEventListener {
        onContactEvent(
          event?: ChatMultiDeviceEvent | undefined,
          target?: string | undefined,
          ext?: string | undefined,
        ): void {
          console.log(this.onContactEvent.name, event, target, ext);
        }
        onGroupEvent(
          event?: ChatMultiDeviceEvent | undefined,
          target?: string | undefined,
          usernames?: string[] | undefined,
        ): void {
          console.log(this.onGroupEvent.name, event, target, usernames);
        }
        onThreadEvent(
          event?: ChatMultiDeviceEvent | undefined,
          target?: string | undefined,
          usernames?: string[] | undefined,
        ): void {
          console.log(this.onGroupEvent.name, event, target, usernames);
        }
      })(),
    );
    callback(null);
  }
  static deleteMultiDeviceDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().removeAllMultiDeviceListener();
    callback(null);
  }
  static login(data: any, callback: ReturnCallback): void {
    const userName = data.username;
    const pwdOrToken = data.password;
    const isPassword = true;
    this.tryCatch(
      ChatClient.getInstance().login(userName, pwdOrToken, isPassword),
      callback,
      ChatClient.getInstance().login.name,
    );
  }
  static count = 0;
  static logout(data: any, callback: ReturnCallback): void {
    const unbindDeviceToken = BizChatClient.count++ % 2 === 1 ? true : false;
    this.tryCatch(
      ChatClient.getInstance().logout(unbindDeviceToken),
      callback,
      ChatClient.getInstance().login.name,
    );
  }
}

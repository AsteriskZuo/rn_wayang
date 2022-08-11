import {
  ChatClient,
  ChatConnectEventListener,
  ChatMultiDeviceEvent,
  ChatMultiDeviceEventListener,
  ChatOptions,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatClient extends BizBase {
  static init(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().init(
        new ChatOptions({
          appKey: info.appKey,
          autoLogin: info.autoLogin,
          debugModel: info.debugModel,
        }),
      ),
      callback,
      ChatClient.getInstance().getCurrentUsername.name,
    );
  }
  static getCurrentUserName(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().getCurrentUsername(),
      callback,
      ChatClient.getInstance().getCurrentUsername.name,
    );
  }
  static getIsConnected(_info: any, callback: ReturnCallback) {
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
  static accessToken(info: any, callback: ReturnCallback) {
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
  static loginWithAgoraToken(info: any, callback: ReturnCallback) {
    const userName = info.username;
    const agoraToken = info.token;
    this.tryCatch(
      ChatClient.getInstance().loginWithAgoraToken(userName, agoraToken),
      callback,
      ChatClient.getInstance().loginWithAgoraToken.name,
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

import {ChatClient} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatPresenceManager extends BizBase {
  static publishPresence(info: any, callback: ReturnCallback) {
    const description = info.description;
    this.tryCatch(
      ChatClient.getInstance().presenceManager.publishPresence(description),
      callback,
      ChatClient.getInstance().presenceManager.publishPresence.name,
    );
  }
  static subscribePresences(info: any, callback: ReturnCallback) {
    const members = (info.members as string).split(',');
    const expiry = info.expiry;
    this.tryCatch(
      ChatClient.getInstance().presenceManager.subscribe(members, expiry),
      callback,
      ChatClient.getInstance().presenceManager.subscribe.name,
    );
  }
  static unsubscribePresences(info: any, callback: ReturnCallback) {
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().presenceManager.unSubscribe(members),
      callback,
      ChatClient.getInstance().presenceManager.unSubscribe.name,
    );
  }
  static fetchPresenceStatus(info: any, callback: ReturnCallback) {
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().presenceManager.fetchPresenceStatus(members),
      callback,
      ChatClient.getInstance().presenceManager.fetchPresenceStatus.name,
    );
  }
  static fetchSubscribedMembers(info: any, callback: ReturnCallback) {
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().presenceManager.fetchSubscribedMembers(
        pageNum,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().presenceManager.fetchSubscribedMembers.name,
    );
  }
  static logout(data: any, callback: ReturnCallback): void {
    callback(null);
  }
}

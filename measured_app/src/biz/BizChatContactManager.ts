import {ChatClient, ChatContactEventListener} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatContactManager extends BizBase {
  static getSelfIdsOnOtherPlatform(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().contactManager.getSelfIdsOnOtherPlatform(),
      callback,
      ChatClient.getInstance().contactManager.getSelfIdsOnOtherPlatform.name,
    );
  }
  static addContact(info: any, callback: ReturnCallback) {
    const userId = info.username;
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().contactManager.addContact(userId, reason),
      callback,
      ChatClient.getInstance().contactManager.getSelfIdsOnOtherPlatform.name,
    );
  }
  static deleteContact(info: any, callback: ReturnCallback) {
    const userId = info.username;
    const keepConversation = info.keepConversation;
    this.tryCatch(
      ChatClient.getInstance().contactManager.deleteContact(
        userId,
        keepConversation,
      ),
      callback,
      ChatClient.getInstance().contactManager.deleteContact.name,
    );
  }
  static addUserToBlockList(info: any, callback: ReturnCallback) {
    const userId = info.username;
    this.tryCatch(
      ChatClient.getInstance().contactManager.addUserToBlockList(userId),
      callback,
      ChatClient.getInstance().contactManager.addUserToBlockList.name,
    );
  }
  static removeUserFromBlockList(info: any, callback: ReturnCallback) {
    const userId = info.username;
    this.tryCatch(
      ChatClient.getInstance().contactManager.removeUserFromBlockList(userId),
      callback,
      ChatClient.getInstance().contactManager.removeUserFromBlockList.name,
    );
  }
  static getBlockListFromServer(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().contactManager.getBlockListFromServer(),
      callback,
      ChatClient.getInstance().contactManager.getBlockListFromServer.name,
    );
  }
  static acceptInvitation(info: any, callback: ReturnCallback) {
    const userId = info.username;
    this.tryCatch(
      ChatClient.getInstance().contactManager.acceptInvitation(userId),
      callback,
      ChatClient.getInstance().contactManager.acceptInvitation.name,
    );
  }
  static declineInvitation(info: any, callback: ReturnCallback) {
    const userId = info.username;
    this.tryCatch(
      ChatClient.getInstance().contactManager.declineInvitation(userId),
      callback,
      ChatClient.getInstance().contactManager.declineInvitation.name,
    );
  }
  static getAllContactsFromServer(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().contactManager.getAllContactsFromServer(),
      callback,
      ChatClient.getInstance().contactManager.getAllContactsFromServer.name,
    );
  }
  static getAllContactsFromDB(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().contactManager.getAllContactsFromDB(),
      callback,
      ChatClient.getInstance().contactManager.getAllContactsFromDB.name,
    );
  }
  static addContactManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().contactManager.addContactListener(
      new (class implements ChatContactEventListener {
        onContactAdded(userName: string): void {
          console.log(this.onContactAdded.name, userName);
        }
        onContactDeleted(userName: string): void {
          console.log(this.onContactDeleted.name, userName);
        }
        onContactInvited(userName: string, reason?: string | undefined): void {
          console.log(this.onContactInvited.name, userName, reason);
        }
        onFriendRequestAccepted(userName: string): void {
          console.log(this.onFriendRequestAccepted.name, userName);
        }
        onFriendRequestDeclined(userName: string): void {
          console.log(this.onFriendRequestDeclined.name, userName);
        }
      })(),
    );
    callback(null);
  }
  static removeContactManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().contactManager.removeAllContactListener();
    callback(null);
  }
}

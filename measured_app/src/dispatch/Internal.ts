import {ReturnCallback} from '../RNWS';
import {BizChatClient} from '../biz/BizChatClient';
import {BizChatContactManager} from '../biz/BizChatContactManager';
import {BizChatGroupManager} from '../biz/BizChatGroupManager';
import {BizChatManager} from '../biz/BizChatManager';
import {BizChatRoomManager} from '../biz/BizChatRoomManager';

export function dispatchInternal(
  cmd: string,
  info: any,
  callback: ReturnCallback,
): boolean {
  switch (cmd) {
    case 'init':
      BizChatClient.init(info, callback);
      return true;
    case 'login':
      BizChatClient.login(info, callback);
      return true;
    case 'addConnectionDelegate':
      BizChatClient.addConnectionDelegate(info, callback);
      return true;
    case 'deleteConnectionDelegate':
      BizChatClient.deleteConnectionDelegate(info, callback);
      return true;
    case 'addMultiDeviceDelegate':
      BizChatClient.addMultiDeviceDelegate(info, callback);
      return true;
    case 'deleteMultiDeviceDelegate':
      BizChatClient.deleteMultiDeviceDelegate(info, callback);
      return true;
    case 'addContactManagerDelegate':
      BizChatContactManager.addContactManagerDelegate(info, callback);
      return true;
    case 'removeContactManagerDelegate':
      BizChatContactManager.removeContactManagerDelegate(info, callback);
      return true;
    case 'addChatManagerDelegate':
      BizChatManager.addChatManagerDelegate(info, callback);
      return true;
    case 'removeChatManagerDelegate':
      BizChatManager.removeChatManagerDelegate(info, callback);
      return true;
    case 'addRoomManagerDelegate':
      BizChatRoomManager.addRoomManagerDelegate(info, callback);
      return true;
    case 'removeRoomManagerDelegate':
      BizChatRoomManager.removeRoomManagerDelegate(info, callback);
      return true;
    case 'addGroupManagerDelegate':
      BizChatGroupManager.addGroupManagerDelegate(info, callback);
      return true;
    case 'removeGroupManagerDelegate':
      BizChatGroupManager.removeGroupManagerDelegate(info, callback);
      return true;
    default:
      return false;
  }
}

import {ChatClient, ChatRoomEventListener} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatRoomManager extends BizBase {
  static changeRoomOwner(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const newOwner = info.newOwner;
    this.tryCatch(
      ChatClient.getInstance().roomManager.changeOwner(roomId, newOwner),
      callback,
      ChatClient.getInstance().roomManager.changeOwner.name,
    );
  }
  static changeRoomDescription(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const description = info.newDescription;
    this.tryCatch(
      ChatClient.getInstance().roomManager.changeChatRoomDescription(
        roomId,
        description,
      ),
      callback,
      ChatClient.getInstance().roomManager.changeChatRoomDescription.name,
    );
  }
  static changeRoomName(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const subject = info.newName;
    this.tryCatch(
      ChatClient.getInstance().roomManager.changeChatRoomSubject(
        roomId,
        subject,
      ),
      callback,
      ChatClient.getInstance().roomManager.changeChatRoomSubject.name,
    );
  }
  static createRoom(info: any, callback: ReturnCallback) {
    const subject = info.name;
    const description = info.desc;
    const welcome = info.welcomeMsg;
    const members = (info.members as string).split(',');
    const maxCount = info.maxUserCount;
    this.tryCatch(
      ChatClient.getInstance().roomManager.createChatRoom(
        subject,
        description,
        welcome,
        members,
        maxCount,
      ),
      callback,
      ChatClient.getInstance().roomManager.createChatRoom.name,
    );
  }
  static destroyRoom(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    this.tryCatch(
      ChatClient.getInstance().roomManager.destroyChatRoom(roomId),
      callback,
      ChatClient.getInstance().roomManager.destroyChatRoom.name,
    );
  }
  static fetchPublicRoomsFromServer(info: any, callback: ReturnCallback) {
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().roomManager.fetchPublicChatRoomsFromServer(
        pageNum,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().roomManager.fetchPublicChatRoomsFromServer.name,
    );
  }
  static fetchRoomAnnouncement(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    this.tryCatch(
      ChatClient.getInstance().roomManager.fetchChatRoomAnnouncement(roomId),
      callback,
      ChatClient.getInstance().roomManager.fetchChatRoomAnnouncement.name,
    );
  }
  static fetchRoomBlockList(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().roomManager.fetchChatRoomBlockList(
        roomId,
        pageNum,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().roomManager.fetchChatRoomBlockList.name,
    );
  }
  static fetchRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().roomManager.fetchChatRoomMembers(
        roomId,
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().roomManager.fetchChatRoomMembers.name,
    );
  }
  static fetchRoomMuteList(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().roomManager.fetchChatRoomMuteList(
        roomId,
        pageNum,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().roomManager.fetchChatRoomMembers.name,
    );
  }
  static joinRoom(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    this.tryCatch(
      ChatClient.getInstance().roomManager.joinChatRoom(roomId),
      callback,
      ChatClient.getInstance().roomManager.joinChatRoom.name,
    );
  }
  static leaveRoom(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    this.tryCatch(
      ChatClient.getInstance().roomManager.leaveChatRoom(roomId),
      callback,
      ChatClient.getInstance().roomManager.leaveChatRoom.name,
    );
  }
  static muteRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const muteMembers = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().roomManager.muteChatRoomMembers(
        roomId,
        muteMembers,
      ),
      callback,
      ChatClient.getInstance().roomManager.muteChatRoomMembers.name,
    );
  }
  static removeRoomAdmin(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const admin = info.adminId;
    this.tryCatch(
      ChatClient.getInstance().roomManager.removeChatRoomAdmin(roomId, admin),
      callback,
      ChatClient.getInstance().roomManager.removeChatRoomAdmin.name,
    );
  }
  static deleteRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().roomManager.removeChatRoomMembers(
        roomId,
        members,
      ),
      callback,
      ChatClient.getInstance().roomManager.removeChatRoomMembers.name,
    );
  }
  static unBlockRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().roomManager.unBlockChatRoomMembers(
        roomId,
        members,
      ),
      callback,
      ChatClient.getInstance().roomManager.unBlockChatRoomMembers.name,
    );
  }
  static unMuteRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const unMuteMembers = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().roomManager.unMuteChatRoomMembers(
        roomId,
        unMuteMembers,
      ),
      callback,
      ChatClient.getInstance().roomManager.unBlockChatRoomMembers.name,
    );
  }
  static updateRoomAnnouncement(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const announcement = info.announcement;
    this.tryCatch(
      ChatClient.getInstance().roomManager.updateChatRoomAnnouncement(
        roomId,
        announcement,
      ),
      callback,
      ChatClient.getInstance().roomManager.updateChatRoomAnnouncement.name,
    );
  }
  static addRoomAdmin(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const admin = info.admin;
    this.tryCatch(
      ChatClient.getInstance().roomManager.addChatRoomAdmin(roomId, admin),
      callback,
      ChatClient.getInstance().roomManager.addChatRoomAdmin.name,
    );
  }
  static blockRoomMembers(info: any, callback: ReturnCallback) {
    const roomId = info.roomId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().roomManager.blockChatRoomMembers(
        roomId,
        members,
      ),
      callback,
      ChatClient.getInstance().roomManager.blockChatRoomMembers.name,
    );
  }
  static addRoomManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().roomManager.addRoomListener(
      new (class implements ChatRoomEventListener {
        onChatRoomDestroyed(params: {
          roomId: string;
          roomName?: string | undefined;
        }): void {
          console.log(this.onChatRoomDestroyed.name, params);
        }
        onMemberJoined(params: {roomId: string; participant: string}): void {
          console.log(this.onMemberJoined.name, params);
        }
        onMemberExited(params: {
          roomId: string;
          participant: string;
          roomName?: string | undefined;
        }): void {
          console.log(this.onMemberExited.name, params);
        }
        onRemoved(params: {
          roomId: string;
          participant?: string | undefined;
          roomName?: string | undefined;
        }): void {
          console.log(this.onRemoved.name, params);
        }
        onMuteListAdded(params: {
          roomId: string;
          mutes: string[];
          expireTime?: string | undefined;
        }): void {
          console.log(this.onMuteListAdded.name, params);
        }
        onMuteListRemoved(params: {roomId: string; mutes: string[]}): void {
          console.log(this.onMuteListRemoved.name, params);
        }
        onAdminAdded(params: {roomId: string; admin: string}): void {
          console.log(this.onAdminAdded.name, params);
        }
        onAdminRemoved(params: {roomId: string; admin: string}): void {
          console.log(this.onAdminRemoved.name, params);
        }
        onOwnerChanged(params: {
          roomId: string;
          newOwner: string;
          oldOwner: string;
        }): void {
          console.log(this.onOwnerChanged.name, params);
        }
        onAnnouncementChanged(params: {
          roomId: string;
          announcement: string;
        }): void {
          console.log(this.onAnnouncementChanged.name, params);
        }
        onAllowListAdded(params: {roomId: string; members: string[]}): void {
          console.log(this.onAllowListAdded.name, params);
        }
        onAllowListRemoved(params: {roomId: string; members: string[]}): void {
          console.log(this.onAllowListRemoved.name, params);
        }
        onAllChatRoomMemberMuteStateChanged(params: {
          roomId: string;
          isAllMuted: boolean;
        }): void {
          console.log(this.onAllChatRoomMemberMuteStateChanged.name, params);
        }
      })(),
    );
    callback(null);
  }
  static removeRoomManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().roomManager.removeAllRoomListener();
    callback(null);
  }
}

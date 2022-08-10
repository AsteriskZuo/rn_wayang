import {BizChatClient} from './biz/BizChatClient';
import {BizChatContactManager} from './biz/BizChatContactManager';
import {BizChatGroupManager} from './biz/BizChatGroupManager';
import {BizChatManager} from './biz/BizChatManager';
import {BizChatPresenceManager} from './biz/BizChatPresenceManager';
import {BizChatPushManager} from './biz/BizChatPushManager';
import {BizChatRoomManager} from './biz/BizChatRoomManager';
import {BizChatUserInfoManager} from './biz/BizChatUserInfoManager';
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
    let ret: boolean = true;
    const dataObject = JSON.parse(data);
    const cmd = dataObject.cmd;
    const info = dataObject.info;
    // console.log(`${Dispatch.TAG}: dispatch: `, cmd, info);
    switch (cmd) {
      case 'login': {
        BizChatClient.login(info, callback);
        break;
      }
      case 'logout': {
        BizChatClient.logout(info, callback);
        break;
      }
      case 'sendMessage': {
        BizChatManager.sendMessage(info, callback);
        break;
      }
      case 'fetchGroupReadAcks': {
        BizChatManager.fetchGroupReadAcks(info, callback);
        break;
      }
      case 'translateMessage': {
        BizChatManager.translateMessage(info, callback);
        break;
      }
      case 'fetchSupportLanguages': {
        BizChatManager.fetchSupportLanguages(info, callback);
        break;
      }
      case 'reportMessage': {
        BizChatManager.reportMessage(info, callback);
        break;
      }
      case 'addReaction': {
        BizChatManager.addReaction(info, callback);
        break;
      }
      case 'removeReaction': {
        BizChatManager.removeReaction(info, callback);
        break;
      }
      case 'getReactionList': {
        BizChatManager.getReactionList(info, callback);
        break;
      }
      case 'getReactionDetail': {
        BizChatManager.getReactionDetail(info, callback);
        break;
      }
      case 'publishPresence': {
        BizChatPresenceManager.publishPresence(info, callback);
        break;
      }
      case 'subscribePresences': {
        BizChatPresenceManager.subscribePresences(info, callback);
        break;
      }
      case 'unsubscribePresences': {
        BizChatPresenceManager.unsubscribePresences(info, callback);
        break;
      }
      case 'fetchPresenceStatus': {
        BizChatPresenceManager.fetchPresenceStatus(info, callback);
        break;
      }
      case 'fetchSubscribedMembers': {
        BizChatPresenceManager.fetchSubscribedMembers(info, callback);
        break;
      }
      case 'setSilentModeForAll': {
        BizChatPushManager.setSilentModeForAll(info, callback);
        break;
      }
      case 'setSilentModeForConversation': {
        BizChatPushManager.setSilentModeForConversation(info, callback);
        break;
      }
      case 'setPreferredNotificationLanguage': {
        BizChatPushManager.setPreferredNotificationLanguage(info, callback);
        break;
      }
      case 'getPreferredNotificationLanguage': {
        BizChatPushManager.getPreferredNotificationLanguage(info, callback);
        break;
      }
      case 'createThread': {
        BizChatManager.createThread(info, callback);
        break;
      }
      case 'getThreadWithThreadId': {
        BizChatManager.getThreadWithThreadId(info, callback);
        break;
      }
      case 'getThreadDetail': {
        BizChatManager.getThreadDetail(info, callback);
        break;
      }
      case 'joinThread': {
        BizChatManager.joinThread(info, callback);
        break;
      }
      case 'leaveThread': {
        BizChatManager.leaveThread(info, callback);
        break;
      }
      case 'destoryThread': {
        BizChatManager.destoryThread(info, callback);
        break;
      }
      case 'removeThreadMember': {
        BizChatManager.removeThreadMember(info, callback);
        break;
      }
      case 'changeThreadSubject': {
        BizChatManager.changeThreadSubject(info, callback);
        break;
      }
      case 'fetchThreadMembers': {
        BizChatManager.fetchThreadMembers(info, callback);
        break;
      }
      case 'fetchThreadListOfGroup': {
        BizChatManager.fetchThreadListOfGroup(info, callback);
        break;
      }
      case 'fetchMineJoinedThreadList': {
        BizChatManager.fetchMineJoinedThreadList(info, callback);
        break;
      }
      case 'getLastMessageAccordingThreads': {
        BizChatManager.getLastMessageAccordingThreads(info, callback);
        break;
      }
      case 'getCurrentUserName': {
        BizChatClient.getCurrentUserName(info, callback);
        break;
      }
      case 'getIsConnected': {
        BizChatClient.getIsConnected(info, callback);
        break;
      }
      case 'getImSdkVersion': {
        BizChatClient.getImSdkVersion(info, callback);
        break;
      }
      case 'getIsLoggedIn': {
        BizChatClient.getIsLoggedIn(info, callback);
        break;
      }
      case 'accessToken': {
        BizChatClient.accessToken(info, callback);
        break;
      }
      case 'accessToken': {
        BizChatClient.accessToken(info, callback);
        break;
      }
      case 'lastReceivedMessage': {
        BizChatManager.lastReceivedMessage(info, callback);
        break;
      }
      case 'setExt': {
        BizChatManager.setExt(info, callback);
        break;
      }
      case 'getExt': {
        BizChatManager.getExt(info, callback);
        break;
      }
      case 'markMessageAsRead': {
        BizChatManager.markMessageAsRead(info, callback);
        break;
      }
      case 'unReadCount': {
        BizChatManager.unReadCount(info, callback);
        break;
      }
      case 'markAllMessageAsRead': {
        BizChatManager.markAllMessageAsRead(info, callback);
        break;
      }
      case 'insertMessage': {
        BizChatManager.insertMessage(info, callback);
        break;
      }
      case 'appendMessage': {
        BizChatManager.appendMessage(info, callback);
        break;
      }
      case 'updateMessage': {
        BizChatManager.updateMessage(info, callback);
        break;
      }
      case 'deleteMessage': {
        BizChatManager.deleteMessage(info, callback);
        break;
      }
      case 'deleteAllMessages': {
        BizChatManager.deleteAllMessages(info, callback);
        break;
      }
      case 'loadMessage': {
        BizChatManager.loadMessage(info, callback);
        break;
      }
      case 'loadMessagesWithMsgType': {
        BizChatManager.loadMessagesWithMsgType(info, callback);
        break;
      }
      case 'loadMessages': {
        BizChatManager.loadMessages(info, callback);
        break;
      }
      case 'loadMessagesWithKeyword': {
        BizChatManager.loadMessagesWithKeyword(info, callback);
        break;
      }
      case 'loadMessagesWithTime': {
        BizChatManager.loadMessagesWithTime(info, callback);
        break;
      }
      case 'messagesCount': {
        BizChatManager.messagesCount(info, callback);
        break;
      }
      case 'deleteConversation': {
        BizChatManager.deleteConversation(info, callback);
        break;
      }
      case 'downloadAttachment': {
        BizChatManager.downloadAttachment(info, callback);
        break;
      }
      case 'downloadThumbnail': {
        BizChatManager.downloadThumbnail(info, callback);
        break;
      }
      case 'loadChatMessage': {
        BizChatManager.loadChatMessage(info, callback);
        break;
      }
      case 'markAllConversationsAsRead': {
        BizChatManager.markAllConversationsAsRead(info, callback);
        break;
      }
      case 'recallMessage': {
        BizChatManager.recallMessage(info, callback);
        break;
      }
      case 'resendMessage': {
        BizChatManager.resendMessage(info, callback);
        break;
      }
      case 'importMessages': {
        BizChatManager.importMessages(info, callback);
        break;
      }
      case 'lastMessage': {
        BizChatManager.lastMessage(info, callback);
        break;
      }
      case 'getUnreadMessageCount': {
        BizChatManager.getUnreadMessageCount(info, callback);
        break;
      }
      case 'sendMessageReadAck': {
        BizChatManager.sendMessageReadAck(info, callback);
        break;
      }
      case 'updateChatMessage': {
        BizChatManager.updateChatMessage(info, callback);
        break;
      }
      case 'removeMessagesBeforeTimestamp': {
        BizChatManager.removeMessagesBeforeTimestamp(info, callback);
        break;
      }
      case 'fetchHistoryMessagesFromServer': {
        BizChatManager.fetchHistoryMessagesFromServer(info, callback);
        break;
      }
      case 'getConversationsFromServer': {
        BizChatManager.getConversationsFromServer(info, callback);
        break;
      }
      case 'deleteConversationFromServer': {
        BizChatManager.deleteConversationFromServer(info, callback);
        break;
      }
      case 'getConversation': {
        BizChatManager.getConversation(info, callback);
        break;
      }
      case 'loadAllConversations': {
        BizChatManager.loadAllConversations(info, callback);
        break;
      }
      case 'loadAllConversations': {
        BizChatManager.loadAllConversations(info, callback);
        break;
      }
      case 'createGroup': {
        BizChatGroupManager.createGroup(info, callback);
        break;
      }
      case 'leaveGroup': {
        BizChatGroupManager.leaveGroup(info, callback);
        break;
      }
      case 'destroyGroup': {
        BizChatGroupManager.destroyGroup(info, callback);
        break;
      }
      case 'getGroupFileListFromServer': {
        BizChatGroupManager.getGroupFileListFromServer(info, callback);
        break;
      }
      case 'uploadGroupSharedFile': {
        BizChatGroupManager.uploadGroupSharedFile(info, callback);
        break;
      }
      case 'downloadGroupSharedFile': {
        BizChatGroupManager.downloadGroupSharedFile(info, callback);
        break;
      }
      case 'deleteGroupSharedFile': {
        BizChatGroupManager.deleteGroupSharedFile(info, callback);
        break;
      }
      case 'changeGroupName': {
        BizChatGroupManager.changeGroupName(info, callback);
        break;
      }
      case 'updateGroupAnnouncement': {
        BizChatGroupManager.updateGroupAnnouncement(info, callback);
        break;
      }
      case 'changeGroupDescription': {
        BizChatGroupManager.changeGroupDescription(info, callback);
        break;
      }
      case 'updateGroupExt': {
        BizChatGroupManager.updateGroupExt(info, callback);
        break;
      }
      case 'getGroupAnnouncementFromServer': {
        BizChatGroupManager.getGroupAnnouncementFromServer(info, callback);
        break;
      }
      case 'getGroupMemberListFromServer': {
        BizChatGroupManager.getGroupMemberListFromServer(info, callback);
        break;
      }
      case 'fetchPublicGroupsFromServer': {
        BizChatGroupManager.fetchPublicGroupsFromServer(info, callback);
        break;
      }
      case 'getGroupSpecificationFromServer': {
        BizChatGroupManager.getGroupSpecificationFromServer(info, callback);
        break;
      }
      case 'applyJoinToGroup': {
        BizChatGroupManager.applyJoinToGroup(info, callback);
        break;
      }
      case 'joinPublicGroup': {
        BizChatGroupManager.joinPublicGroup(info, callback);
        break;
      }
      case 'acceptGroupInvitation': {
        BizChatGroupManager.acceptGroupInvitation(info, callback);
        break;
      }
      case 'acceptGroupJoinApplication': {
        BizChatGroupManager.acceptGroupJoinApplication(info, callback);
        break;
      }
      case 'declineGroupInvitation': {
        BizChatGroupManager.declineGroupInvitation(info, callback);
        break;
      }
      case 'declineGroupJoinApplication': {
        BizChatGroupManager.declineGroupJoinApplication(info, callback);
        break;
      }
      case 'changeGroupOwner': {
        BizChatGroupManager.changeGroupOwner(info, callback);
        break;
      }
      case 'addGroupAdmin': {
        BizChatGroupManager.addGroupAdmin(info, callback);
        break;
      }
      case 'removeGroupAdmin': {
        BizChatGroupManager.removeGroupAdmin(info, callback);
        break;
      }
      case 'addGroupMembers': {
        BizChatGroupManager.addGroupMembers(info, callback);
        break;
      }
      case 'deleteGroupMembers': {
        BizChatGroupManager.deleteGroupMembers(info, callback);
        break;
      }
      case 'blockGroupMembers': {
        BizChatGroupManager.blockGroupMembers(info, callback);
        break;
      }
      case 'getGroupBlockListFromServer': {
        BizChatGroupManager.getGroupBlockListFromServer(info, callback);
        break;
      }
      case 'unBlockGroupMembers': {
        BizChatGroupManager.unBlockGroupMembers(info, callback);
        break;
      }
      case 'getGroupMuteListFromServer': {
        BizChatGroupManager.getGroupMuteListFromServer(info, callback);
        break;
      }
      case 'unMuteGroupMembers': {
        BizChatGroupManager.unMuteGroupMembers(info, callback);
        break;
      }
      case 'muteGroupMembers': {
        BizChatGroupManager.muteGroupMembers(info, callback);
        break;
      }
      case 'muteGroupAllMembers': {
        BizChatGroupManager.muteGroupAllMembers(info, callback);
        break;
      }
      case 'unMuteGroupAllMembers': {
        BizChatGroupManager.unMuteGroupAllMembers(info, callback);
        break;
      }
      case 'checkIfInGroupWhiteList': {
        BizChatGroupManager.checkIfInGroupWhiteList(info, callback);
        break;
      }
      case 'getGroupWhiteListFromServer': {
        BizChatGroupManager.getGroupWhiteListFromServer(info, callback);
        break;
      }
      case 'addGroupWhiteList': {
        BizChatGroupManager.addGroupWhiteList(info, callback);
        break;
      }
      case 'removeGroupWhiteList': {
        BizChatGroupManager.removeGroupWhiteList(info, callback);
        break;
      }
      case 'blockGroup': {
        BizChatGroupManager.blockGroup(info, callback);
        break;
      }
      case 'unBlockGroup': {
        BizChatGroupManager.unBlockGroup(info, callback);
        break;
      }
      case 'fetchJoinedGroupsFromServer': {
        BizChatGroupManager.fetchJoinedGroupsFromServer(info, callback);
        break;
      }
      case 'getGroupWithId': {
        BizChatGroupManager.getGroupWithId(info, callback);
        break;
      }
      case 'getJoinedGroups': {
        BizChatGroupManager.getJoinedGroups(info, callback);
        break;
      }
      case 'renewAgoraToken': {
        BizChatClient.renewAgoraToken(info, callback);
        break;
      }
      case 'loginWithAgoraToken': {
        BizChatClient.loginWithAgoraToken(info, callback);
        break;
      }
      case 'getNoDisturbGroups': {
        BizChatPushManager.getNoDisturbGroups(info, callback);
        break;
      }
      case 'getPushConfigFromServer': {
        BizChatPushManager.getPushConfigFromServer(info, callback);
        break;
      }
      case 'getPushConfig': {
        BizChatPushManager.getPushConfig(info, callback);
        break;
      }
      case 'updatePushNickName': {
        BizChatPushManager.updatePushNickName(info, callback);
        break;
      }
      case 'updateHMSPushToken': {
        BizChatPushManager.updateHMSPushToken(info, callback);
        break;
      }
      case 'updateFCMPushToken': {
        BizChatPushManager.updateFCMPushToken(info, callback);
        break;
      }
      case 'updateAPNSPushToken': {
        BizChatPushManager.updateAPNSPushToken(info, callback);
        break;
      }
      case 'setNoDisturb': {
        BizChatPushManager.setNoDisturb(info, callback);
        break;
      }
      case 'setGroupToDisturb': {
        BizChatPushManager.setGroupToDisturb(info, callback);
        break;
      }
      case 'setPushStyle': {
        BizChatPushManager.setPushStyle(info, callback);
        break;
      }
      case 'changeRoomOwner': {
        BizChatRoomManager.changeRoomOwner(info, callback);
        break;
      }
      case 'changeRoomDescription': {
        BizChatRoomManager.changeRoomDescription(info, callback);
        break;
      }
      case 'changeRoomName': {
        BizChatRoomManager.changeRoomName(info, callback);
        break;
      }
      case 'createRoom': {
        BizChatRoomManager.createRoom(info, callback);
        break;
      }
      case 'destroyRoom': {
        BizChatRoomManager.destroyRoom(info, callback);
        break;
      }
      case 'fetchPublicRoomsFromServer': {
        BizChatRoomManager.fetchPublicRoomsFromServer(info, callback);
        break;
      }
      case 'fetchRoomAnnouncement': {
        BizChatRoomManager.fetchRoomAnnouncement(info, callback);
        break;
      }
      case 'fetchRoomBlockList': {
        BizChatRoomManager.fetchRoomBlockList(info, callback);
        break;
      }
      case 'fetchRoomMembers': {
        BizChatRoomManager.fetchRoomMembers(info, callback);
        break;
      }
      case 'fetchRoomMuteList': {
        BizChatRoomManager.fetchRoomMuteList(info, callback);
        break;
      }
      case 'joinRoom': {
        BizChatRoomManager.joinRoom(info, callback);
        break;
      }
      case 'leaveRoom': {
        BizChatRoomManager.leaveRoom(info, callback);
        break;
      }
      case 'muteRoomMembers': {
        BizChatRoomManager.muteRoomMembers(info, callback);
        break;
      }
      case 'removeRoomAdmin': {
        BizChatRoomManager.removeRoomAdmin(info, callback);
        break;
      }
      case 'deleteRoomMembers': {
        BizChatRoomManager.deleteRoomMembers(info, callback);
        break;
      }
      case 'unBlockRoomMembers': {
        BizChatRoomManager.unBlockRoomMembers(info, callback);
        break;
      }
      case 'unMuteRoomMembers': {
        BizChatRoomManager.unMuteRoomMembers(info, callback);
        break;
      }
      case 'updateRoomAnnouncement': {
        BizChatRoomManager.updateRoomAnnouncement(info, callback);
        break;
      }
      case 'addRoomAdmin': {
        BizChatRoomManager.addRoomAdmin(info, callback);
        break;
      }
      case 'blockRoomMembers': {
        BizChatRoomManager.blockRoomMembers(info, callback);
        break;
      }
      case 'createAccount': {
        BizChatClient.createAccount(info, callback);
        break;
      }
      case 'addContact': {
        BizChatContactManager.addContact(info, callback);
        break;
      }
      case 'deleteContact': {
        BizChatContactManager.deleteContact(info, callback);
        break;
      }
      case 'fetchUserInfoByUserId': {
        BizChatUserInfoManager.fetchUserInfoByUserId(info, callback);
        break;
      }
      case 'addUserToBlockList': {
        BizChatContactManager.addUserToBlockList(info, callback);
        break;
      }
      case 'removeUserFromBlockList': {
        BizChatContactManager.removeUserFromBlockList(info, callback);
        break;
      }
      case 'getBlockListFromServer': {
        BizChatContactManager.getBlockListFromServer(info, callback);
        break;
      }
      case 'acceptInvitation': {
        BizChatContactManager.acceptInvitation(info, callback);
        break;
      }
      case 'declineInvitation': {
        BizChatContactManager.declineInvitation(info, callback);
        break;
      }
      case 'getAllContactsFromServer': {
        BizChatContactManager.getAllContactsFromServer(info, callback);
        break;
      }
      case 'getAllContactsFromDB': {
        BizChatContactManager.getAllContactsFromDB(info, callback);
        break;
      }
      case 'getSelfIdsOnOtherPlatform': {
        BizChatContactManager.getSelfIdsOnOtherPlatform(info, callback);
        break;
      }
      case 'updateOwnInfo': {
        BizChatUserInfoManager.updateOwnInfo(info, callback);
        break;
      }
      case 'addConnectionDelegate': {
        BizChatClient.addConnectionDelegate(info, callback);
        break;
      }
      case 'deleteConnectionDelegate': {
        BizChatClient.deleteConnectionDelegate(info, callback);
        break;
      }
      case 'addMultiDeviceDelegate': {
        BizChatClient.addMultiDeviceDelegate(info, callback);
        break;
      }
      case 'deleteMultiDeviceDelegate': {
        BizChatClient.deleteMultiDeviceDelegate(info, callback);
        break;
      }
      case 'addContactManagerDelegate': {
        BizChatContactManager.addContactManagerDelegate(info, callback);
        break;
      }
      case 'removeContactManagerDelegate': {
        BizChatContactManager.removeContactManagerDelegate(info, callback);
        break;
      }
      case 'addChatManagerDelegate': {
        BizChatManager.addChatManagerDelegate(info, callback);
        break;
      }
      case 'removeChatManagerDelegate': {
        BizChatManager.removeChatManagerDelegate(info, callback);
        break;
      }
      case 'addRoomManagerDelegate': {
        BizChatRoomManager.addRoomManagerDelegate(info, callback);
        break;
      }
      case 'removeRoomManagerDelegate': {
        BizChatRoomManager.removeRoomManagerDelegate(info, callback);
        break;
      }
      case 'addGroupManagerDelegate': {
        BizChatGroupManager.addGroupManagerDelegate(info, callback);
        break;
      }
      case 'removeGroupManagerDelegate': {
        BizChatGroupManager.removeGroupManagerDelegate(info, callback);
        break;
      }

      default:
        ret = false;
        break;
    }
    return ret;
  }
}

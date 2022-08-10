import {
  ChatClient,
  ChatGroupEventListener,
  ChatGroupOptions,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatGroupManager extends BizBase {
  static createGroup(info: any, callback: ReturnCallback) {
    const style = info.style;
    const maxCount = info.maxCount;
    const inviteNeedConfirm = info.inviteNeedConfirm;
    const ext = info.ext;
    const options = new ChatGroupOptions({
      style: style,
      maxCount: maxCount,
      inviteNeedConfirm: inviteNeedConfirm,
      ext: ext,
    });
    const groupName = info.groupName;
    const desc = info.desc;
    const inviteMembers = (info.members as string).split(',');
    const inviteReason = info.inviteReason;

    this.tryCatch(
      ChatClient.getInstance().groupManager.createGroup(
        options,
        groupName,
        desc,
        inviteMembers,
        inviteReason,
      ),
      callback,
      ChatClient.getInstance().groupManager.createGroup.name,
    );
  }
  static leaveGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.leaveGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.leaveGroup.name,
    );
  }
  static destroyGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.destroyGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.destroyGroup.name,
    );
  }
  static getGroupFileListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchGroupFileListFromServer(
        groupId,
        pageSize,
        pageNum,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchGroupFileListFromServer.name,
    );
  }
  // todo: more timeout. modify jmeter timeout set.
  static uploadGroupSharedFile(info: any, callback: ReturnCallback) {
    callback(null);
    return;
    // const groupId_ = info.groupId;
    // const filePath_ = info.filePath; // todo:
    // this.tryCatch(
    //   ChatClient.getInstance().groupManager.uploadGroupSharedFile(
    //     groupId_,
    //     filePath_,
    //     new (class implements ChatGroupFileStatusCallback {
    //       onProgress(
    //         groupId: string,
    //         filePath: string,
    //         progress: number,
    //       ): void {
    //         console.log(this.onProgress.name, groupId, filePath, progress);
    //       }
    //       onError(groupId: string, filePath: string, error: ChatError): void {
    //         console.log(this.onError.name, groupId, filePath, error);
    //         callback(error);
    //       }
    //       onSuccess(groupId: string, filePath: string): void {
    //         console.log(this.onSuccess.name, groupId, filePath);
    //         callback(null);
    //       }
    //     })(),
    //   ),
    //   undefined,
    //   ChatClient.getInstance().groupManager.uploadGroupSharedFile.name,
    // );
  }
  // todo: more timeout. modify jmeter timeout set.
  static downloadGroupSharedFile(info: any, callback: ReturnCallback) {
    callback(null);
    return;
    // const groupId_ = info.groupId;
    // const fileId_ = info.fileId;
    // const savePath_ = info.savePath; // todo:
    // this.tryCatch(
    //   ChatClient.getInstance().groupManager.downloadGroupSharedFile(
    //     groupId_,
    //     fileId_,
    //     savePath_,
    //     new (class implements ChatGroupFileStatusCallback {
    //       onProgress(
    //         groupId: string,
    //         filePath: string,
    //         progress: number,
    //       ): void {
    //         console.log(this.onProgress.name, groupId, filePath, progress);
    //       }
    //       onError(groupId: string, filePath: string, error: ChatError): void {
    //         console.log(this.onError.name, groupId, filePath, error);
    //         callback(error);
    //       }
    //       onSuccess(groupId: string, filePath: string): void {
    //         console.log(this.onSuccess.name, groupId, filePath);
    //         callback(null);
    //       }
    //     })(),
    //   ),
    //   undefined,
    //   ChatClient.getInstance().groupManager.downloadGroupSharedFile.name,
    // );
  }
  static deleteGroupSharedFile(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const fileId = info.fileId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeGroupSharedFile(
        groupId,
        fileId,
      ),
      callback,
      ChatClient.getInstance().groupManager.removeGroupSharedFile.name,
    );
  }
  static changeGroupName(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const groupName = info.name;
    this.tryCatch(
      ChatClient.getInstance().groupManager.changeGroupName(groupId, groupName),
      callback,
      ChatClient.getInstance().groupManager.changeGroupName.name,
    );
  }
  static updateGroupAnnouncement(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const announcement = info.announcement;
    this.tryCatch(
      ChatClient.getInstance().groupManager.updateGroupAnnouncement(
        groupId,
        announcement,
      ),
      callback,
      ChatClient.getInstance().groupManager.updateGroupAnnouncement.name,
    );
  }
  static changeGroupDescription(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const description = info.desc;
    this.tryCatch(
      ChatClient.getInstance().groupManager.changeGroupDescription(
        groupId,
        description,
      ),
      callback,
      ChatClient.getInstance().groupManager.changeGroupDescription.name,
    );
  }
  static updateGroupExt(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const extension = info.ext;
    this.tryCatch(
      ChatClient.getInstance().groupManager.updateGroupExtension(
        groupId,
        extension,
      ),
      callback,
      ChatClient.getInstance().groupManager.updateGroupExtension.name,
    );
  }
  static getGroupAnnouncementFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchAnnouncementFromServer(
        groupId,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchAnnouncementFromServer.name,
    );
  }
  static getGroupMemberListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const pageSize = info.pageSize;
    const cursor = info.cursor;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchMemberListFromServer(
        groupId,
        pageSize,
        cursor,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchMemberListFromServer.name,
    );
  }
  static fetchPublicGroupsFromServer(info: any, callback: ReturnCallback) {
    const pageSize = info.pageSize;
    const cursor = info.cursor;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchPublicGroupsFromServer(
        pageSize,
        cursor,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchPublicGroupsFromServer.name,
    );
  }
  static getGroupSpecificationFromServer(info: any, callback: ReturnCallback) {
    // todo:: no isFetchMembers, modify jmeter
    const groupId = info.groupId;
    const isFetchMembers = info.isFetchMembers ?? true;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchGroupInfoFromServer(
        groupId,
        isFetchMembers,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchGroupInfoFromServer.name,
    );
  }
  static applyJoinToGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().groupManager.requestToJoinPublicGroup(
        groupId,
        reason,
      ),
      callback,
      ChatClient.getInstance().groupManager.requestToJoinPublicGroup.name,
    );
  }
  static joinPublicGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.joinPublicGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.joinPublicGroup.name,
    );
  }
  static acceptGroupInvitation(info: any, callback: ReturnCallback) {
    // todo: no inviter, modify jmeter
    const groupId = info.groupId;
    const inviter = info.inviter ?? '';
    this.tryCatch(
      ChatClient.getInstance().groupManager.acceptInvitation(groupId, inviter),
      callback,
      ChatClient.getInstance().groupManager.acceptInvitation.name,
    );
  }
  static acceptGroupJoinApplication(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const username = info.username;
    this.tryCatch(
      ChatClient.getInstance().groupManager.acceptJoinApplication(
        groupId,
        username,
      ),
      callback,
      ChatClient.getInstance().groupManager.acceptJoinApplication.name,
    );
  }
  static declineGroupInvitation(info: any, callback: ReturnCallback) {
    // todo: no inviter, modify jmeter
    const groupId = info.groupId;
    const inviter = info.inviter ?? '';
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().groupManager.declineInvitation(
        groupId,
        inviter,
        reason,
      ),
      callback,
      ChatClient.getInstance().groupManager.declineInvitation.name,
    );
  }
  static declineGroupJoinApplication(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const username = info.username;
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().groupManager.declineJoinApplication(
        groupId,
        username,
        reason,
      ),
      callback,
      ChatClient.getInstance().groupManager.declineJoinApplication.name,
    );
  }
  static changeGroupOwner(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const newOwner = info.newOwner;
    this.tryCatch(
      ChatClient.getInstance().groupManager.changeOwner(groupId, newOwner),
      callback,
      ChatClient.getInstance().groupManager.changeOwner.name,
    );
  }
  static addGroupAdmin(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const admin = info.memberId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.addAdmin(groupId, admin),
      callback,
      ChatClient.getInstance().groupManager.addAdmin.name,
    );
  }
  static removeGroupAdmin(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const admin = info.memberId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeAdmin(groupId, admin),
      callback,
      ChatClient.getInstance().groupManager.removeAdmin.name,
    );
  }
  static addGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    const welcome = info.welcome ?? '';
    this.tryCatch(
      ChatClient.getInstance().groupManager.addMembers(
        groupId,
        members,
        welcome,
      ),
      callback,
      ChatClient.getInstance().groupManager.addMembers.name,
    );
  }
  static deleteGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.removeMembers.name,
    );
  }
  static blockGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.blockMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.blockMembers.name,
    );
  }
  static getGroupBlockListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const pageSize = info.pageSize;
    const pageNum = info.pageNum;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchBlockListFromServer(
        groupId,
        pageSize,
        pageNum,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchBlockListFromServer.name,
    );
  }
  static unBlockGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.unblockMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.unblockMembers.name,
    );
  }
  static getGroupMuteListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const pageSize = info.pageSize;
    const pageNum = info.pageNum;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchMuteListFromServer(
        groupId,
        pageSize,
        pageNum,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchMuteListFromServer.name,
    );
  }
  static unMuteGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.unMuteMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.unMuteMembers.name,
    );
  }
  static muteGroupMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.muteMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.muteMembers.name,
    );
  }
  static muteGroupAllMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.muteAllMembers(groupId),
      callback,
      ChatClient.getInstance().groupManager.muteAllMembers.name,
    );
  }
  static unMuteGroupAllMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.unMuteAllMembers(groupId),
      callback,
      ChatClient.getInstance().groupManager.unMuteAllMembers.name,
    );
  }
  static checkIfInGroupWhiteList(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.isMemberInAllowListFromServer(
        groupId,
      ),
      callback,
      ChatClient.getInstance().groupManager.isMemberInAllowListFromServer.name,
    );
  }
  static getGroupWhiteListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchAllowListFromServer(groupId),
      callback,
      ChatClient.getInstance().groupManager.fetchAllowListFromServer.name,
    );
  }
  static addGroupWhiteList(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.addAllowList(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.addAllowList.name,
    );
  }
  static removeGroupWhiteList(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = (info.members as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeAllowList(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.removeAllowList.name,
    );
  }
  static blockGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.blockGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.blockGroup.name,
    );
  }
  static unBlockGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.unblockGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.unblockGroup.name,
    );
  }
  static getGroupWithId(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const isFetchMembers = info.isFetchMembers ?? true;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchGroupInfoFromServer(
        groupId,
        isFetchMembers,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchGroupInfoFromServer.name,
    );
  }
  static getJoinedGroups(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().groupManager.getJoinedGroups(),
      callback,
      ChatClient.getInstance().groupManager.getJoinedGroups.name,
    );
  }
  static fetchJoinedGroupsFromServer(info: any, callback: ReturnCallback) {
    const pageNum = info.pageNum;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchJoinedGroupsFromServer(
        pageSize,
        pageNum,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchJoinedGroupsFromServer.name,
    );
  }
  static addGroupManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().groupManager.addGroupListener(
      new (class implements ChatGroupEventListener {
        onInvitationReceived(params: {
          groupId: string;
          inviter: string;
          groupName?: string | undefined;
          reason?: string | undefined;
        }): void {
          console.log(this.onInvitationReceived.name, params);
        }
        onRequestToJoinReceived(params: {
          groupId: string;
          applicant: string;
          groupName?: string | undefined;
          reason?: string | undefined;
        }): void {
          console.log(this.onRequestToJoinReceived.name, params);
        }
        onRequestToJoinAccepted(params: {
          groupId: string;
          accepter: string;
          groupName?: string | undefined;
        }): void {
          console.log(this.onRequestToJoinAccepted.name, params);
        }
        onRequestToJoinDeclined(params: {
          groupId: string;
          decliner: string;
          groupName?: string | undefined;
          reason?: string | undefined;
        }): void {
          console.log(this.onRequestToJoinDeclined.name, params);
        }
        onInvitationAccepted(params: {
          groupId: string;
          invitee: string;
          reason?: string | undefined;
        }): void {
          console.log(this.onInvitationAccepted.name, params);
        }
        onInvitationDeclined(params: {
          groupId: string;
          invitee: string;
          reason?: string | undefined;
        }): void {
          console.log(this.onInvitationDeclined.name, params);
        }
        onUserRemoved(params: {
          groupId: string;
          groupName?: string | undefined;
        }): void {
          console.log(this.onUserRemoved.name, params);
        }
        onGroupDestroyed(params: {
          groupId: string;
          groupName?: string | undefined;
        }): void {
          console.log(this.onGroupDestroyed.name, params);
        }
        onAutoAcceptInvitation(params: {
          groupId: string;
          inviter: string;
          inviteMessage?: string | undefined;
        }): void {
          console.log(this.onAutoAcceptInvitation.name, params);
        }
        onMuteListAdded(params: {
          groupId: string;
          mutes: string[];
          muteExpire?: number | undefined;
        }): void {
          console.log(this.onMuteListAdded.name, params);
        }
        onMuteListRemoved(params: {groupId: string; mutes: string[]}): void {
          console.log(this.onMuteListRemoved.name, params);
        }
        onAdminAdded(params: {groupId: string; admin: string}): void {
          console.log(this.onAdminAdded.name, params);
        }
        onAdminRemoved(params: {groupId: string; admin: string}): void {
          console.log(this.onAdminRemoved.name, params);
        }
        onOwnerChanged(params: {
          groupId: string;
          newOwner: string;
          oldOwner: string;
        }): void {
          console.log(this.onOwnerChanged.name, params);
        }
        onMemberJoined(params: {groupId: string; member: string}): void {
          console.log(this.onMemberJoined.name, params);
        }
        onMemberExited(params: {groupId: string; member: string}): void {
          console.log(this.onMemberExited.name, params);
        }
        onAnnouncementChanged(params: {
          groupId: string;
          announcement: string;
        }): void {
          console.log(this.onAnnouncementChanged.name, params);
        }
        onSharedFileAdded(params: {groupId: string; sharedFile: string}): void {
          console.log(this.onSharedFileAdded.name, params);
        }
        onSharedFileDeleted(params: {groupId: string; fileId: string}): void {
          console.log(this.onSharedFileDeleted.name, params);
        }
        onAllowListAdded(params: {groupId: string; members: string[]}): void {
          console.log(this.onAllowListAdded.name, params);
        }
        onAllowListRemoved(params: {groupId: string; members: string[]}): void {
          console.log(this.onAllowListRemoved.name, params);
        }
        onAllGroupMemberMuteStateChanged(params: {
          groupId: string;
          isAllMuted: boolean;
        }): void {
          console.log(this.onAllGroupMemberMuteStateChanged.name, params);
        }
      })(),
    );
    callback(null);
  }
  static removeGroupManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().groupManager.removeAllGroupListener();
    callback(null);
  }
}

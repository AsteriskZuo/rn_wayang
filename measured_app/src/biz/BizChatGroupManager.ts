import {
  ChatClient,
  ChatGroupEventListener,
  ChatGroupOptions,
} from 'react-native-chat-sdk';
import type {ChatError, ChatGroupFileStatusCallback} from 'react-native-chat-sdk';
import {FileHelper} from '../FileHelper';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatGroupManager extends BizBase {
  static createOneShotCallback(callback: ReturnCallback): ReturnCallback {
    let called = false;
    return value => {
      if (called) {
        return;
      }
      called = true;
      callback(value);
    };
  }

  static async resolveUploadFilePath(info: any): Promise<string> {
    if (info.filePath !== undefined) {
      return info.filePath;
    }
    if (info.fixtureName !== undefined) {
      const fixture = await FileHelper.materializeFixture(info.fixtureName);
      return fixture.filePath;
    }
    console.error('uploadGroupSharedFile missing file path', {
      groupId: info.groupId,
    });
    return '';
  }

  static async resolveDownloadSavePath(info: any): Promise<string> {
    if (info.savePath !== undefined) {
      return info.savePath;
    }
    if (info.saveFilename !== undefined) {
      const writablePath = await FileHelper.createWritablePath(
        info.saveFilename,
      );
      return writablePath.savePath;
    }
    console.error('downloadGroupSharedFile missing save path', {
      groupId: info.groupId,
      fileId: info.fileId,
    });
    return '';
  }

  static createGroupFileStatusCallback(
    callback: ReturnCallback,
  ): ChatGroupFileStatusCallback {
    const oneShotCallback = this.createOneShotCallback(callback);
    return {
      onProgress(groupId: string, filePath: string, progress: number): void {
        console.log(this.onProgress?.name, groupId, filePath, progress);
      },
      onError(groupId: string, filePath: string, error: ChatError): void {
        console.log(this.onError.name, groupId, filePath, error);
        oneShotCallback(error);
      },
      onSuccess(groupId: string, filePath: string): void {
        console.log(this.onSuccess.name, groupId, filePath);
        oneShotCallback(null);
      },
    };
  }

  static splitList(value: any): string[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.length > 0) {
      return value.split(',');
    }
    return [];
  }

  static createGroupOptions(info: any): ChatGroupOptions {
    return new ChatGroupOptions({
      style: info.style,
      maxCount: info.maxCount,
      inviteNeedConfirm: info.inviteNeedConfirm,
      ext: info.ext,
    });
  }

  static createAttributes(value: any): Record<string, string> {
    if (typeof value === 'string' && value.length > 0) {
      return JSON.parse(value);
    }
    return value ?? {};
  }

  static createGroupEx(info: any, callback: ReturnCallback) {
    const options = this.createGroupOptions(info);
    const groupName = info.groupName;
    const groupAvatar = info.groupAvatar;
    const desc = info.desc;
    const inviteMembers = this.splitList(info.members);
    const inviteReason = info.inviteReason;

    this.tryCatch(
      ChatClient.getInstance().groupManager.createGroupEx({
        options,
        groupName,
        groupAvatar,
        desc,
        inviteMembers,
        inviteReason,
      }),
      callback,
      ChatClient.getInstance().groupManager.createGroupEx.name,
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
  static fetchGroupFileListFromServer(info: any, callback: ReturnCallback) {
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
  static async uploadGroupSharedFile(info: any, callback: ReturnCallback) {
    const oneShotCallback = this.createOneShotCallback(callback);
    try {
      const groupId = info.groupId;
      const filePath = await this.resolveUploadFilePath(info);
      await ChatClient.getInstance().groupManager.uploadGroupSharedFile(
        groupId,
        filePath,
        this.createGroupFileStatusCallback(oneShotCallback),
      );
    } catch (error) {
      oneShotCallback(error);
    }
  }
  // todo: more timeout. modify jmeter timeout set.
  static async downloadGroupSharedFile(info: any, callback: ReturnCallback) {
    const oneShotCallback = this.createOneShotCallback(callback);
    try {
      const groupId = info.groupId;
      const fileId = info.fileId;
      const savePath = await this.resolveDownloadSavePath(info);
      await ChatClient.getInstance().groupManager.downloadGroupSharedFile(
        groupId,
        fileId,
        savePath,
        this.createGroupFileStatusCallback(oneShotCallback),
      );
    } catch (error) {
      oneShotCallback(error);
    }
  }
  static removeGroupSharedFile(info: any, callback: ReturnCallback) {
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
  static updateGroupExtension(info: any, callback: ReturnCallback) {
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
  static fetchAnnouncementFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchAnnouncementFromServer(
        groupId,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchAnnouncementFromServer.name,
    );
  }
  static fetchMemberListFromServer(info: any, callback: ReturnCallback) {
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
  static fetchMemberInfoListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const cursor = info.cursor;
    const limit = info.limit ?? info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchMemberInfoListFromServer(
        groupId,
        cursor,
        limit,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchMemberInfoListFromServer.name,
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
  static fetchGroupInfoWithoutMembersFromServer(
    info: any,
    callback: ReturnCallback,
  ) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchGroupInfoWithoutMembersFromServer(
        groupId,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchGroupInfoWithoutMembersFromServer
        .name,
    );
  }
  static requestToJoinPublicGroup(info: any, callback: ReturnCallback) {
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
  static acceptInvitation(info: any, callback: ReturnCallback) {
    // todo: no inviter, modify jmeter
    const groupId = info.groupId;
    const inviter = info.inviter ?? '';
    this.tryCatch(
      ChatClient.getInstance().groupManager.acceptInvitation(groupId, inviter),
      callback,
      ChatClient.getInstance().groupManager.acceptInvitation.name,
    );
  }
  static acceptJoinApplication(info: any, callback: ReturnCallback) {
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
  static declineInvitation(info: any, callback: ReturnCallback) {
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
  static declineJoinApplication(info: any, callback: ReturnCallback) {
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
  static changeOwner(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const newOwner = info.newOwner;
    this.tryCatch(
      ChatClient.getInstance().groupManager.changeOwner(groupId, newOwner),
      callback,
      ChatClient.getInstance().groupManager.changeOwner.name,
    );
  }
  static addAdmin(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const admin = info.memberId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.addAdmin(groupId, admin),
      callback,
      ChatClient.getInstance().groupManager.addAdmin.name,
    );
  }
  static removeAdmin(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const admin = info.memberId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeAdmin(groupId, admin),
      callback,
      ChatClient.getInstance().groupManager.removeAdmin.name,
    );
  }
  static addMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
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
  static inviteUser(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().groupManager.inviteUser(
        groupId,
        members,
        reason,
      ),
      callback,
      ChatClient.getInstance().groupManager.inviteUser.name,
    );
  }
  static removeMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.removeMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.removeMembers.name,
    );
  }
  static blockMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.blockMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.blockMembers.name,
    );
  }
  static fetchBlockListFromServer(info: any, callback: ReturnCallback) {
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
  static unblockMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.unblockMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.unblockMembers.name,
    );
  }
  static fetchMuteListFromServer(info: any, callback: ReturnCallback) {
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
  static unMuteMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.unMuteMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.unMuteMembers.name,
    );
  }
  static muteMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.muteMembers(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.muteMembers.name,
    );
  }
  static muteAllMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.muteAllMembers(groupId),
      callback,
      ChatClient.getInstance().groupManager.muteAllMembers.name,
    );
  }
  static unMuteAllMembers(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.unMuteAllMembers(groupId),
      callback,
      ChatClient.getInstance().groupManager.unMuteAllMembers.name,
    );
  }
  static isMemberInAllowListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.isMemberInAllowListFromServer(
        groupId,
      ),
      callback,
      ChatClient.getInstance().groupManager.isMemberInAllowListFromServer.name,
    );
  }
  static fetchAllowListFromServer(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchAllowListFromServer(groupId),
      callback,
      ChatClient.getInstance().groupManager.fetchAllowListFromServer.name,
    );
  }
  static addAllowList(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    this.tryCatch(
      ChatClient.getInstance().groupManager.addAllowList(groupId, members),
      callback,
      ChatClient.getInstance().groupManager.addAllowList.name,
    );
  }
  static removeAllowList(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
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
  static unblockGroup(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.unblockGroup(groupId),
      callback,
      ChatClient.getInstance().groupManager.unblockGroup.name,
    );
  }
  static getGroupWithId(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().groupManager.getGroupWithId(groupId),
      callback,
      ChatClient.getInstance().groupManager.getGroupWithId.name,
    );
  }
  static updateGroupAvatar(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const avatar = info.avatar;
    this.tryCatch(
      ChatClient.getInstance().groupManager.updateGroupAvatar(groupId, avatar),
      callback,
      ChatClient.getInstance().groupManager.updateGroupAvatar.name,
    );
  }
  static setMemberAttribute(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const member = info.member ?? info.username;
    const attributes = this.createAttributes(info.attributes ?? info.attribute);
    this.tryCatch(
      ChatClient.getInstance().groupManager.setMemberAttribute(
        groupId,
        member,
        attributes,
      ),
      callback,
      ChatClient.getInstance().groupManager.setMemberAttribute.name,
    );
  }
  static fetchMemberAttributes(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const member = info.member ?? info.username;
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchMemberAttributes(
        groupId,
        member,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchMemberAttributes.name,
    );
  }
  static fetchMembersAttributes(info: any, callback: ReturnCallback) {
    const groupId = info.groupId;
    const members = this.splitList(info.members);
    const attributeKeys =
      info.attributeKeys === undefined
        ? undefined
        : this.splitList(info.attributeKeys);
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchMembersAttributes(
        groupId,
        members,
        attributeKeys,
      ),
      callback,
      ChatClient.getInstance().groupManager.fetchMembersAttributes.name,
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
  static fetchJoinedGroupCount(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().groupManager.fetchJoinedGroupCount(),
      callback,
      ChatClient.getInstance().groupManager.fetchJoinedGroupCount.name,
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

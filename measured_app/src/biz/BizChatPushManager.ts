import {
  ChatClient,
  ChatConversation,
  ChatConversationType,
  ChatPushDisplayStyle,
  ChatPushRemindType,
  ChatSilentModeParam,
  ChatSilentModeParamType,
  ChatSilentModeTime,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatPushManager extends BizBase {
  static createConvType(info: any): ChatConversationType {
    let convType = ChatConversationType.PeerChat;
    const conversationType = info.conversationType ?? info.convType;
    if (
      conversationType === 'GroupChat' ||
      conversationType === ChatConversationType.GroupChat
    ) {
      convType = ChatConversationType.GroupChat;
    } else if (
      conversationType === 'RoomChat' ||
      conversationType === ChatConversationType.RoomChat
    ) {
      convType = ChatConversationType.RoomChat;
    }
    return convType;
  }

  static createSilentModeParam(info: any): ChatSilentModeParam {
    let paramType = ChatSilentModeParamType.REMIND_TYPE;
    if (info.paramType === 'silentModeDuration') {
      paramType = ChatSilentModeParamType.SILENT_MODE_DURATION;
    } else if (info.paramType === 'silentModeInterval') {
      paramType = ChatSilentModeParamType.SILENT_MODE_INTERVAL;
    }
    let remindType = ChatPushRemindType.ALL;
    if (info.remindType === 'only') {
      remindType = ChatPushRemindType.MENTION_ONLY;
    } else if (info.remindType === 'none') {
      remindType = ChatPushRemindType.NONE;
    }
    const startTime = new ChatSilentModeTime({
      hour: info.shour ?? 0,
      minute: info.smin ?? 0,
    });
    const endTime = new ChatSilentModeTime({
      hour: info.ehour ?? 0,
      minute: info.emin ?? 0,
    });
    const duration = info.duration ?? 0;
    return new ChatSilentModeParam({
      paramType,
      remindType,
      startTime,
      endTime,
      duration,
    });
  }

  static setSilentModeForAll(info: any, callback: ReturnCallback) {
    const option = this.createSilentModeParam(info);
    this.tryCatch(
      ChatClient.getInstance().pushManager.setSilentModeForAll(option),
      callback,
      ChatClient.getInstance().pushManager.setSilentModeForAll.name,
    );
  }
  static setSilentModeForConversation(info: any, callback: ReturnCallback) {
    const convId = info.convId;
    const convType = this.createConvType(info);
    const option = this.createSilentModeParam(info);
    this.tryCatch(
      ChatClient.getInstance().pushManager.setSilentModeForConversation({
        convId,
        convType,
        option,
      }),
      callback,
      ChatClient.getInstance().pushManager.setSilentModeForConversation.name,
    );
  }
  static removeSilentModeForConversation(info: any, callback: ReturnCallback) {
    const convId = info.convId;
    const convType = this.createConvType(info);
    this.tryCatch(
      ChatClient.getInstance().pushManager.removeSilentModeForConversation({
        convId,
        convType,
      }),
      callback,
      ChatClient.getInstance().pushManager.removeSilentModeForConversation.name,
    );
  }
  static fetchSilentModeForAll(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchSilentModeForAll(),
      callback,
      ChatClient.getInstance().pushManager.fetchSilentModeForAll.name,
    );
  }
  static fetchSilentModeForConversation(info: any, callback: ReturnCallback) {
    const convId = info.convId;
    const convType = this.createConvType(info);
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchSilentModeForConversation({
        convId,
        convType,
      }),
      callback,
      ChatClient.getInstance().pushManager.fetchSilentModeForConversation.name,
    );
  }
  static fetchSilentModeForConversations(info: any, callback: ReturnCallback) {
    const source = info.conversations ?? info.convs ?? [];
    const conversations = Array.isArray(source)
      ? source.map(
          (conversation: any) =>
            new ChatConversation({
              convId: conversation.convId,
              convType: this.createConvType(conversation),
              isChatThread: conversation.isChatThread,
            }),
        )
      : (source as string).split(',').map(
          convId =>
            new ChatConversation({
              convId,
              convType: this.createConvType(info),
            }),
        );
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchSilentModeForConversations(
        conversations,
      ),
      callback,
      ChatClient.getInstance().pushManager.fetchSilentModeForConversations.name,
    );
  }
  static setPreferredNotificationLanguage(info: any, callback: ReturnCallback) {
    const languageCode = info.code;
    this.tryCatch(
      ChatClient.getInstance().pushManager.setPreferredNotificationLanguage(
        languageCode,
      ),
      callback,
      ChatClient.getInstance().pushManager.setPreferredNotificationLanguage
        .name,
    );
  }
  static getPreferredNotificationLanguage(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchPreferredNotificationLanguage(),
      callback,
      ChatClient.getInstance().pushManager.fetchPreferredNotificationLanguage
        .name,
    );
  }
  static getNoDisturbGroups(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static getPushConfigFromServer(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchPushOptionFromServer(),
      callback,
      ChatClient.getInstance().pushManager.fetchPushOptionFromServer.name,
    );
  }
  static getPushConfig(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static updatePushNickName(info: any, callback: ReturnCallback) {
    const nickname = info.nickname ?? info.nickName;
    this.tryCatch(
      ChatClient.getInstance().pushManager.updatePushNickname(nickname),
      callback,
      ChatClient.getInstance().pushManager.updatePushNickname.name,
    );
  }
  static updateHMSPushToken(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static updateFCMPushToken(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static updateAPNSPushToken(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static setNoDisturb(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static setGroupToDisturb(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static setPushStyle(info: any, callback: ReturnCallback) {
    const displayStyle =
      info.displayStyle === 'summary'
        ? ChatPushDisplayStyle.Summary
        : ChatPushDisplayStyle.Simple;
    this.tryCatch(
      ChatClient.getInstance().pushManager.updatePushDisplayStyle(displayStyle),
      callback,
      ChatClient.getInstance().pushManager.updatePushDisplayStyle.name,
    );
  }
  static selectPushTemplate(info: any, callback: ReturnCallback) {
    const templateName = info.templateName;
    this.tryCatch(
      ChatClient.getInstance().pushManager.selectPushTemplate(templateName),
      callback,
      ChatClient.getInstance().pushManager.selectPushTemplate.name,
    );
  }
  static fetchSelectedPushTemplate(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().pushManager.fetchSelectedPushTemplate(),
      callback,
      ChatClient.getInstance().pushManager.fetchSelectedPushTemplate.name,
    );
  }
}

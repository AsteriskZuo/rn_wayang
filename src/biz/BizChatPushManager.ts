import {
  ChatClient,
  ChatPushRemindType,
  ChatSilentModeParam,
  ChatSilentModeParamType,
  ChatSilentModeTime,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatPushManager extends BizBase {
  static setSilentModeForAll(info: any, callback: ReturnCallback) {
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
    const option = new ChatSilentModeParam({
      paramType,
      remindType,
      startTime,
      endTime,
      duration,
    });
    this.tryCatch(
      ChatClient.getInstance().pushManager.setSilentModeForAll(option),
      callback,
      ChatClient.getInstance().pushManager.setSilentModeForAll.name,
    );
  }
  static setSilentModeForConversation(info: any, callback: ReturnCallback) {
    const convId = info.convId;
    const convType = info.convType;
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
    const option = new ChatSilentModeParam({
      paramType,
      remindType,
      startTime,
      endTime,
      duration,
    });
    this.tryCatch(
      ChatClient.getInstance().pushManager.setConversationSilentMode({
        convId,
        convType,
        option,
      }),
      callback,
      ChatClient.getInstance().pushManager.setSilentModeForAll.name,
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
    callback(undefined);
  }
  static getPushConfig(info: any, callback: ReturnCallback) {
    callback(undefined);
  }
  static updatePushNickName(info: any, callback: ReturnCallback) {
    callback(undefined);
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
    callback(undefined);
  }
}

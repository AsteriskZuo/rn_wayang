import {
  ChatClient,
  ChatConversationFetchOptions,
  ChatConversationMarkType,
  ChatConversationType,
  ChatError,
  ChatGroupMessageAck,
  ChatMessageBody,
  ChatMessage,
  ChatMessageChatType,
  ChatMessageEventListener,
  ChatMessageReactionEvent,
  ChatMessageStatusCallback,
  ChatMessageThreadEvent,
  ChatMessageType,
  ChatSearchDirection,
} from 'react-native-chat-sdk';
import type {FixtureMetadata} from '../FileHelper';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatManager extends BizBase {
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

  static mergeFixtureMetadata(info: any, metadata?: FixtureMetadata): any {
    if (metadata === undefined) {
      return info;
    }
    return {
      ...info,
      width: info.width ?? metadata.width,
      height: info.height ?? metadata.height,
      duration: info.duration ?? metadata.duration,
      thumbnailLocalPath:
        info.thumbnailLocalPath ?? metadata.thumbnailLocalPath,
    };
  }

  static async prepareMessageInfo(info: any): Promise<any> {
    if (info.localPath !== undefined) {
      return info;
    }
    if (info.fixtureName === undefined) {
      return info;
    }

    const fileHelperModule: typeof import('../FileHelper') =
      require('../FileHelper');
    const fixture = await fileHelperModule.FileHelper.materializeFixture(
      info.fixtureName,
    );
    const preparedInfo = this.mergeFixtureMetadata(
      {
        ...info,
        localPath: fixture.localPath,
      },
      fixture.metadata,
    );

    return preparedInfo;
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

  static createImageMessageOptions(info: any) {
    const hasReceiverList = info.receiverList !== undefined;
    const options = {
      displayName: info.displayName,
      thumbnailLocalPath: info.thumbnailLocalPath,
      sendOriginalImage: info.sendOriginalImage,
      width: info.width,
      height: info.height,
      isChatThread: info.isChatThread,
      fileSize: info.fileSize,
      isOnline: info.isOnline,
      deliverOnlineOnly: info.deliverOnlineOnly,
      ...(hasReceiverList
        ? {receiverList: this.splitList(info.receiverList)}
        : undefined),
      isGif: info.isGif,
    };
    const hasOptions = Object.values(options).some(value => value !== undefined);
    if (!hasOptions) {
      return undefined;
    }
    return {
      ...options,
      isChatThread: options.isChatThread ?? false,
    };
  }

  static createMessage(
    info: any,
    callback?: ReturnCallback,
  ): ChatMessage | undefined {
    let message;
    const type = info.type;
    const targetId = info.username;
    if (type === 'text') {
      const content = info.content;
      message = ChatMessage.createTextMessage(
        targetId,
        content,
        ChatMessageChatType.PeerChat,
      );
    } else if (type === 'image') {
      const filePath = info.localPath;
      const options = this.createImageMessageOptions(info);
      message =
        options === undefined
          ? ChatMessage.createImageMessage(
              targetId,
              filePath,
              ChatMessageChatType.PeerChat,
            )
          : ChatMessage.createImageMessage(
              targetId,
              filePath,
              ChatMessageChatType.PeerChat,
              options,
            );
    } else if (type === 'video') {
      const filePath = info.localPath;
      const displayName = info.displayName;
      const thumbnailLocalPath = info.thumbnailLocalPath;
      const width = info.width;
      const height = info.height;
      const duration = info.duration;
      const isChatThread = info.isChatThread ?? false;
      message = ChatMessage.createVideoMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
        {
          displayName,
          thumbnailLocalPath,
          width,
          height,
          duration,
          isChatThread,
        },
      );
    } else if (type === 'voice') {
      const filePath = info.localPath;
      const displayName = info.displayName;
      const duration = info.duration;
      const isChatThread = info.isChatThread ?? false;
      message = ChatMessage.createVoiceMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
        {
          displayName,
          duration,
          isChatThread,
        },
      );
    } else if (type === 'file') {
      const filePath = info.localPath;
      const displayName = info.displayName;
      const isChatThread = info.isChatThread ?? false;
      const fileSize = info.fileSize;
      const isOnline = info.isOnline;
      const deliverOnlineOnly = info.deliverOnlineOnly;
      const receiverList = this.splitList(info.receiverList);
      message = ChatMessage.createFileMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
        {
          displayName,
          isChatThread,
          fileSize,
          isOnline,
          deliverOnlineOnly,
          receiverList,
        },
      );
    } else if (type === 'location') {
      const latitude = info.latitude;
      const longitude = info.longitude;
      message = ChatMessage.createLocationMessage(
        targetId,
        latitude,
        longitude,
        ChatMessageChatType.PeerChat,
      );
    } else if (type === 'cmd') {
      const action = info.action;
      const deliverOnlineOnly = info.deliverOnlineOnly;
      message = ChatMessage.createCmdMessage(
        targetId,
        action,
        ChatMessageChatType.PeerChat,
        {
          deliverOnlineOnly,
        },
      );
    } else if (type === 'custom') {
      const event = info.event;
      const params = info.data;
      message = ChatMessage.createCustomMessage(
        targetId,
        event,
        ChatMessageChatType.PeerChat,
        {
          params,
        },
      );
    } else {
      callback?.(undefined);
      return undefined;
    }
    return message;
  }

  static needsFixturePreparation(info: any): boolean {
    return (
      (info.type === 'image' ||
        info.type === 'video' ||
        info.type === 'voice' ||
        info.type === 'file') &&
      info.localPath === undefined &&
      info.fixtureName !== undefined
    );
  }

  static createConvType(info: any): ChatConversationType {
    let convType = ChatConversationType.PeerChat;
    const conversationType =
      typeof info === 'string' || typeof info === 'number'
        ? info
        : info.conversationType ?? info.convType;
    if (
      conversationType === 'GroupChat' ||
      conversationType === ChatConversationType.GroupChat
    ) {
      convType = ChatConversationType.GroupChat;
    } else if (
      conversationType === 'RoomChat' ||
      conversationType === 'ChatRoom' ||
      conversationType === ChatConversationType.RoomChat
    ) {
      convType = ChatConversationType.RoomChat;
    }
    return convType;
  }
  static createChatType(info: any): ChatMessageChatType {
    let chatType = ChatMessageChatType.PeerChat;
    const value = info.chatType ?? info.conversationType ?? info.convType;
    if (
      value === 'GroupChat' ||
      value === ChatMessageChatType.GroupChat ||
      value === ChatConversationType.GroupChat
    ) {
      chatType = ChatMessageChatType.GroupChat;
    } else if (
      value === 'ChatRoom' ||
      value === 'RoomChat' ||
      value === ChatMessageChatType.ChatRoom ||
      value === ChatConversationType.RoomChat
    ) {
      chatType = ChatMessageChatType.ChatRoom;
    }
    return chatType;
  }
  static createSearchDirection(value: any): ChatSearchDirection {
    return value === 'UP' || value === ChatSearchDirection.UP
      ? ChatSearchDirection.UP
      : ChatSearchDirection.DOWN;
  }
  static maybeCreateSearchDirection(
    value: any,
  ): ChatSearchDirection | undefined {
    return value === undefined ? undefined : this.createSearchDirection(value);
  }
  static createSearchScope(value: any) {
    if (value === 'attribute') {
      return 1;
    }
    if (value === 'all') {
      return 2;
    }
    return value;
  }
  static createConversationFetchOptions(info: any): ChatConversationFetchOptions {
    if (info.options instanceof ChatConversationFetchOptions) {
      return info.options;
    }
    const options = info.options ?? info;
    return new ChatConversationFetchOptions({
      pageSize: options.pageSize,
      cursor: options.cursor,
      pinned: options.pinned,
      mark: options.mark,
    });
  }
  static createConversationMark(value: any): ChatConversationMarkType {
    if (typeof value === 'number') {
      return value;
    }
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
    return ChatConversationMarkType.Type0;
  }
  static async sendMessage(info: any, callback: ReturnCallback) {
    const once = this.createOneShotCallback(callback);
    let preparedInfo;
    try {
      preparedInfo = this.needsFixturePreparation(info)
        ? await this.prepareMessageInfo(info)
        : info;
    } catch (error) {
      once(error);
      return;
    }

    const msg = this.createMessage(preparedInfo, once);
    if (msg === undefined) {
      return;
    }

    ChatClient.getInstance()
      .chatManager.sendMessage(
        msg,
        new (class implements ChatMessageStatusCallback {
          onProgress(localMsgId: string, progress: number): void {
            console.log(this.onProgress.name, localMsgId, progress);
          }
          onError(localMsgId: string, error: ChatError): void {
            console.log(this.onError.name, localMsgId, error);
            once(error);
          }
          onSuccess(message: ChatMessage): void {
            console.log(this.onSuccess.name, message);
            once(message);
          }
        })(),
      )
      .catch(error => {
        once(error);
      });
  }
  static fetchGroupAcks(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const groupId = info.groupId;
    const startAckId = info.startAckId;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchGroupAcks(
        msgId,
        groupId,
        startAckId,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchGroupAcks.name,
    );
  }
  static async translateMessage(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const languages = info.lanuages;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.translateMessage(msg, languages),
        callback,
        ChatClient.getInstance().chatManager.translateMessage.name,
      );
    } else {
      callback(null);
    }
  }
  static fetchSupportedLanguages(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchSupportedLanguages(),
      callback,
      ChatClient.getInstance().chatManager.fetchSupportedLanguages.name,
    );
  }
  static reportMessage(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const tag = info.tag;
    const reason = info.reason;
    this.tryCatch(
      ChatClient.getInstance().chatManager.reportMessage(msgId, tag, reason),
      callback,
      ChatClient.getInstance().chatManager.reportMessage.name,
    );
  }
  static addReaction(info: any, callback: ReturnCallback) {
    const reaction = info.reaction;
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.addReaction(reaction, msgId),
      callback,
      ChatClient.getInstance().chatManager.addReaction.name,
    );
  }
  static removeReaction(info: any, callback: ReturnCallback) {
    const reaction = info.reaction;
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeReaction(reaction, msgId),
      callback,
      ChatClient.getInstance().chatManager.removeReaction.name,
    );
  }
  static getReactionList(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getReactionList(msgId),
      callback,
      ChatClient.getInstance().chatManager.getReactionList.name,
    );
  }
  static fetchReactionList(info: any, callback: ReturnCallback) {
    const msgIds = this.splitList(info.msgIds ?? info.messageIds);
    const groupId = info.groupId;
    const chatType = this.createChatType(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchReactionList(
        msgIds,
        groupId,
        chatType,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchReactionList.name,
    );
  }
  static fetchReactionDetail(info: any, callback: ReturnCallback) {
    const msgId = info.msgId ?? info.messageId;
    const reaction = info.reaction;
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchReactionDetail(
        msgId,
        reaction,
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchReactionDetail.name,
    );
  }
  static groupAckCount(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.groupAckCount(msgId),
      callback,
      ChatClient.getInstance().chatManager.groupAckCount.name,
    );
  }
  static createChatThread(info: any, callback: ReturnCallback) {
    const name = info.name;
    const msgId = info.msgId;
    const parentId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.createChatThread(
        name,
        msgId,
        parentId,
      ),
      callback,
      ChatClient.getInstance().chatManager.createChatThread.name,
    );
  }
  static fetchChatThreadFromServer(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchChatThreadFromServer(
        chatThreadId,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchChatThreadFromServer.name,
    );
  }
  static getThreadDetail(info: any, callback: ReturnCallback) {
    callback(null);
  }
  static getMessageThread(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessageThread(msgId),
      callback,
      ChatClient.getInstance().chatManager.getMessageThread.name,
    );
  }
  static getThreadConversation(info: any, callback: ReturnCallback) {
    const convId = info.threadId ?? info.conversationId;
    const createIfNeed = info.createIfNeed;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getThreadConversation(
        convId,
        createIfNeed,
      ),
      callback,
      ChatClient.getInstance().chatManager.getThreadConversation.name,
    );
  }
  static joinChatThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.joinChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.joinChatThread.name,
    );
  }
  static leaveChatThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.leaveChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.leaveChatThread.name,
    );
  }
  static destroyChatThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.destroyChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.destroyChatThread.name,
    );
  }
  static removeMemberWithChatThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    const memberId = info.username;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeMemberWithChatThread(
        chatThreadId,
        memberId,
      ),
      callback,
      ChatClient.getInstance().chatManager.removeMemberWithChatThread.name,
    );
  }
  static updateChatThreadName(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    const newName = info.subject;
    this.tryCatch(
      ChatClient.getInstance().chatManager.updateChatThreadName(
        chatThreadId,
        newName,
      ),
      callback,
      ChatClient.getInstance().chatManager.updateChatThreadName.name,
    );
  }
  static fetchMembersWithChatThreadFromServer(
    info: any,
    callback: ReturnCallback,
  ) {
    const chatThreadId = info.threadId;
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchMembersWithChatThreadFromServer(
        chatThreadId,
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchMembersWithChatThreadFromServer
        .name,
    );
  }
  static fetchChatThreadWithParentFromServer(
    info: any,
    callback: ReturnCallback,
  ) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    const parentId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchChatThreadWithParentFromServer(
        parentId,
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchChatThreadWithParentFromServer
        .name,
    );
  }
  static fetchJoinedChatThreadWithParentFromServer(
    info: any,
    callback: ReturnCallback,
  ) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    const parentId = info.groupId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchJoinedChatThreadWithParentFromServer(
        parentId,
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager
        .fetchJoinedChatThreadWithParentFromServer.name,
    );
  }
  static fetchJoinedChatThreadFromServer(
    info: any,
    callback: ReturnCallback,
  ) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchJoinedChatThreadFromServer(
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchJoinedChatThreadFromServer.name,
    );
  }
  static fetchLastMessageWithChatThread(info: any, callback: ReturnCallback) {
    const chatThreadId = this.splitList(info.threadIds ?? info.threadId);
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchLastMessageWithChatThread(
        chatThreadId,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchLastMessageWithChatThread.name,
    );
  }
  static getLatestReceivedMessage(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    this.tryCatch(
      ChatClient.getInstance().chatManager.getLatestReceivedMessage(
        convId,
        convType,
      ),
      callback,
      ChatClient.getInstance().chatManager.getLatestReceivedMessage.name,
    );
  }
  static getLatestMessage(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getLatestMessage(
        convId,
        convType,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.getLatestMessage.name,
    );
  }
  static setConversationExtension(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const ext = info.dict;
    this.tryCatch(
      ChatClient.getInstance().chatManager.setConversationExtension(
        convId,
        convType,
        ext,
      ),
      callback,
      ChatClient.getInstance().chatManager.setConversationExtension.name,
    );
  }
  static async getExt(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const createIfNeed = info.createIfNeed;
    const ret = await ChatClient.getInstance().chatManager.getConversation(
      convId,
      convType,
      createIfNeed,
    );
    callback(ret?.ext);
  }
  static markMessageAsRead(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.markMessageAsRead(
        convId,
        convType,
        msgId,
      ),
      callback,
      ChatClient.getInstance().chatManager.markMessageAsRead.name,
    );
  }
  static getConversationUnreadCount(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    this.tryCatch(
      ChatClient.getInstance().chatManager.getConversationUnreadCount(
        convId,
        convType,
      ),
      callback,
      ChatClient.getInstance().chatManager.getConversationUnreadCount.name,
    );
  }
  static getConversationMessageCount(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getConversationMessageCount(
        convId,
        convType,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.getConversationMessageCount.name,
    );
  }
  static markAllMessagesAsRead(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    this.tryCatch(
      ChatClient.getInstance().chatManager.markAllMessagesAsRead(
        convId,
        convType,
      ),
      callback,
      ChatClient.getInstance().chatManager.markAllMessagesAsRead.name,
    );
  }
  static insertMessage(info: any, callback: ReturnCallback) {
    // todo: no type, modify jmeter.
    const msg = this.createMessage(info, callback);
    if (msg === undefined) {
      return;
    }
    this.tryCatch(
      ChatClient.getInstance().chatManager.insertMessage(msg),
      callback,
      ChatClient.getInstance().chatManager.insertMessage.name,
    );
  }
  static updateMessage(info: any, callback: ReturnCallback) {
    const targetId = info.username;
    const content = info.content;
    const msg = ChatMessage.createTextMessage(
      targetId,
      content,
      ChatMessageChatType.PeerChat,
    );
    this.tryCatch(
      ChatClient.getInstance().chatManager.updateMessage(msg),
      callback,
      ChatClient.getInstance().chatManager.updateMessage.name,
    );
  }
  static async updateConversationMessage(
    info: any,
    callback: ReturnCallback,
  ) {
    try {
      const convId = info.conversationId ?? info.convId;
      const convType = this.createConvType(info);
      const msgId = info.messageId ?? info.msgId;
      let msg;
      if (info.message) {
        msg = info.message;
      } else if (msgId) {
        msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
      } else {
        msg = this.createMessage(info, callback);
        if (msg === undefined) {
          return;
        }
      }
      const isChatThread = info.isChatThread;
      if (msg) {
        this.tryCatch(
          ChatClient.getInstance().chatManager.updateConversationMessage(
            convId,
            convType,
            msg,
            isChatThread,
          ),
          callback,
          ChatClient.getInstance().chatManager.updateConversationMessage.name,
        );
      } else {
        callback(null);
      }
    } catch (error) {
      callback(error);
    }
  }
  static deleteMessage(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteMessage(
        convId,
        convType,
        msgId,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteMessage.name,
    );
  }
  static deleteMessagesWithTimestamp(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const startTs = info.startTs ?? info.startTime ?? info.starttimes;
    const endTs = info.endTs ?? info.endTime ?? info.endtimes;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteMessagesWithTimestamp(
        convId,
        convType,
        {startTs, endTs},
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteMessagesWithTimestamp.name,
    );
  }
  static deleteConversationAllMessages(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteConversationAllMessages(
        convId,
        convType,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteConversationAllMessages.name,
    );
  }
  static deleteMessagesBeforeTimestamp(info: any, callback: ReturnCallback) {
    const timestamp = info.timestamp;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteMessagesBeforeTimestamp(
        timestamp,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteMessagesBeforeTimestamp.name,
    );
  }
  static getMessage(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessage(msgId),
      callback,
      ChatClient.getInstance().chatManager.getMessage.name,
    );
  }
  static loadMessagesWithMsgType(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const msgType = info.msgType;
    const direction =
      info.direction === 'UP'
        ? ChatSearchDirection.UP
        : ChatSearchDirection.DOWN;
    const timestamp = info.times;
    const count = info.count;
    const sender = info.sender;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessagesWithMsgType(
        convId,
        convType,
        msgType,
        direction,
        timestamp,
        count,
        sender,
      ),
      callback,
      ChatClient.getInstance().chatManager.getMessagesWithMsgType.name,
    );
  }
  static getMsgsWithMsgType(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const msgType = info.msgType;
    const direction = this.maybeCreateSearchDirection(info.direction);
    const timestamp = info.timestamp ?? info.times;
    const count = info.count;
    const sender = info.sender;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMsgsWithMsgType({
        convId,
        convType,
        msgType,
        timestamp,
        count,
        sender,
        isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.getMsgsWithMsgType.name,
    );
  }
  static loadMessages(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const startMsgId = info.startMessageId;
    const direction =
      info.direction === 'UP'
        ? ChatSearchDirection.UP
        : ChatSearchDirection.DOWN;
    const loadCount = info.count;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessages(
        convId,
        convType,
        startMsgId,
        direction,
        loadCount,
      ),
      callback,
      ChatClient.getInstance().chatManager.getMessages.name,
    );
  }
  static getMsgs(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const startMsgId = info.startMsgId ?? info.startMessageId;
    const direction = this.maybeCreateSearchDirection(info.direction);
    const loadCount = info.loadCount ?? info.count;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMsgs({
        convId,
        convType,
        startMsgId,
        loadCount,
        isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.getMsgs.name,
    );
  }
  static loadMessagesWithKeyword(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const keywords = info.keywords;
    const direction =
      info.direction === 'UP'
        ? ChatSearchDirection.UP
        : ChatSearchDirection.DOWN;
    const timestamp = info.times;
    const count = info.count;
    const sender = info.sender;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessagesWithKeyword(
        convId,
        convType,
        keywords,
        direction,
        timestamp,
        count,
        sender,
      ),
      callback,
      ChatClient.getInstance().chatManager.getMessagesWithKeyword.name,
    );
  }
  static getConvMsgsWithKeyword(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const senders =
      info.senders === undefined ? undefined : this.splitList(info.senders);
    const direction = this.maybeCreateSearchDirection(info.direction);
    this.tryCatch(
      ChatClient.getInstance().chatManager.getConvMsgsWithKeyword({
        convId,
        convType,
        keywords: info.keywords,
        timestamp: info.timestamp ?? info.times,
        count: info.count ?? info.maxCount,
        sender: info.sender,
        senders,
        searchScope: this.createSearchScope(info.searchScope),
        isChatThread: info.isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.getConvMsgsWithKeyword.name,
    );
  }
  static loadMessagesWithTime(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const direction =
      info.direction === 'UP'
        ? ChatSearchDirection.UP
        : ChatSearchDirection.DOWN;
    const count = info.count;
    const startTime = info.starttimes;
    const endTime = info.endtimes;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessageWithTimestamp(
        convId,
        convType,
        startTime,
        endTime,
        direction,
        count,
      ),
      callback,
      ChatClient.getInstance().chatManager.getMessageWithTimestamp.name,
    );
  }
  static getMsgWithTimestamp(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const startTime = info.startTime ?? info.startTs ?? info.starttimes;
    const endTime = info.endTime ?? info.endTs ?? info.endtimes;
    const direction = this.maybeCreateSearchDirection(info.direction);
    const count = info.count;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMsgWithTimestamp({
        convId,
        convType,
        startTime,
        endTime,
        count,
        isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.getMsgWithTimestamp.name,
    );
  }
  static getUnreadCount(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getUnreadCount(),
      callback,
      ChatClient.getInstance().chatManager.getUnreadCount.name,
    );
  }
  static deleteConversation(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const withMessage = info.withMessage === '1' ? true : false;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteConversation(
        convId,
        withMessage,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteConversation.name,
    );
  }
  static async downloadAttachment(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.downloadAttachment(msg),
        callback,
        ChatClient.getInstance().chatManager.downloadAttachment.name,
      );
    } else {
      callback(null);
    }
  }
  static async downloadThumbnail(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.downloadThumbnail(msg),
        callback,
        ChatClient.getInstance().chatManager.downloadThumbnail.name,
      );
    } else {
      callback(null);
    }
  }
  static async downloadAttachmentInCombine(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.downloadAttachmentInCombine(msg),
        callback,
        ChatClient.getInstance().chatManager.downloadAttachmentInCombine.name,
      );
    } else {
      callback(null);
    }
  }
  static async downloadThumbnailInCombine(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.downloadThumbnailInCombine(msg),
        callback,
        ChatClient.getInstance().chatManager.downloadThumbnailInCombine.name,
      );
    } else {
      callback(null);
    }
  }
  static async fetchCombineMessageDetail(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.fetchCombineMessageDetail(msg),
        callback,
        ChatClient.getInstance().chatManager.fetchCombineMessageDetail.name,
      );
    } else {
      callback(null);
    }
  }
  static loadChatMessage(info: any, callback: ReturnCallback) {
    this.getMessage(info, callback);
  }
  static markAllConversationsAsRead(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.markAllConversationsAsRead(),
      callback,
      ChatClient.getInstance().chatManager.markAllConversationsAsRead.name,
    );
  }
  static recallMessage(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.recallMessage(msgId),
      callback,
      ChatClient.getInstance().chatManager.recallMessage.name,
    );
  }
  static async resendMessage(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.resendMessage(
          msg,
          new (class implements ChatMessageStatusCallback {
            onProgress(localMsgId: string, progress: number): void {
              console.log(this.onProgress.name, localMsgId, progress);
            }
            onError(localMsgId: string, error: ChatError): void {
              console.log(this.onError.name, localMsgId, error);
              callback(error);
            }
            onSuccess(message: ChatMessage): void {
              console.log(this.onSuccess.name, message);
              callback(message);
            }
          })(),
        ),
        undefined,
        ChatClient.getInstance().chatManager.resendMessage.name,
      );
    } else {
      callback(null);
    }
  }
  static importMessages(info: any, callback: ReturnCallback) {
    const data = info.data;
    const list: Array<ChatMessage | undefined> = [];
    for (let index = 0; index < data.length; index++) {
      const element = data[index];
      const msg = this.createMessage(element);
      list.push(msg);
    }
    if (list.length > 0) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.importMessages(
          list as ChatMessage[],
        ),
        callback,
        ChatClient.getInstance().chatManager.importMessages.name,
      );
    } else {
      callback(null);
    }
  }
  static async sendMessageReadAck(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    const msg = await ChatClient.getInstance().chatManager.getMessage(msgId);
    if (msg) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.sendMessageReadAck(msg),
        callback,
        ChatClient.getInstance().chatManager.sendMessageReadAck.name,
      );
    } else {
      callback(null);
    }
  }
  static sendConversationReadAck(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.sendConversationReadAck(convId),
      callback,
      ChatClient.getInstance().chatManager.sendConversationReadAck.name,
    );
  }
  static sendGroupMessageReadAck(info: any, callback: ReturnCallback) {
    const msgId = info.messageId ?? info.msgId;
    const groupId = info.groupId;
    const opt =
      info.opt ??
      (info.content === undefined ? undefined : {content: info.content});
    this.tryCatch(
      ChatClient.getInstance().chatManager.sendGroupMessageReadAck(
        msgId,
        groupId,
        opt,
      ),
      callback,
      ChatClient.getInstance().chatManager.sendGroupMessageReadAck.name,
    );
  }
  static removeMessagesWithTimestamp(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const timestamp = info.timestamp;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeMessagesWithTimestamp({
        convId,
        convType,
        timestamp,
        isChatThread,
      }),
      callback,
      ChatClient.getInstance().chatManager.removeMessagesWithTimestamp.name,
    );
  }
  static getConversationsFromServer(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchAllConversations(),
      callback,
      ChatClient.getInstance().chatManager.fetchAllConversations.name,
    );
  }
  static removeConversationFromServer(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const isDeleteMessage = info.isDeleteServerMessages;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeConversationFromServer(
        convId,
        convType,
        isDeleteMessage,
      ),
      callback,
      ChatClient.getInstance().chatManager.removeConversationFromServer.name,
    );
  }
  static getConversation(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const createIfNeed = info.createIfNeed;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getConversation(
        convId,
        convType,
        createIfNeed,
      ),
      callback,
      ChatClient.getInstance().chatManager.getConversation.name,
    );
  }
  static getAllConversations(_info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getAllConversations(),
      callback,
      ChatClient.getInstance().chatManager.getAllConversations.name,
    );
  }
  static getMessagesWithIds(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const msgIds = this.splitList(info.msgIds ?? info.messageIds);
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessagesWithIds({
        convId,
        convType,
        msgIds,
      }),
      callback,
      ChatClient.getInstance().chatManager.getMessagesWithIds.name,
    );
  }
  static fetchHistoryMessagesByOptions(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchHistoryMessagesByOptions(
        convId,
        convType,
        {
          options: info.options,
          cursor: info.cursor,
          pageSize: info.pageSize,
        },
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchHistoryMessagesByOptions.name,
    );
  }
  static getMsgsWithKeyword(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMsgsWithKeyword({
        keywords: info.keywords,
        timestamp: info.timestamp,
        maxCount: info.maxCount,
        from: info.from,
        direction: this.createSearchDirection(info.direction),
        searchScope: this.createSearchScope(info.searchScope),
      }),
      callback,
      ChatClient.getInstance().chatManager.getMsgsWithKeyword.name,
    );
  }
  static getConvsMsgsWithKeyword(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getConvsMsgsWithKeyword({
        keywords: info.keywords,
        timestamp: info.timestamp,
        from: info.from,
        direction: this.createSearchDirection(info.direction),
        searchScope: this.createSearchScope(info.searchScope),
      }),
      callback,
      ChatClient.getInstance().chatManager.getConvsMsgsWithKeyword.name,
    );
  }
  static searchMessages(info: any, callback: ReturnCallback) {
    const msgTypes = this.splitList(
      info.msgTypes ?? info.msgType,
    ) as ChatMessageType[];
    if (msgTypes.length === 0) {
      callback(new Error('msgTypes is required'));
      return;
    }
    const direction = this.maybeCreateSearchDirection(info.direction);
    this.tryCatch(
      ChatClient.getInstance().chatManager.searchMessages({
        msgTypes,
        timestamp: info.timestamp,
        count: info.count,
        from: info.from,
        isChatThread: info.isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.searchMessages.name,
    );
  }
  static searchMessagesInConversation(info: any, callback: ReturnCallback) {
    const msgTypes = this.splitList(
      info.msgTypes ?? info.msgType,
    ) as ChatMessageType[];
    if (msgTypes.length === 0) {
      callback(new Error('msgTypes is required'));
      return;
    }
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const direction = this.maybeCreateSearchDirection(info.direction);
    this.tryCatch(
      ChatClient.getInstance().chatManager.searchMessagesInConversation({
        convId,
        convType,
        msgTypes,
        timestamp: info.timestamp,
        count: info.count,
        from: info.from,
        isChatThread: info.isChatThread,
        ...(direction === undefined ? {} : {direction}),
      }),
      callback,
      ChatClient.getInstance().chatManager.searchMessagesInConversation.name,
    );
  }
  static fetchConversationsFromServerWithCursor(
    info: any,
    callback: ReturnCallback,
  ) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchConversationsFromServerWithCursor(
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager
        .fetchConversationsFromServerWithCursor.name,
    );
  }
  static fetchPinnedConversationsFromServerWithCursor(
    info: any,
    callback: ReturnCallback,
  ) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchPinnedConversationsFromServerWithCursor(
        cursor,
        pageSize,
      ),
      callback,
      ChatClient.getInstance().chatManager
        .fetchPinnedConversationsFromServerWithCursor.name,
    );
  }
  static pinConversation(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const isPinned = info.isPinned;
    this.tryCatch(
      ChatClient.getInstance().chatManager.pinConversation(convId, isPinned),
      callback,
      ChatClient.getInstance().chatManager.pinConversation.name,
    );
  }
  static removeMessagesFromServerWithMsgIds(
    info: any,
    callback: ReturnCallback,
  ) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const msgIds = this.splitList(info.msgIds ?? info.messageIds);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeMessagesFromServerWithMsgIds(
        convId,
        convType,
        msgIds,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.removeMessagesFromServerWithMsgIds
        .name,
    );
  }
  static removeMessagesFromServerWithTimestamp(
    info: any,
    callback: ReturnCallback,
  ) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const timestamp = info.timestamp;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.removeMessagesFromServerWithTimestamp(
        convId,
        convType,
        timestamp,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.removeMessagesFromServerWithTimestamp
        .name,
    );
  }
  static addRemoteAndLocalConversationsMark(
    info: any,
    callback: ReturnCallback,
  ) {
    const convIds = this.splitList(info.convIds);
    const mark = this.createConversationMark(info.mark);
    this.tryCatch(
      ChatClient.getInstance().chatManager.addRemoteAndLocalConversationsMark(
        convIds,
        mark,
      ),
      callback,
      ChatClient.getInstance().chatManager.addRemoteAndLocalConversationsMark
        .name,
    );
  }
  static deleteRemoteAndLocalConversationsMark(
    info: any,
    callback: ReturnCallback,
  ) {
    const convIds = this.splitList(info.convIds);
    const mark = this.createConversationMark(info.mark);
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteRemoteAndLocalConversationsMark(
        convIds,
        mark,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteRemoteAndLocalConversationsMark
        .name,
    );
  }
  static fetchConversationsByOptions(info: any, callback: ReturnCallback) {
    const option = this.createConversationFetchOptions(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchConversationsByOptions(option),
      callback,
      ChatClient.getInstance().chatManager.fetchConversationsByOptions.name,
    );
  }
  static deleteAllMessageAndConversation(info: any, callback: ReturnCallback) {
    const clearServerData = info.clearServerData;
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteAllMessageAndConversation(
        clearServerData,
      ),
      callback,
      ChatClient.getInstance().chatManager.deleteAllMessageAndConversation.name,
    );
  }
  static pinMessage(info: any, callback: ReturnCallback) {
    const messageId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.pinMessage(messageId),
      callback,
      ChatClient.getInstance().chatManager.pinMessage.name,
    );
  }
  static unpinMessage(info: any, callback: ReturnCallback) {
    const messageId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.unpinMessage(messageId),
      callback,
      ChatClient.getInstance().chatManager.unpinMessage.name,
    );
  }
  static fetchPinnedMessages(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchPinnedMessages(
        convId,
        convType,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchPinnedMessages.name,
    );
  }
  static getPinnedMessages(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getPinnedMessages(
        convId,
        convType,
        isChatThread,
      ),
      callback,
      ChatClient.getInstance().chatManager.getPinnedMessages.name,
    );
  }
  static getMessagePinInfo(info: any, callback: ReturnCallback) {
    const messageId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessagePinInfo(messageId),
      callback,
      ChatClient.getInstance().chatManager.getMessagePinInfo.name,
    );
  }
  static getMessageCount(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessageCount(),
      callback,
      ChatClient.getInstance().chatManager.getMessageCount.name,
    );
  }
  static getMessageCountWithTimestamp(info: any, callback: ReturnCallback) {
    const convId = info.conversationId ?? info.convId;
    const convType = this.createConvType(info);
    const start = info.start;
    const end = info.end;
    const isChatThread = info.isChatThread;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getMessageCountWithTimestamp({
        convId,
        convType,
        start,
        end,
        isChatThread,
      }),
      callback,
      ChatClient.getInstance().chatManager.getMessageCountWithTimestamp.name,
    );
  }
  static modifyMsgBody(info: any, callback: ReturnCallback) {
    const msgId = info.messageId ?? info.msgId;
    const body = info.body as ChatMessageBody | undefined;
    const ext = info.ext;
    this.tryCatch(
      ChatClient.getInstance().chatManager.modifyMsgBody({msgId, body, ext}),
      callback,
      ChatClient.getInstance().chatManager.modifyMsgBody.name,
    );
  }
  static addChatManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().chatManager.addMessageListener(
      new (class implements ChatMessageEventListener {
        onMessagesReceived(messages: ChatMessage[]): void {
          console.log(this.onMessagesReceived.name, messages);
        }
        onCmdMessagesReceived(messages: ChatMessage[]): void {
          console.log(this.onCmdMessagesReceived.name, messages);
        }
        onMessagesRead(messages: ChatMessage[]): void {
          console.log(this.onMessagesRead.name, messages);
        }
        onGroupMessageRead(groupMessageAcks: ChatGroupMessageAck[]): void {
          console.log(this.onGroupMessageRead.name, groupMessageAcks);
        }
        onMessagesDelivered(messages: ChatMessage[]): void {
          console.log(this.onMessagesDelivered.name, messages);
        }
        onMessagesRecalled(messages: ChatMessage[]): void {
          console.log(this.onMessagesRecalled.name, messages);
        }
        onConversationsUpdate(): void {
          console.log(this.onConversationsUpdate.name);
        }
        onConversationRead(from: string, to?: string | undefined): void {
          console.log(this.onConversationRead.name, from, to);
        }
        onMessageReactionDidChange(list: ChatMessageReactionEvent[]): void {
          console.log(this.onMessageReactionDidChange.name, list);
        }
        onChatMessageThreadCreated(event: ChatMessageThreadEvent): void {
          console.log(this.onChatMessageThreadCreated.name, event);
        }
        onChatMessageThreadUpdated(event: ChatMessageThreadEvent): void {
          console.log(this.onChatMessageThreadUpdated.name, event);
        }
        onChatMessageThreadDestroyed(event: ChatMessageThreadEvent): void {
          console.log(this.onChatMessageThreadDestroyed.name, event);
        }
        onChatMessageThreadUserRemoved(event: ChatMessageThreadEvent): void {
          console.log(this.onChatMessageThreadUserRemoved.name, event);
        }
      })(),
    );
    callback(null);
  }
  static removeChatManagerDelegate(info: any, callback: ReturnCallback) {
    ChatClient.getInstance().chatManager.removeAllMessageListener();
    callback(null);
  }
}

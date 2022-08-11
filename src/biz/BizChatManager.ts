import {
  ChatClient,
  ChatConversationType,
  ChatError,
  ChatGroupMessageAck,
  ChatMessage,
  ChatMessageChatType,
  ChatMessageEventListener,
  ChatMessageReactionEvent,
  ChatMessageStatusCallback,
  ChatMessageThreadEvent,
  ChatSearchDirection,
} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatManager extends BizBase {
  static createMessage(info: any): ChatMessage {
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
      message = ChatMessage.createImageMessage(
        targetId,
        filePath,
        ChatMessageChatType.PeerChat,
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
      throw new Error('not support this type.');
    }
    return message;
  }
  static createConvType(info: any): ChatConversationType {
    let convType = ChatConversationType.PeerChat;
    const conversationType = info.conversationType;
    if (conversationType === 'GroupChat') {
      convType = ChatConversationType.GroupChat;
    } else if (conversationType === 'RoomChat') {
      convType = ChatConversationType.RoomChat;
    }
    return convType;
  }
  static sendMessage(info: any, callback: ReturnCallback) {
    // todo: jmeter 没有文件类型消息
    const msg = this.createMessage(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.sendMessage(
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
      ChatClient.getInstance().chatManager.sendMessage.name,
    );
  }
  static fetchGroupReadAcks(info: any, callback: ReturnCallback) {
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
  static fetchSupportLanguages(info: any, callback: ReturnCallback) {
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
  static getReactionDetail(info: any, callback: ReturnCallback) {
    const msgId = info.messageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.getReactionList(msgId),
      callback,
      ChatClient.getInstance().chatManager.getReactionList.name,
    );
  }
  static createThread(info: any, callback: ReturnCallback) {
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
  static getThreadWithThreadId(info: any, callback: ReturnCallback) {
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
  static joinThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.joinChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.joinChatThread.name,
    );
  }
  static leaveThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.leaveChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.leaveChatThread.name,
    );
  }
  static destoryThread(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.destroyChatThread(chatThreadId),
      callback,
      ChatClient.getInstance().chatManager.destroyChatThread.name,
    );
  }
  static removeThreadMember(info: any, callback: ReturnCallback) {
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
  static changeThreadSubject(info: any, callback: ReturnCallback) {
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
  static fetchThreadMembers(info: any, callback: ReturnCallback) {
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
  static fetchThreadListOfGroup(info: any, callback: ReturnCallback) {
    const cursor = info.cursor;
    const pageSize = info.pageSize;
    const joined = info.joined;
    const parentId = info.groupId;
    if (joined === true) {
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
    } else {
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
  }
  static fetchMineJoinedThreadList(info: any, callback: ReturnCallback) {
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
  static getLastMessageAccordingThreads(info: any, callback: ReturnCallback) {
    const chatThreadId = info.threadId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchLastMessageWithChatThread(
        chatThreadId,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchLastMessageWithChatThread.name,
    );
  }
  static lastReceivedMessage(info: any, callback: ReturnCallback) {
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
  static setExt(info: any, callback: ReturnCallback) {
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
  static unReadCount(info: any, callback: ReturnCallback) {
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
  static markAllMessageAsRead(info: any, callback: ReturnCallback) {
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
    const msg = this.createMessage(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.insertMessage(msg),
      callback,
      ChatClient.getInstance().chatManager.insertMessage.name,
    );
  }
  static appendMessage(info: any, callback: ReturnCallback) {
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
  static deleteAllMessages(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    this.tryCatch(
      ChatClient.getInstance().chatManager.deleteAllMessages(convId, convType),
      callback,
      ChatClient.getInstance().chatManager.deleteAllMessages.name,
    );
  }
  static loadMessage(info: any, callback: ReturnCallback) {
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
  static messagesCount(info: any, callback: ReturnCallback) {
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
  static loadChatMessage(info: any, callback: ReturnCallback) {
    this.loadMessage(info, callback);
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
    const list: ChatMessage[] = [];
    for (let index = 0; index < data.length; index++) {
      const element = data[index];
      const msg = this.createMessage(element);
      list.push(msg);
    }
    if (list.length > 0) {
      this.tryCatch(
        ChatClient.getInstance().chatManager.importMessages(list),
        callback,
        ChatClient.getInstance().chatManager.importMessages.name,
      );
    } else {
      callback(null);
    }
  }
  static lastMessage(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    this.tryCatch(
      ChatClient.getInstance().chatManager.getLatestMessage(convId, convType),
      callback,
      ChatClient.getInstance().chatManager.getLatestMessage.name,
    );
  }
  static getUnreadMessageCount(info: any, callback: ReturnCallback) {
    this.messagesCount(info, callback);
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
  static updateChatMessage(info: any, callback: ReturnCallback) {
    const msg = this.createMessage(info);
    this.tryCatch(
      ChatClient.getInstance().chatManager.updateMessage(msg),
      callback,
      ChatClient.getInstance().chatManager.updateMessage.name,
    );
  }
  static removeMessagesBeforeTimestamp(info: any, callback: ReturnCallback) {
    // todo: no implement
    callback(undefined);
  }
  static fetchHistoryMessagesFromServer(info: any, callback: ReturnCallback) {
    const convId = info.conversationId;
    const convType = this.createConvType(info.conversationType);
    const pageSize = info.count;
    const startMsgId = info.startMessageId;
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchHistoryMessages(
        convId,
        convType,
        pageSize,
        startMsgId,
      ),
      callback,
      ChatClient.getInstance().chatManager.fetchHistoryMessages.name,
    );
  }
  static getConversationsFromServer(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.fetchAllConversations(),
      callback,
      ChatClient.getInstance().chatManager.fetchAllConversations.name,
    );
  }
  static deleteConversationFromServer(info: any, callback: ReturnCallback) {
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
  static loadAllConversations(info: any, callback: ReturnCallback) {
    this.tryCatch(
      ChatClient.getInstance().chatManager.getAllConversations(),
      callback,
      ChatClient.getInstance().chatManager.getAllConversations.name,
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

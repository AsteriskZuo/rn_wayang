import {ChatClient} from 'react-native-chat-sdk';
import {ReturnCallback} from '../RNWS';
import {BizBase} from './BizBase';

export class BizChatUserInfoManager extends BizBase {
  static fetchUserInfoByUserId(info: any, callback: ReturnCallback) {
    const userIds = (info.ids as string).split(',');
    this.tryCatch(
      ChatClient.getInstance().userManager.fetchUserInfoById(userIds),
      callback,
      ChatClient.getInstance().userManager.fetchUserInfoById.name,
    );
  }
  static updateOwnInfo(info: any, callback: ReturnCallback) {
    const nickName = info.nickName ?? '';
    const avatarUrl = info.avatarUrl ?? '';
    const mail = info.email ?? '';
    const phone = info.phone ?? '';
    const gender = info.gender ?? 0;
    const sign = info.sign ?? '';
    const birth = info.birth ?? '';
    const ext = info.ext ?? '';
    this.tryCatch(
      ChatClient.getInstance().userManager.updateOwnUserInfo({
        nickName,
        avatarUrl,
        mail,
        phone,
        gender,
        sign,
        birth,
        ext,
      }),
      callback,
      ChatClient.getInstance().userManager.updateOwnUserInfo.name,
    );
  }
}

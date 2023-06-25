# wayang 测试说明

wayang 主要分为三个部分。

- 测试客户端 `jmeter`： 由测试人员使用，需要更新测试用例和执行测试用例。
- 转发服务器： 目前 agora.io 提供了默认的服务器 `webdemo.agora.io`, 这里也提供了本地服务器： `examples/wayang_server`
- SDK 接口客户端：主要用来执行测试客户端传过来的命令，将结果返回给测试客户端。

## 测试客户端

测试客户端默认是 `jmeter` 客户端，需要手动下载客户端，里面的测试数据在本仓库提供，维护和管理方便。

测试数据所在文件夹： `jmeter/data` 。

测试配置：主要是转发服务器和其他配置在对应的 `jmx` 文件夹内。

## 转发服务器

转发服务器是需要先运行的。

默认服务器地址： `webdemo.agora.io`
端口：`8083`
协议：https websocket

本地服务器可以在网络不稳定的情况下使用。
运行命令： 切换到 服务器 目录 , 在执行

```sh
cd examples/wayang_server
yarn run start
```

**注意** 如果是首次运行，需要执行 `yarn` 来安装依赖。
**说明** 本地服务器的端口和地址可以修改。默认 `localhost:8083`

## SDK 接口客户端

SDK 接口客户端用来执行实际的测试操作。需要在 测试客户端运行之前启动。

SDK 接口客户端本质上是普通的 `iOS` 或者 `Android` 应用。

该客户端提供了，开始、结束和现实日志的基本功能。

点击开始，连接到转发服务器，监听命令，点击结束断开连接。

连接地址和端口可以自行设定。默认 `localhost:8083`

```typescript
// src/RNWS.ts
this.host = 'localhost';
this.port = 8083;
```

## 测试执行流程

1. 运行转发服务器（如果是声网提供的则不需要此步骤）
2. 设置和运行 SDK 接口客户端
3. 设置和运行测试客户端
4. 开始执行测试指令

## 更新测试用例流程

由于 SDK 是不断升级和更新的，所以，测试相关内容也需要更新。

最小更新内容如下：

1. 更新 sdk 版本（在 package.json 文件中）
2. 更新测试客户端 `jmx` 内容
3. 更新 SDK 接口客户端 `ts` 内容

举例：添加获取群组已读回执接口测试用例。

`jmx` 部分省略。

`ts` 部分。

```typescript
// src/biz/BizChatManager.ts
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
```

```typescript
// src/Dispatch.ts
dispatch(data: any, callback: ReturnCallback): boolean {
    //...
    // case 'fetchGroupReadAcks': {
    //       BizChatManager.fetchGroupReadAcks(info, callback);
    //       break;
    //     }
    //...
}
```

**注意** 不同接口可能有不同的返回值，有的接口甚至没有返回值。需要使用者针对不用情况进行判断。对于没有返回值的接口，可以使用其他接口的结果作为判断依据。例如：发送一条消息，通过获取最后一条消息接口来验证发送的消息。

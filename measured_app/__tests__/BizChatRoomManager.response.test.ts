jest.mock('react-native-chat-sdk', () => ({
  ChatClient: {
    getInstance: jest.fn(),
  },
}));

import {ChatClient} from 'react-native-chat-sdk';
import {BizChatRoomManager} from '../src/biz/BizChatRoomManager';

const mockedChatClient = ChatClient as jest.Mocked<typeof ChatClient>;

describe('BizChatRoomManager response protocol behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('addAttributes forwards caller-provided attributes array', async () => {
    const addAttributes = jest.fn().mockResolvedValue(new Map());
    mockedChatClient.getInstance.mockReturnValue({
      roomManager: {
        addAttributes,
      },
    } as any);
    const callback = jest.fn();

    BizChatRoomManager.addAttributes(
      {
        roomId: 'room-1',
        attributes: [{jmeter_attr: 'value'}],
        deleteWhenLeft: false,
        overwrite: true,
      },
      callback,
    );

    expect(addAttributes).toHaveBeenCalledWith({
      roomId: 'room-1',
      attributes: [{jmeter_attr: 'value'}],
      deleteWhenLeft: false,
      overwrite: true,
    });
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith(new Map());
  });

  test('fetchChatRoomAttributes serializes SDK Map results as a plain object', async () => {
    const attributes = new Map([['jmeter_attr', 'value']]);
    const fetchChatRoomAttributes = jest.fn().mockResolvedValue(attributes);
    mockedChatClient.getInstance.mockReturnValue({
      roomManager: {
        fetchChatRoomAttributes,
      },
    } as any);
    const callback = jest.fn();

    BizChatRoomManager.fetchChatRoomAttributes(
      {roomId: 'room-1', keys: 'jmeter_attr'},
      callback,
    );

    expect(fetchChatRoomAttributes).toHaveBeenCalledWith('room-1', [
      'jmeter_attr',
    ]);
    await Promise.resolve();
    await Promise.resolve();
    expect(callback).toHaveBeenCalledWith({jmeter_attr: 'value'});
  });
});

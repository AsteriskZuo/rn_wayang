jest.mock('../src/dispatch/index', () => ({
  dispatchChatClient: jest.fn(() => false),
  dispatchChatManager: jest.fn(() => false),
  dispatchChatGroupManager: jest.fn(() => false),
  dispatchChatRoomManager: jest.fn(() => false),
  dispatchChatContactManager: jest.fn(() => false),
  dispatchChatPresenceManager: jest.fn(() => false),
  dispatchChatPushManager: jest.fn(() => false),
  dispatchChatUserInfoManager: jest.fn(() => false),
  dispatchInternal: jest.fn(() => false),
}));

import {Dispatch} from '../src/Dispatch';
import * as routes from '../src/dispatch/index';

const mockedRoutes = routes as jest.Mocked<typeof routes>;

function resetRoutes() {
  mockedRoutes.dispatchChatClient.mockReturnValue(false);
  mockedRoutes.dispatchChatManager.mockReturnValue(false);
  mockedRoutes.dispatchChatGroupManager.mockReturnValue(false);
  mockedRoutes.dispatchChatRoomManager.mockReturnValue(false);
  mockedRoutes.dispatchChatContactManager.mockReturnValue(false);
  mockedRoutes.dispatchChatPresenceManager.mockReturnValue(false);
  mockedRoutes.dispatchChatPushManager.mockReturnValue(false);
  mockedRoutes.dispatchChatUserInfoManager.mockReturnValue(false);
  mockedRoutes.dispatchInternal.mockReturnValue(false);
}

describe('Dispatch unified response protocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRoutes();
  });

  test('wraps routed API callback values', () => {
    mockedRoutes.dispatchChatClient.mockImplementation(
      (_cmd, _info, callback) => {
        callback('connected');
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatClient.isConnected'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: 'connected'});
  });

  test('wraps routed API callback undefined as null', () => {
    mockedRoutes.dispatchInternal.mockImplementation(
      (_cmd, _info, callback) => {
        callback(undefined);
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'addConnectionDelegate'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: null});
  });

  test('wraps routed API error objects as value', () => {
    const sdkError = {code: 1, message: 'sdk error'};
    mockedRoutes.dispatchChatManager.mockImplementation(
      (_cmd, _info, callback) => {
        callback(sdkError);
        return true;
      },
    );
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatManager.sendMessage'}),
      callback,
    );

    expect(handled).toBe(true);
    expect(callback).toHaveBeenCalledWith({ok: true, value: sdkError});
  });

  test('returns invalid_json protocol error', () => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch('{not json', callback);

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'invalid_json',
        message: 'request body is not valid JSON',
        details: {data: '{not json'},
      },
    });
  });

  test.each([
    [{}],
    [{cmd: ''}],
    [{cmd: '   '}],
    [{cmd: 123}],
  ])('returns invalid_command protocol error for %p', request => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(JSON.stringify(request), callback);

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'invalid_command',
        message: 'request cmd must be a non-empty string',
        details: {cmd: (request as any).cmd},
      },
    });
  });

  test('returns unknown_command protocol error', () => {
    const callback = jest.fn();

    const handled = new Dispatch().dispatch(
      JSON.stringify({cmd: 'ChatManager.nope'}),
      callback,
    );

    expect(handled).toBe(false);
    expect(callback).toHaveBeenCalledWith({
      type: 'protocol_error',
      error: {
        type: 'unknown_command',
        message: 'unknown command: ChatManager.nope',
        details: {cmd: 'ChatManager.nope'},
      },
    });
  });
});

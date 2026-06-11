import {
  protocolError,
  wrapApiCallback,
} from '../src/dispatch/Response';

describe('response helpers', () => {
  test('wrapApiCallback wraps ordinary values', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);

    apiCallback({userId: 'u1'});

    expect(callback).toHaveBeenCalledWith({
      ok: true,
      value: {userId: 'u1'},
    });
  });

  test('wrapApiCallback normalizes undefined to null', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);

    apiCallback(undefined);

    expect(callback).toHaveBeenCalledWith({ok: true, value: null});
  });

  test('wrapApiCallback keeps error objects as value', () => {
    const callback = jest.fn();
    const apiCallback = wrapApiCallback(callback);
    const error = {code: 1, message: 'sdk error'};

    apiCallback(error);

    expect(callback).toHaveBeenCalledWith({ok: true, value: error});
  });

  test('protocolError builds protocol error responses with details', () => {
    expect(
      protocolError('unknown_command', 'unknown command: ChatManager.foo', {
        cmd: 'ChatManager.foo',
      }),
    ).toEqual({
      type: 'protocol_error',
      error: {
        type: 'unknown_command',
        message: 'unknown command: ChatManager.foo',
        details: {cmd: 'ChatManager.foo'},
      },
    });
  });

  test('protocolError omits details when none are provided', () => {
    expect(protocolError('invalid_json', 'request body is not valid JSON')).toEqual({
      type: 'protocol_error',
      error: {
        type: 'invalid_json',
        message: 'request body is not valid JSON',
      },
    });
  });
});

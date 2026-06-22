import {RNWS} from '../src/RNWS';

describe('RNWS response sending', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('send(undefined) serializes an API null response instead of no return data', () => {
    const rnws = new RNWS();
    const send = jest.fn();
    (rnws as any).ws = {send};

    rnws.send(undefined);

    expect(send).toHaveBeenCalledWith(JSON.stringify({ok: true, value: null}));
    expect(send).not.toHaveBeenCalledWith('no return data');
  });

  test('start closes an existing socket before opening a replacement', () => {
    const close = jest.fn();
    const sockets: Array<{close: jest.Mock; send: jest.Mock}> = [];
    const WebSocketMock = jest.fn().mockImplementation(() => {
      const socket = {close, send: jest.fn()};
      sockets.push(socket);
      return socket;
    });
    jest
      .spyOn(globalThis as any, 'WebSocket')
      .mockImplementation(WebSocketMock);

    const rnws = new RNWS();
    rnws.start();
    rnws.start();

    expect(WebSocketMock).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    expect((rnws as any).ws).toBe(sockets[1]);
  });
});

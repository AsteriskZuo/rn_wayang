import {RNWS} from '../src/RNWS';
import {Logger} from '../src/Logger';

type MockSocket = {
  close: jest.Mock;
  send: jest.Mock;
  onopen?: () => void;
  onerror?: (event: {message?: string}) => void;
  onclose?: (event: {code?: number; reason?: string}) => void;
};

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

  test('emits state transitions for successful start and stop', () => {
    const rawLog = jest.spyOn(Logger.raw, 'log').mockImplementation(() => {});
    const close = jest.fn();
    const socket: MockSocket = {close, send: jest.fn()};
    jest
      .spyOn(globalThis as any, 'WebSocket')
      .mockImplementation(() => socket);

    const rnws = new RNWS();
    const statuses: Array<{state: string; address: string}> = [];
    rnws.setStatusListener(status => statuses.push(status));

    rnws.start();
    socket.onopen?.();
    rnws.stop();

    expect(statuses.map(status => status.state)).toEqual([
      'starting',
      'started',
      'stopped',
    ]);
    expect(rawLog).toHaveBeenCalledWith('RNWS: state: stopped -> starting');
    expect(rawLog).toHaveBeenCalledWith('RNWS: state: starting -> started');
    expect(rawLog).toHaveBeenCalledWith('RNWS: state: started -> stopped');
    expect(close).toHaveBeenCalledTimes(1);
  });

  test('returns to stopped when socket start errors', () => {
    const socket: MockSocket = {close: jest.fn(), send: jest.fn()};
    jest
      .spyOn(globalThis as any, 'WebSocket')
      .mockImplementation(() => socket);

    const rnws = new RNWS();
    const statuses: Array<{state: string; detail?: string}> = [];
    rnws.setStatusListener(status => statuses.push(status));

    rnws.start();
    socket.onerror?.({message: 'connection refused'});

    expect(statuses).toEqual([
      expect.objectContaining({state: 'starting'}),
      expect.objectContaining({
        state: 'stopped',
        detail: 'connection refused',
      }),
    ]);
  });

  test('ignores close events from a socket replaced by a new start', () => {
    const sockets: MockSocket[] = [];
    jest.spyOn(globalThis as any, 'WebSocket').mockImplementation(() => {
      const socket: MockSocket = {close: jest.fn(), send: jest.fn()};
      sockets.push(socket);
      return socket;
    });

    const rnws = new RNWS();
    const statuses: Array<{state: string; detail?: string}> = [];
    rnws.setStatusListener(status => statuses.push(status));

    rnws.start();
    rnws.start();
    sockets[0].onclose?.({code: 1000, reason: 'old socket closed'});

    expect(statuses.map(status => status.state)).toEqual([
      'starting',
      'starting',
    ]);
    expect(statuses).not.toContainEqual(
      expect.objectContaining({
        state: 'stopped',
        detail: 'old socket closed',
      }),
    );
  });
});

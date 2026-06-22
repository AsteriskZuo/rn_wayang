import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import PuppetApp from '../src/App';
import {Logger} from '../src/Logger';
import {RNWS} from '../src/RNWS';

jest.mock('../src/Dispatch', () => ({
  Dispatch: jest.fn(),
}));

jest.mock('../src/RNWS', () => {
  let statusListener: ((status: {state: string; address: string}) => void) | undefined;
  const instance = {
    addListener: jest.fn(),
    clearListener: jest.fn(),
    setHost: jest.fn(),
    setPort: jest.fn(),
    setTopic: jest.fn(),
    setStatusListener: jest.fn(listener => {
      statusListener = listener;
    }),
    start: jest.fn(() => {
      statusListener?.({
        state: 'starting',
        address: 'ws://10.0.2.2:8083/iov/websocket/dual?topic=rn-auto',
      });
    }),
    stop: jest.fn(),
  };

  return {
    RNWS: {
      getInstance: jest.fn(() => instance),
    },
  };
});

const mockedRNWS = RNWS as jest.Mocked<typeof RNWS>;

function getRNWSInstance() {
  return mockedRNWS.getInstance() as unknown as {
    addListener: jest.Mock;
    clearListener: jest.Mock;
    setHost: jest.Mock;
    setPort: jest.Mock;
    setTopic: jest.Mock;
    setStatusListener: jest.Mock;
    start: jest.Mock;
    stop: jest.Mock;
  };
}

describe('puppet App launch config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Logger.raw.setEnabled(false);
    Logger.json.setEnabled(false);
  });

  test('initializes relay config, logs, and auto-start from props', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <PuppetApp
          relayHost="10.0.2.2"
          relayPort={8083}
          relayTopic="rn-auto"
          autoStart={true}
          rawLog={true}
          jsonLog={true}
        />,
      );
    });

    const rnws = getRNWSInstance();
    expect(rnws.setHost).toHaveBeenCalledWith('10.0.2.2');
    expect(rnws.setPort).toHaveBeenCalledWith(8083);
    expect(rnws.setTopic).toHaveBeenCalledWith('rn-auto');
    expect(rnws.start).toHaveBeenCalledTimes(1);
    expect(Logger.raw.isEnabled()).toBe(true);
    expect(Logger.json.isEnabled()).toBe(true);

    const root = renderer!.root;
    expect(root.findByProps({testID: 'relay-host-input'}).props.value).toBe(
      '10.0.2.2',
    );
    expect(root.findByProps({testID: 'relay-port-input'}).props.value).toBe(
      '8083',
    );
    expect(root.findByProps({testID: 'relay-topic-input'}).props.value).toBe(
      'rn-auto',
    );
    expect(root.findByProps({testID: 'relay-toggle-button'}).props.children).toBe(
      'STARTING...',
    );
  });

  test('auto-start runs only once when manual UI fields change', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <PuppetApp relayHost="10.0.2.2" autoStart={true} />,
      );
    });

    const rnws = getRNWSInstance();
    expect(rnws.start).toHaveBeenCalledTimes(1);

    await ReactTestRenderer.act(async () => {
      renderer!.root
        .findByProps({testID: 'relay-host-input'})
        .props.onChangeText('localhost');
    });

    expect(rnws.start).toHaveBeenCalledTimes(1);
  });
});

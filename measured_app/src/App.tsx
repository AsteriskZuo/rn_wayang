/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React from 'react';
import {ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Dispatch} from './Dispatch';
import {Logger} from './Logger';
import {ConnectionStatus, RNWS} from './RNWS';

export type AppLaunchProps = {
  relayHost?: string;
  relayPort?: number | string;
  relayTopic?: string;
  autoStart?: boolean;
  rawLog?: boolean;
  jsonLog?: boolean;
};

function normalizePort(port?: number | string): string {
  if (typeof port === 'number' && Number.isFinite(port) && port > 0) {
    return String(port);
  }
  if (typeof port === 'string' && port.trim().length > 0) {
    const value = Number(port.trim());
    if (Number.isFinite(value) && value > 0) {
      return String(value);
    }
  }
  return '8083';
}

function normalizeText(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

const App = ({
  relayHost,
  relayPort,
  relayTopic,
  autoStart = false,
  rawLog = false,
  jsonLog = false,
}: AppLaunchProps) => {
  const title = 'React-Native-WaYang';
  const [logText, setWarnText] = React.useState('Show log area');
  const [count, setCount] = React.useState(0);
  const [rawLogEnabled, setRawLogEnabled] = React.useState(rawLog);
  const [jsonLogEnabled, setJsonLogEnabled] = React.useState(jsonLog);
  const [host, setHost] = React.useState(
    normalizeText(relayHost, 'localhost'),
  );
  const [port, setPort] = React.useState(normalizePort(relayPort));
  const [topic, setTopic] = React.useState(normalizeText(relayTopic, 'rn'));
  const [connectionStatus, setConnectionStatus] =
    React.useState<ConnectionStatus>({
      state: 'stopped',
      address: '',
    });
  const autoStartHandled = React.useRef(false);

  const connectionState = connectionStatus.state;

  const rollLog = (text: string) => {
    setWarnText(preLogText => {
      let newLogText = text;
      preLogText
        .split('\n')
        .filter((value, index, _array) => {
          if (index > 8) {
            return false;
          }
          return true;
        })
        .forEach((value, _index, _array) => {
          newLogText += '\n' + value;
        });
      return newLogText;
    });
  };

  const configureRNWS = React.useCallback(() => {
    const rnws = RNWS.getInstance();
    rnws.clearListener();
    rnws.addListener(new Dispatch());
    rnws.setHost(host.trim() || 'localhost');
    rnws.setPort(Number(port.trim()) || 8083);
    rnws.setTopic(topic.trim() || 'rn');
    return rnws;
  }, [host, port, topic]);

  const start = React.useCallback(() => {
    rollLog(count.toString());
    setCount(count + 1);
    configureRNWS().start();
  }, [configureRNWS, count]);

  const stop = React.useCallback(() => {
    RNWS.getInstance().clearListener();
    RNWS.getInstance().stop();
  }, []);

  const toggleConnection = () => {
    if (connectionState === 'stopped') {
      start();
    } else if (connectionState === 'started') {
      stop();
    }
  };

  const toggleRawLog = () => {
    const next = !rawLogEnabled;
    Logger.raw.setEnabled(next);
    setRawLogEnabled(next);
  };
  const toggleJsonLog = () => {
    const next = !jsonLogEnabled;
    Logger.json.setEnabled(next);
    setJsonLogEnabled(next);
  };

  React.useEffect(() => {
    Logger.raw.setEnabled(rawLog);
    Logger.json.setEnabled(jsonLog);
  }, [rawLog, jsonLog]);

  React.useEffect(() => {
    const rnws = RNWS.getInstance();
    rnws.setStatusListener(status => {
      setConnectionStatus(status);
      rollLog(
        status.detail
          ? `Status: ${status.state}: ${status.detail}`
          : `Status: ${status.state}`,
      );
    });
    return () => rnws.setStatusListener(undefined);
  }, []);

  React.useEffect(() => {
    if (autoStart && !autoStartHandled.current) {
      autoStartHandled.current = true;
      configureRNWS().start();
    }
  }, [autoStart, configureRNWS]);

  const statusAddress =
    connectionStatus.address ||
    `ws://${host.trim() || 'localhost'}:${Number(port.trim()) || 8083}/iov/websocket/dual?topic=${topic.trim() || 'rn'}`;
  const statusText = connectionStatus.detail
    ? `Status: ${connectionState}: ${connectionStatus.detail}`
    : `Status: ${connectionState} ${statusAddress}`.trim();
  const connectionButtonLabel =
    connectionState === 'started'
      ? 'STOP'
      : connectionState === 'starting'
        ? 'STARTING...'
        : 'START';
  const connectionButtonDisabled = connectionState === 'starting';

  return (
    <SafeAreaView>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView>
        <View style={styles.inputCon}>
          <Text style={styles.inputLabel}>HOST</Text>
          <TextInput
            testID="relay-host-input"
            style={styles.input}
            value={host}
            onChangeText={setHost}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="localhost"
          />
        </View>
        <View style={styles.inputCon}>
          <Text style={styles.inputLabel}>PORT</Text>
          <TextInput
            testID="relay-port-input"
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            placeholder="8083"
          />
        </View>
        <View style={styles.inputCon}>
          <Text style={styles.inputLabel}>TOPIC</Text>
          <TextInput
            testID="relay-topic-input"
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="rn"
          />
        </View>
        <View style={styles.statusCon}>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
        <View style={styles.buttonCon}>
          <Text
            testID="relay-toggle-button"
            style={[
              styles.btn2,
              connectionButtonDisabled ? styles.btnDisabled : null,
            ]}
            onPress={connectionButtonDisabled ? undefined : toggleConnection}>
            {connectionButtonLabel}
          </Text>
        </View>
        <View style={styles.buttonCon}>
          <Text style={styles.btn2} onPress={toggleRawLog}>
            {rawLogEnabled ? 'RAW LOG ON' : 'RAW LOG OFF'}
          </Text>
        </View>
        <View style={styles.buttonCon}>
          <Text style={styles.btn2} onPress={toggleJsonLog}>
            {jsonLogEnabled ? 'JSON LOG ON' : 'JSON LOG OFF'}
          </Text>
        </View>
        <View>
          <Text style={styles.logText} numberOfLines={10}>
            {logText}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  titleContainer: {
    height: 60,
    backgroundColor: '#6200ED',
  },
  title: {
    lineHeight: 60,
    paddingLeft: 15,
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonCon: {
    marginLeft: '2%',
    width: '96%',
    flexDirection: 'row',
    marginTop: 20,
    height: 26,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  inputCon: {
    marginLeft: '2%',
    width: '96%',
    marginTop: 20,
  },
  inputLabel: {
    color: '#333',
    fontSize: 14,
    marginBottom: 6,
  },
  input: {
    height: 40,
    borderColor: '#6200ED',
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    color: '#333',
  },
  statusCon: {
    marginLeft: '2%',
    width: '96%',
    marginTop: 20,
  },
  statusText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  btn2: {
    height: 40,
    width: '45%',
    lineHeight: 40,
    textAlign: 'center',
    color: '#fff',
    fontSize: 16,
    backgroundColor: '#6200ED',
    borderRadius: 5,
  },
  btnDisabled: {
    backgroundColor: '#8D8D8D',
  },
  logText: {
    padding: 10,
    marginTop: 10,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default App;

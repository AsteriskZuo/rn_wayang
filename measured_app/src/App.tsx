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
import {RNWS} from './RNWS';

const App = () => {
  const title = 'React-Native-WaYang';
  const [logText, setWarnText] = React.useState('Show log area');
  const [count, setCount] = React.useState(0);
  const [rawLogEnabled, setRawLogEnabled] = React.useState(false);
  const [jsonLogEnabled, setJsonLogEnabled] = React.useState(false);
  const [host, setHost] = React.useState('localhost');
  const [port, setPort] = React.useState('8083');

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

  const start = () => {
    rollLog(count.toString());
    setCount(count + 1);
    RNWS.getInstance().clearListener();
    RNWS.getInstance().addListener(new Dispatch());
    RNWS.getInstance().setHost(host.trim() || 'localhost');
    RNWS.getInstance().setPort(Number(port.trim()) || 8083);
    RNWS.getInstance().start();
  };
  const stop = () => {
    RNWS.getInstance().clearListener();
    RNWS.getInstance().stop();
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

  return (
    <SafeAreaView>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView>
        <View style={styles.inputCon}>
          <Text style={styles.inputLabel}>HOST</Text>
          <TextInput
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
            style={styles.input}
            value={port}
            onChangeText={setPort}
            keyboardType="number-pad"
            placeholder="8083"
          />
        </View>
        <View style={styles.buttonCon}>
          <Text style={styles.btn2} onPress={start}>
            START
          </Text>
        </View>
        <View style={styles.buttonCon}>
          <Text style={styles.btn2} onPress={stop}>
            STOP
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
  logText: {
    padding: 10,
    marginTop: 10,
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default App;

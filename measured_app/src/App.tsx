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
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Dispatch} from './Dispatch';
import {RNWS} from './RNWS';

const App = () => {
  const title = 'React-Native-WaYang';
  const [logText, setWarnText] = React.useState('Show log area');
  const [count, setCount] = React.useState(0);

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
    RNWS.getInstance().start();
  };
  const stop = () => {
    RNWS.getInstance().clearListener();
    RNWS.getInstance().stop();
  };

  return (
    <SafeAreaView>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <ScrollView>
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

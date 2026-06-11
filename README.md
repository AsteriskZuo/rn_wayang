# rn_wayang

Repository structure:

- `forward_server/` - Node.js WebSocket relay used to forward messages between test drivers and the React Native app.
- `measured_app/` - React Native app that exposes `react-native-chat-sdk` behavior through remote commands.
- `jmeter/` - JMeter test plans and related configuration for driving the app through the relay.
- `docs/` - Project notes and supporting documentation.

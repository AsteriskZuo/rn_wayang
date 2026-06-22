import fs from 'fs';
import path from 'path';

describe('iOS launch config bridge', () => {
  const appDelegatePath = path.join(
    __dirname,
    '..',
    'ios',
    'rn_wayang',
    'AppDelegate.swift',
  );

  test('passes simctl launch arguments into React Native initial props', () => {
    const appDelegate = fs.readFileSync(appDelegatePath, 'utf8');

    expect(appDelegate).toContain('launchConfigInitialProperties');
    expect(appDelegate).toContain('initialProperties: launchConfigInitialProperties()');
    expect(appDelegate).toContain('"--relayHost": "relayHost"');
    expect(appDelegate).toContain('"--relayPort": "relayPort"');
    expect(appDelegate).toContain('"--relayTopic": "relayTopic"');
    expect(appDelegate).toContain('"--autoStart": "autoStart"');
    expect(appDelegate).toContain('"--rawLog": "rawLog"');
    expect(appDelegate).toContain('"--jsonLog": "jsonLog"');
  });
});

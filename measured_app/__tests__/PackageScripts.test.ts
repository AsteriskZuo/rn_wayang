import packageJson from '../package.json';

describe('package scripts', () => {
  test('includes TypeScript typecheck command', () => {
    expect(packageJson.scripts.typecheck).toBe('tsc --noEmit');
  });
});

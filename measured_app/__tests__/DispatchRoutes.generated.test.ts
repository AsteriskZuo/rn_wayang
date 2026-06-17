/// <reference types="node" />

import fs from 'fs';
import path from 'path';

const dispatchRoot = path.resolve(__dirname, '../src/dispatch');

function readDispatchFile(fileName: string): string {
  return fs.readFileSync(path.join(dispatchRoot, fileName), 'utf8');
}

describe('generated dispatch routes', () => {
  test('routes ChatClient init and login through generated ChatClient dispatch', () => {
    const chatClientRoutes = readDispatchFile('ChatClient.generated.ts');
    const internalRoutes = readDispatchFile('Internal.ts');

    expect(chatClientRoutes).toContain("case 'ChatClient.init':");
    expect(chatClientRoutes).toContain('BizChatClient.init(info, callback);');
    expect(chatClientRoutes).toContain("case 'ChatClient.login':");
    expect(chatClientRoutes).toContain('BizChatClient.login(info, callback);');

    expect(internalRoutes).not.toContain("case 'init':");
    expect(internalRoutes).not.toContain("case 'login':");
  });
});

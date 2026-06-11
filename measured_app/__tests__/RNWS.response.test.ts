import {RNWS} from '../src/RNWS';

describe('RNWS response sending', () => {
  test('send(undefined) serializes an API null response instead of no return data', () => {
    const rnws = new RNWS();
    const send = jest.fn();
    (rnws as any).ws = {send};

    rnws.send(undefined);

    expect(send).toHaveBeenCalledWith(JSON.stringify({ok: true, value: null}));
    expect(send).not.toHaveBeenCalledWith('no return data');
  });
});

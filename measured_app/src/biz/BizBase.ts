import {Logger} from '../Logger';
import {ReturnCallback} from '../RNWS';

export abstract class BizBase {
  protected static tryCatch(
    result: Promise<any>,
    callback?: ReturnCallback,
    tag?: string,
  ): void {
    Logger.json.log(`${tag}: call`);
    result
      .then((value: any) => {
        // if (typeof value === 'string') {
        //   callback(value);
        // } else if (typeof value === 'object') {
        //   callback(JSON.stringify(value));
        // } else {
        Logger.json.log(`${tag}: success:`, value);
        callback?.(value);
        // }
      })
      .catch((error: any) => {
        Logger.json.error(`${tag}: error:`, error);
        callback?.(error);
      });
  }
}

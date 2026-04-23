import {ReturnCallback} from '../RNWS';

export abstract class BizBase {
  protected static tryCatch(
    result: Promise<any>,
    callback?: ReturnCallback,
    tag?: string,
  ): void {
    console.log(tag);
    result
      .then((value: any) => {
        // if (typeof value === 'string') {
        //   callback(value);
        // } else if (typeof value === 'object') {
        //   callback(JSON.stringify(value));
        // } else {
        callback?.(value);
        // }
      })
      .catch((error: any) => {
        callback?.(error);
      });
  }
}

type LogFunction = (...args: any[]) => void;

class LogChannel {
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.log(...args);
    }
  };

  warn: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.warn(...args);
    }
  };

  error: LogFunction = (...args: any[]) => {
    if (this.enabled) {
      console.error(...args);
    }
  };
}

class JsonLogChannel extends LogChannel {
  private normalize(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  log: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.log(...args.map(arg => this.normalize(arg)));
    }
  };

  warn: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.warn(...args.map(arg => this.normalize(arg)));
    }
  };

  error: LogFunction = (...args: any[]) => {
    if (this.isEnabled()) {
      console.error(...args.map(arg => this.normalize(arg)));
    }
  };
}

export class Logger {
  static raw = new LogChannel();
  static json = new JsonLogChannel();
}

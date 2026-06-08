class LogChannel {
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  log(...args: any[]): void {
    if (this.enabled) {
      console.log(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.enabled) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    if (this.enabled) {
      console.error(...args);
    }
  }
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

  override log(...args: any[]): void {
    super.log(...args.map(arg => this.normalize(arg)));
  }

  override warn(...args: any[]): void {
    super.warn(...args.map(arg => this.normalize(arg)));
  }

  override error(...args: any[]): void {
    super.error(...args.map(arg => this.normalize(arg)));
  }
}

export class Logger {
  static raw = new LogChannel();
  static json = new JsonLogChannel();
}

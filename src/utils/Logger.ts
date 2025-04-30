export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info_',
  WARN = 'warn_',
  ERROR = 'error',
  FATAL = 'fatal',
  NONE = 'none',
}

const COLORS = {
  [LogLevel.INFO]: '\x1b[32m',
  [LogLevel.DEBUG]: '\x1b[36m',
  [LogLevel.WARN]: '\x1b[33m',
  [LogLevel.ERROR]: '\x1b[31m',
  [LogLevel.FATAL]: '\x1b[31m\x1b[1m',
  reset: '\x1b[0m',
}

// 权重
const LogLevelWeight: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
  [LogLevel.NONE]: 5,
}

export class Logger {
  constructor(private level: LogLevel = LogLevel.INFO, private prefix?: string) {
  }

  public setLevel(level: LogLevel): void {
    this.level = level
  }

  public getLevel(): LogLevel {
    return this.level
  }

  private shouldLog(messageLevel: LogLevel): boolean {
    return LogLevelWeight[messageLevel] >= LogLevelWeight[this.level] && this.level !== LogLevel.NONE
  }

  private formatPrefix(level: LogLevel): string {
    const time = new Date().toLocaleTimeString()
    const message = `${COLORS[level as keyof typeof COLORS]}${level}:${COLORS.reset} ${time}`
    return message + (this.prefix == null ? '' : ` ${this.prefix}`)
  }

  public debug(...message: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatPrefix(LogLevel.DEBUG), ...message)
    }
  }

  public info(...message: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatPrefix(LogLevel.INFO), ...message)
    }
  }

  public warn(...message: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatPrefix(LogLevel.WARN), ...message)
    }
  }

  public error(...message: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatPrefix(LogLevel.ERROR), ...message)
    }
  }

  public fatal(...message: any[]): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      console.error(this.formatPrefix(LogLevel.FATAL), ...message)
    }
  }
}

export default Logger

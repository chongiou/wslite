export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function generateId() {
  return Math.random().toString(36).substring(2)
}

export { Device } from './device'
export { EventEmitter } from './EventEmitter'
export { LogLevel, Logger } from './Logger'

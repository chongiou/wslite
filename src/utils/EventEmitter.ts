type EventListener<T = any> = (data: T) => void

export class EventEmitter<EventMap extends Record<string, any> = {}> {
  #debug
  constructor(debug = false) {
    this.#debug = debug
  }

  private listeners: Map<keyof EventMap, EventListener[]> = new Map()

  once<K extends keyof EventMap>(event: K, listener: EventListener<EventMap[K]>): this {
    const onceListener: EventListener<EventMap[K]> = (data) => {
      listener(data)
      this.off(event, onceListener)
    }
    this.on(event, onceListener)
    return this
  }

  on<K extends keyof EventMap>(event: K, listener: EventListener<EventMap[K]>): this {
    const eventListeners = this.listeners.get(event) ?? []
    eventListeners.push(listener)
    this.listeners.set(event, eventListeners)
    this.#debug && console.log(`监听 ${String(event)} 事件`)
    return this
  }

  off<K extends keyof EventMap>(event: K, listener: EventListener<EventMap[K]>): this {
    const eventListeners = this.listeners.get(event) ?? []
    if (eventListeners.length > 0) {
      const index = eventListeners.indexOf(listener)
      if (index !== -1) {
        eventListeners.splice(index, 1)
        this.#debug && console.log(`移除 ${String(event)} 事件`)
      }
    } else {
      this.#debug && console.warn(`移除 ${String(event)} 事件监听器失败, 没有监听这样的事件`)
    }
    return this
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): this {
    const eventListeners = this.listeners.get(event) ?? []
    if (eventListeners.length > 0) {
      this.#debug && console.log(`触发 ${String(event)} 事件`)
      eventListeners.slice().forEach(listener => listener(data))
    } else {
      this.#debug && console.warn(`触发 ${String(event)} 事件监听器失败, 没有监听这样的事件`)
    }
    return this
  }
}

export default EventEmitter

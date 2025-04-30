import express from 'express'
import type { ClientId } from './types'
import type { Server } from 'node:http'
import { EventEmitter } from '@/utils/EventEmitter'
import { Logger, LogLevel } from '@/utils/Logger'

type Message = unknown
type ResponseContent = {
  ok: boolean
  message?: string
}

export class WebSocketClientConnection extends EventEmitter<{ message: Message; error: Error; close: void }> {
  constructor(public send: (message: Message) => void) {
    super()
  }
}

export class WebSocketServer extends EventEmitter<{ connection: WebSocketClientConnection; open: void; close: void }> {
  private pollConnects = new Map<ClientId, { response: express.Response }>()
  private messageQueues = new Map<ClientId, Message[]>()
  private clients = new Map<ClientId, WebSocketClientConnection>()
  private activeClients = new Set<string>()

  private app = express()
  private server!: Server

  private cleanupTimers: Map<ClientId, NodeJS.Timeout> = new Map()
  private POLL_INTERVAL_TIMEOUT = 2_000

  private logger: Logger
  private PORT: number

  constructor(
    port: number,
    options?: { immediateOpen?: boolean; logLevel?: LogLevel; pollIntervalTimeout?: number }
  ) {
    super()
    const { immediateOpen = true, logLevel = LogLevel.NONE, pollIntervalTimeout } = options ?? {}

    this.PORT = port
    this.logger = new Logger(logLevel, 'wss'.padEnd(6, ' '))
    this.setupServer()

    if (pollIntervalTimeout) this.POLL_INTERVAL_TIMEOUT = pollIntervalTimeout
    if (immediateOpen) this.open()
  }

  public getServerState() {
    return {
      '时间': new Date().toLocaleString(),
      '端口': this.PORT,
      '连接数': this.clients.size,
      '活跃客户端': this.activeClients.size,
      '消息队列': this.messageQueues.size,
      '清理定时器': this.cleanupTimers.size,
      'Poll Connects': this.pollConnects.size,
      '连接列表': [...this.clients.keys()]
    }
  }

  private setupServer() {
    this.app.use(express.text())

    this.app.get('/health', (req, res) => {
      res.status(200).json({ ok: true } satisfies ResponseContent)
    })

    this.app.get('/server-status', (req, res) => {
      res.status(200).json(this.getServerState())
    })

    // 预备连接
    this.app.get('/register/:clientId', (req, res) => {
      const clientId = req.params.clientId as ClientId
      if (!this.activeClients.has(clientId)) {
        this.activeClients.add(clientId)
        this.triggerNewConnection(clientId)
      }
      this.addCleanupTimer(clientId, 10_000)
      res.status(200).json({ ok: true } satisfies ResponseContent)
    })

    // 获取消息
    this.app.get('/poll/:clientId', (req, res) => {
      const clientId = req.params.clientId as ClientId

      if (!this.activeClients.has(clientId)) {
        res.status(403).json({ ok: false, message: '未注册' } satisfies ResponseContent)
        return
      }
      this.deleteCleanupTimer(clientId)

      // 处理之前的消息
      const pendingMessages = this.messageQueues.get(clientId) ?? []
      if (pendingMessages.length > 0) {
        res.status(200).json(pendingMessages)
        this.messageQueues.delete(clientId)
        return
      }

      this.pollConnects.set(clientId, { response: res })

      const timeout = setTimeout(() => {
        // 长轮询超时(30秒没有消息)
        res.status(200).json([])
        this.pollConnects.delete(clientId)
      }, 30000)

      req.on('close', () => {
        clearTimeout(timeout)
        this.pollConnects.delete(clientId)
        if (this.activeClients.has(clientId)) {
          this.addCleanupTimer(clientId)
        }
      })
    })

    // 发送消息
    this.app.post('/send/:clientId', (req, res) => {
      const clientId = req.params.clientId as ClientId
      if (!this.activeClients.has(clientId)) {
        res.status(403).json({ ok: false, message: 'client unregistered' } satisfies ResponseContent)
        return
      }
      const message = req.body as unknown
      const client = this.clients.get(clientId)
      if (client) {
        client.emit('message', message)
        res.status(200).json({ ok: true } satisfies ResponseContent)
      } else {
        this.logger.error(`服务端无法接收消息, ws 客户端 (${clientId}) 不存在`)
        res.status(500).json({ ok: false, message: 'client connect not exist' } satisfies ResponseContent)
      }
    })

    // 断开连接
    this.app.get('/disconnect/:clientId', (req, res) => {
      const clientId = req.params.clientId as ClientId
      this.logger.warn(`ws 客户端 (${clientId}) 要求断开连接`)
      this.cleanupClient(clientId)
      res.status(200).json({ ok: true } satisfies ResponseContent)
    })
  }

  private addCleanupTimer(clientId: ClientId, timeout?: number) {
    this.deleteCleanupTimer(clientId)

    // 时间内没有重连视为客户端断开
    const timer = setTimeout(() => {
      this.cleanupClient(clientId)
    }, timeout ?? this.POLL_INTERVAL_TIMEOUT)

    this.cleanupTimers.set(clientId, timer)
  }

  private deleteCleanupTimer(clientId: ClientId) {
    const timer = this.cleanupTimers.get(clientId)
    if (timer) {
      clearTimeout(timer)
      this.cleanupTimers.delete(clientId)
    }
  }

  private cleanupClient(clientId: ClientId) {
    this.clients.get(clientId)?.emit('close', undefined)

    const client = this.pollConnects.get(clientId)
    if (client && !client.response.writableEnded) client.response.status(200).json([])

    this.pollConnects.delete(clientId)
    this.clients.delete(clientId)
    this.activeClients.delete(clientId)
    this.messageQueues.delete(clientId)
    this.deleteCleanupTimer(clientId)

    this.logger.info(`ws 客户端 (${clientId}) 已清理`)
  }

  private sendMessageTo(clientId: ClientId, message: Message) {
    const client = this.pollConnects.get(clientId)

    if (client) {
      // 客户端在线，直接发送
      client.response.status(200).json([message])
      this.pollConnects.delete(clientId)
    }

    else {
      // 客户端离线，存入队列
      const queue = this.messageQueues.get(clientId) ?? []
      queue.push(message)
      this.messageQueues.set(clientId, queue)
    }
  }

  public async open() {
    return new Promise<void>(resolve => {
      this.server = this.app.listen(this.PORT, () => {
        this.logger.info(`ws服务已打开, 在端口 ${this.PORT}`)
        this.emit('open', undefined)
        resolve()
      })
    })
  }

  public async close() {
    this.clients.forEach(client => client.emit('close', undefined))
    this.clients.clear()
    this.activeClients.clear()
    this.messageQueues.clear()
    this.cleanupTimers.forEach(timer => clearTimeout(timer))
    this.cleanupTimers.clear()
    return new Promise<void>(resolve => {
      this.server.close(() => {
        this.logger.info(`wss 已关闭`)
        this.emit('close', undefined)
        resolve()
      })
    })
  }

  private triggerNewConnection(clientId: ClientId) {
    this.logger.info(`新连接 ${clientId}`)
    const client = new WebSocketClientConnection((message: Message) => {
      this.sendMessageTo(clientId, message)
    })
    this.clients.set(clientId, client)
    this.emit('connection', client)
  }
}

import { generateId } from "@/utils"
import { EventEmitter } from "@/utils/EventEmitter"
import { type ClientId } from "./types"
import { Logger, LogLevel } from "@/utils/Logger"
import { RUNTIME } from "@/config/env"
import { Err, Ok } from "@/types"

const logger = new Logger(LogLevel.NONE, 'ws-client')

export class WSError extends Error {
  public isWSError = true
  constructor(message: string, public ctx: { response?: Response, cause?: any } = {}) {
    super(message)
  }
}

export enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export class WebSocketClient extends EventEmitter<{ message: unknown; error: WSError; close: void; open: void, reconnected: Function }> {
  public readyState: ReadyState = ReadyState.CLOSED
  private webSocketClientId: ClientId = `ws_client_id_${generateId()}`

  constructor(private serverUrl: string, options?: { immediateConnect?: boolean; loglevel: LogLevel }) {
    super()
    const { immediateConnect = true, loglevel = LogLevel.NONE } = options ?? {}
    logger.setLevel(loglevel)
    if (immediateConnect) this.open()
  }

  public getWebSocketClientId() {
    return this.webSocketClientId
  }

  private async register() {
    try {
      return fetch(`${this.serverUrl}/register/${this.webSocketClientId}`)
    } catch (err) {
      logger.fatal('注册失败', err)
      throw new Error('注册失败')
    }
  }

  public async open() {
    if (this.readyState === ReadyState.OPEN || this.readyState === ReadyState.CONNECTING) {
      logger.warn('重复open, ws客户端已经打开或正在连接中')
      return
    }
    this.readyState = ReadyState.CONNECTING
    try {
      const response = await this.register()
      if (response.ok) {
        this.readyState = ReadyState.OPEN
        this.startPolling()
        this.emit('open', undefined)
      } else {
        const wsError = new WSError('server is not ready', { response })
        this.emit('error', wsError)
        throw wsError
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'fetch failed') {
        const wsError = new WSError(err.message)
        logger.error('网络错误', wsError)
        this.emit('error', wsError)
      }
      throw err
    }
  }

  public async close() {
    if (this.readyState === ReadyState.CLOSED || this.readyState === ReadyState.CLOSING) {
      logger.warn('重复close, ws客户端已经关闭或正在关闭中')
      return
    }
    this.readyState = ReadyState.CLOSING
    const response = await fetch(`${this.serverUrl}/disconnect/${this.webSocketClientId}`)
      .catch(err => {
        logger.fatal('无法关闭连接', err)
        throw err
      })
    if (response.ok) {
      this.readyState = ReadyState.CLOSED
      this.emit('close', undefined)
    } else {
      // ?
      throw new WSError('无法关闭连接', { response })
    }
  }

  public async send(data: any, headers: Record<string, any> = {}) {
    await this.reconnected
    const url = `${this.serverUrl}/send/${this.webSocketClientId}`
    const result = RUNTIME === 'zdjl'
      ? await zdjl.requestUrlAsync({
        url,
        method: 'POST',
        requestBody: data,
        headers: Object.entries({
          'content-type': 'text/plain',
          ...headers
        }).map(([key, value]) => ({ [key]: value })),
        requestType: 'TEXT',
        responseType: 'TEXT'
      })
        .then((resp: { code: number, body: string }) => {
          return new Ok(<Response>{
            ok: resp.code >= 200 && resp.code <= 299,
            status: resp.code,
            json: async () => JSON.parse(resp.body),
            text: async () => resp.body,
          })
        })
        .catch((err: any) => new Err(err))
      : await fetch(url, { method: 'POST', headers, body: data })
        .then(res => new Ok(res))
        .catch(err => new Err(err))

    if (result.ok) {
      const response = result.val
      if (!response.ok) {
        logger.error('消息发送失败:', response.status)
        if (response.status === 403) {
          logger.error('消息发送失败,意外断开,需要重新注册')
          if (this.readyState !== ReadyState.OPEN) {
            logger.error('消息并未发送,连接却已经关闭')
            this.emit('error', new WSError('消息发送失败,因为连接处于关闭状态', { response, cause: { message: { data, headers } } }))
            return
          } else {
            logger.info('重新发送消息')
            logger.debug('重新发送消息,详细信息:', { data, headers })
            this.send(data, headers)
            return
          }
        }
        const body = await response.json() as { ok: false, message?: string }
        const wsError = new WSError(body.message ?? response.statusText, { response })
        this.emit('error', wsError)
        throw wsError
      } else {
        logger.info('消息发送成功', { code: response.status })
        logger.debug('消息发送成功,详细信息:', { code: response.status, data, headers })
      }
    } else {
      const err = result.val
      if (err instanceof Error && err.message === 'fetch failed') {
        // TODO: 重试限次
        logger.info('重新发送消息')
        logger.debug('重新发送消息,详细信息:', { data, headers })
        this.send(data, headers)
        return
      } else {
        logger.error('未知错误', err)
        throw err
      }
    }
  }

  private reconnected?: Promise<any>
  private async startPolling() {
    let reconnectAttempts = 0
    const maxReconnectAttempts = 30
    const attemptsInterval = 500
    const pollUrl = `${this.serverUrl}/poll/${this.webSocketClientId}`

    const handleResponse = async (response: Response) => {
      if (!response.ok) {
        logger.error('消息获取失败:', { code: response.status })
        if (response.status === 403) {
          let doneReconnect!: Function
          this.reconnected = new Promise(resolve => doneReconnect = resolve)
            .finally(() => {
              this.reconnected = undefined
            })
          logger.error('消息获取失败,意外断开,即将重新注册')
          this.emit('error', new WSError('消息获取失败,意外断开,即将重新注册', { response }))
          await this.register()
          this.emit('reconnected', doneReconnect)
          if (typeof doneReconnect === 'function') {
            doneReconnect()
          }
          return
        }
        logger.error('请求错误', { code: response.status })
        this.emit('error', new WSError('请求错误', { response, cause: { code: response.status } }))
        this.close()
        return
      }

      const messages = await response.text()
        .then(res => {
          if (res.trim().startsWith('[')) {
            return JSON.parse(res)
          } else {
            logger.error('该消息格式异常,应为数组', { message: res })
            throw new WSError('消息无法解析,因为格式不正确', { response, cause: { messages } })
          }
        })
        .catch(err => {
          logger.error('解析json出错', err)
          return []
        })
      if (messages && Array.isArray(messages) && messages.length > 0) {
        this.handleMessages(messages)
      } else {
        logger.info('该消息不处理', { typeof: Object.prototype.toString.call(messages).slice(8, -1).toLowerCase(), messages })
      }
    }

    const receiveMessage = async () => {
      return RUNTIME === 'zdjl'
        // 在 zdjl 环境使用 fetch 偶现报错(Attempt to invoke virtual method 'l.b l.b.z()' on a null object reference)
        // 因此在这里使用 requestUrlAsync 接口进行网络请求
        ? zdjl.requestUrlAsync({ url: pollUrl }).then((resp: { code: number, body: string }) => {
          return <Response>{
            ok: resp.code >= 200 && resp.code <= 299,
            status: resp.code,
            json: async () => JSON.parse(resp.body),
            text: async () => resp.body,
          }
        })
        : fetch(pollUrl)
    }

    while (this.readyState === ReadyState.OPEN) {
      try {
        const resp = await receiveMessage()
        await handleResponse(resp)

        reconnectAttempts = 0
      } catch (err) {
        if (err instanceof Error) {
          logger.error('轮询错误:', err)
          this.emit('error', new WSError(err.message))
          reconnectAttempts++

          if (reconnectAttempts >= maxReconnectAttempts) {
            logger.error('已达到最大重试次数,关闭连接')
            this.emit('error', new WSError('已达到最大重试次数,关闭连接'))
            this.close()
            break
          } else {
            logger.error(`${attemptsInterval}ms 后尝试重连`)
          }

          await new Promise(resolve => setTimeout(resolve, attemptsInterval))
        } else {
          logger.error(err)
          throw err
        }
      }
    }
    logger.info('已关闭轮询')
  }

  private async handleMessages(messages: any[]) {
    messages.forEach(message => {
      this.emit('message', message)
    })
  }
}

import { WebSocketServer } from '../core/server'
import { PORT } from './env.test'

const wss = new WebSocketServer(PORT, {
  immediateOpen: true,
})

wss.on('connection', (ws) => {
  ws.send('hello from server')
  ws.on('message', (message: any) => {
    console.log('客户端来信:', message)
  })

  ws.on('close', () => {
    console.log('客户端关闭连接')
  })

  ws.on('error', (err: Error) => {
    console.error(err)
  })

  setInterval(() => {
    ws.send(new Date().toLocaleString())
  }, 1000)
})

wss.on('open', () => {
  console.log('服务端准备就绪,在端口:', PORT)
})

wss.on('close', () => {
  console.log('服务端安全关闭')
})

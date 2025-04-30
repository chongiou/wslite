import { WebSocketClient } from "../core/client"
import { PORT } from "./env.test"

const ws = new WebSocketClient(`http://localhost:${PORT}`)

ws.on('open', () => {
  console.log('opened')
  ws.send('hello from client')
})

ws.on('message', (message) => {
  console.log('服务端来信:', message)
})

ws.on('error', err => {
  console.error(err)
})


// const ws2 = new WebSocketClient(`http://localhost:${PORT}`)

// ws2.on('open', () => {
//   console.log('opened2')
//   ws.send('hello from client2')
// })

// ws2.on('message', (message) => {
//   console.log('服务端来信2:', message)
// })

// ws2.on('error', err => {
//   console.error(err)
// })

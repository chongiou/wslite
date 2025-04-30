import { PORT } from "./env.test"

setInterval(async () => {
  try {
    const resp = await fetch(`http://localhost:${PORT}/server-status`)
    const status = await resp.json()
    console.clear()
    console.log(status)
  } catch (err) {
    console.clear()
    console.error(err)
  }
}, 1000)

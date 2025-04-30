import { Device } from '../src/utils/device'
import { resolve } from 'path'
import { PORT } from '../src/test/env.test'

const src = resolve(process.argv[2])
const target = process.argv.at(-1)! // 远程设备路径(安卓设备路径)

if (!src || !target) {
  console.error('请提供源文件路径和目标文件路径')
  process.exit(1)
}

if (target[1] === ':') {
  console.error('目标路径请使用安卓设备路径')
  process.exit(1)
}

const device = new Device('localhost:16416')
device.reverse(PORT, PORT)
device.push(src, target)

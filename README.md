测试流程(测试zdjl):
1. 执行 npm run build:test && npm run push:test (构建客户端测试脚本和推送文件)
2. 执行 src/test/server.test.ts 启动服务端
3. 运行 testWebsocketClient.zjs 启动客户端

测试流程(测试nodejs):
1. 执行 src/test/server.test.ts 启动服务端
2. 执行 src/test/client.test.ts 启动客户端

# Binance WebSocket 实时行情调研

## 结论

本任务只接公共市场 WebSocket，不接账户流、不接 API Key、不做签名。第一版使用 Binance Spot combined stream 订阅多个币种的 24h ticker，并把推送写入 Zustand。BTCUSDT 的最新价格同步到当前 K 线最后一根 candle，形成实时变化效果。

## 官方资料

- Binance Spot WebSocket Streams：`https://github.com/binance/binance-spot-api-docs/blob/master/web-socket-streams.md`
- 组合流路径：`wss://stream.binance.com:9443/stream?streams=<stream1>/<stream2>`
- symbol 必须小写，例如 `btcusdt@ticker`
- 组合流消息格式：`{ "stream": "...", "data": <payload> }`
- 单币种 24h ticker stream：`<symbol>@ticker`
- 服务端连接约 24 小时会断开，生产环境必须支持重连。

## MVP 范围

- 订阅 BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT 的 `<symbol>@ticker`。
- 更新市场列表的价格、24h 涨跌幅、成交额。
- 更新数据源状态：连接中、已连接、断开、错误、最后事件时间。
- 页面提供开始/停止实时行情按钮。
- WebSocket 失败时不清空原数据。

## 暂不做

- 不做真实账户 User Data Stream。
- 不做 kline stream 的完整 candle 生命周期。
- 不做后端 WebSocket 网关。
- 不做策略自动触发，下一任务再把实时行情接到策略计算引擎。

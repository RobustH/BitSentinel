# Binance WebSocket 实时行情

## Goal

在 BitSentinel 前端原型中加入 Binance 公共 WebSocket 行情流，让市场监控页具备实时价格变化和连接状态展示。该任务基于已完成的 REST 公共行情接入继续扩展。

## Requirements

- 新增 Binance WebSocket 服务层，集中管理连接、消息解析、重连和关闭。
- 支持订阅 BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT 的 24h ticker stream。
- Store 增加实时行情连接状态。
- Store 增加启动/停止实时行情 action。
- WebSocket 推送到达后更新 `symbols` 中对应币种的价格、涨跌幅、成交量。
- BTCUSDT tick 到达后，更新当前 BTC K 线最后一根 candle 的 close/high/low。
- 市场监控页显示连接状态、最近推送时间、重连次数。
- 市场监控页提供“启动实时行情”和“停止实时行情”按钮。
- WebSocket 失败或断开时保留已有 REST/mock 数据，不清空页面。

## Acceptance Criteria

- [ ] 点击“启动实时行情”后，连接状态从连接中变为已连接或显示错误。
- [ ] WebSocket ticker 消息到达后，市场列表价格会更新。
- [ ] BTCUSDT ticker 消息到达后，K 线最后一根 candle 会随价格变化。
- [ ] 点击“停止实时行情”后，连接关闭，状态显示已停止。
- [ ] 失败时显示错误信息，不影响页面继续展示旧数据。
- [ ] 不包含 API Key、secret、签名请求或真实交易能力。
- [ ] TypeScript 检查和现有测试通过。

## Technical Approach

- 新增 `src/services/binanceWebSocket.ts`：
  - `startBinanceTickerStream(options)`：创建 combined stream 连接。
  - 解析 ticker payload，转换为统一 ticker update。
  - 自动重连，手动 stop 后不重连。
- 更新 `src/types.ts`：
  - `MarketStreamStatus`
  - `BinanceTickerUpdate`
- 更新 `src/store/appStore.ts`：
  - `marketStreamStatus`
  - `startBinanceMarketStream`
  - `stopBinanceMarketStream`
  - 收到 ticker 后更新 `symbols` 和 `marketSeries.BTCUSDT`
- 更新 `src/App.tsx`：
  - 市场监控页增加实时行情控制按钮和状态展示。
  - 数据仓页显示 WebSocket 连接状态。

## Decision (ADR-lite)

**Context**：BitSentinel 是监控系统，实时性比手动刷新更接近最终产品体验。

**Decision**：V1 在前端直接接 Binance 公共 WebSocket，作为原型验证。生产环境后续迁移到后端采集/推送网关。

**Consequences**：可以快速验证实时监控体验；但浏览器直连交易所仍受网络、地区和断线影响，不作为生产最终架构。

## Out of Scope

- 不做账户 WebSocket。
- 不做后端 WebSocket 网关。
- 不做策略自动计算触发。
- 不做真实交易。

## Research References

- [`research/binance-websocket-market-stream.md`](research/binance-websocket-market-stream.md)：Binance 公共 WebSocket stream 约定和 MVP 边界。

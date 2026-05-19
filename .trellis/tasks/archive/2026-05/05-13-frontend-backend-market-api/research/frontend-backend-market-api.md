# 前端接入后端行情 API 研究记录

## 本地规范依据

- `.trellis/spec/frontend/index.md`：后端接入前应先补 API client，不把请求散落到组件中。
- `.trellis/spec/frontend/state-management.md`：行情状态写入 Zustand，并维护 `marketDataStatus`。
- `.trellis/spec/guides/cross-layer-thinking-guide.md`：明确后端响应到前端状态的转换边界。

## 后端接口

已存在：

- `GET /api/market/symbols`
- `GET /api/market/tickers?symbols=BTCUSDT,ETHUSDT`
- `GET /api/market/klines?symbol=BTCUSDT&interval=1h&limit=5`
- `GET /api/market/funding-rate?symbol=BTCUSDT`
- `GET /api/market/open-interest?symbol=BTCUSDT`

本任务第一版只接 `tickers`，因为市场列表和监控中心最需要实时价格、涨跌幅、成交量。K 线和资金流图后续可单独任务接入。

## 设计

- 新增 `src/services/backendMarketApi.ts`。
- API client 只负责请求和响应解析，不直接改 Zustand。
- Store action 负责将后端 ticker 映射到现有 `MarketSymbol`。
- 失败时写入 `marketDataStatus.error`，不清空现有数据。

## 风险

- 后端服务未启动时请求失败，应优雅降级。
- 前端当前 `MarketDataStatus.source` 可能还没有 `backend`，需要扩展类型。

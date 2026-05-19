# Binance 公共行情 API 调研

## 结论

第一版应只接 Binance 公共行情数据，不在前端保存或使用 API Key。当前 BitSentinel 仍是前端原型，浏览器端可以读取公开行情，但私有账户、下单、签名请求必须等后端服务层完成后再做。

## 官方资料

- Binance Spot 官方文档仓库：`https://github.com/binance/binance-spot-api-docs`
- Spot REST 行情端点：`/api/v3/klines`、`/api/v3/ticker/24hr`、`/api/v3/ticker/price`
- Spot WebSocket 行情流：`wss://stream.binance.com:9443/ws/<streamName>` 或组合流 `/stream?streams=...`
- Binance WebSocket 文档说明：组合流使用 `stream` + `data` 包装，symbol 使用小写，连接最长约 24 小时后会断开，需要重连。
- USD-M Futures 公共资金流相关端点：
  - `/fapi/v1/premiumIndex`：标记价格和资金费率
  - `/futures/data/openInterestHist`：历史 OI
  - `/futures/data/takerlongshortRatio`：主动买卖量比例
  - `/futures/data/globalLongShortAccountRatio`：多空账户比例

## 对当前项目的约束

- 当前数据模型已有 `SymbolMarket`、`KlinePoint`、`MoneyFlowPoint`，可以先做字段映射，不需要改整体页面结构。
- 当前 `marketSeries` 是静态 mock 常量。第一版可把真实 K 线放入 Zustand 的 `marketSeries` state，组件改读 store，保留 mock 作为失败回退。
- 资金流页已有 funding、OI、taker buy、top long ratio 字段，可用 USD-M Futures 公共端点补齐。
- 因为没有后端，不能做 API Key、账户余额、真实交易、签名下单。

## MVP 建议

1. 新增 `src/services/binanceApi.ts`，集中封装公共 REST 请求和字段转换。
2. Store 增加 `marketSeries`、`marketDataStatus`、`refreshBinanceMarketData`。
3. 市场监控页和数据仓页显示当前数据源、更新时间、错误信息、手动刷新按钮。
4. 请求失败时保留 mock/旧数据，页面不空白。

## 后续扩展

- 第二步再加 WebSocket ticker/kline 订阅，并处理断线重连。
- 后端服务完成后，再加入私有账户、邮箱推送、模拟交易与真实交易隔离。

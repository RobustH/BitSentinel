# 币安 API 对接

## Goal

为 BitSentinel 前端原型接入 Binance 公共行情数据，让市场监控、K 线、数据仓能从真实行情刷新，同时保留 mock 数据兜底。此任务不做真实下单、不处理 API Key、不接账户资产。

## What I already know

- 项目是 Vite + React + TypeScript + Ant Design + Zustand。
- 当前市场数据、资金流、K 线来自 `src/mock/data.ts`。
- 当前 store 集中在 `src/store/appStore.ts`，页面大多在 `src/App.tsx`。
- 项目已有 `SymbolMarket`、`KlinePoint`、`MoneyFlowPoint` 类型。
- 产品 V1 只做监控和模拟交易，不做真实自动下单。

## Requirements

- 新增 Binance 公共行情 API client，集中封装在服务层，不把请求散落到组件里。
- 支持刷新 BTCUSDT、ETHUSDT、SOLUSDT、BNBUSDT 的 24h ticker。
- 支持刷新 BTCUSDT 的 K 线，用于现有 K 线图展示。
- 尝试刷新 USD-M Futures 公共资金流数据：资金费率、OI、主动买卖比、多空比。
- Store 增加市场数据状态：数据源、加载中、最近更新时间、错误信息。
- 市场监控页提供手动刷新入口，并显示当前是真实 Binance 数据还是 mock 回退。
- 数据仓页能看到 Binance 数据源状态和已采集数据类型。
- 网络失败时不能导致页面空白，应继续使用旧数据或 mock 数据。

## Acceptance Criteria

- [ ] 点击市场页刷新按钮后，会调用 store action 刷新 Binance 公共行情。
- [ ] 成功时，市场列表价格、涨跌幅、成交量和 BTC K 线会更新为接口返回数据。
- [ ] 失败时，页面保留原数据，并展示错误提示。
- [ ] 数据仓页展示行情数据源、K 线记录数、资金流记录数和最近更新时间。
- [ ] 代码中没有前端 API Key、secret、签名请求或真实交易调用。
- [ ] TypeScript 类型检查通过。

## Definition of Done

- 类型、服务层、store、页面展示完成。
- 不运行 build，按项目当前约束运行 TypeScript 检查。
- 如修改 store 行为，补充或更新 store 测试。
- 文档和 Trellis 任务记录同步。

## Technical Approach

- 新建 `src/services/binanceApi.ts`：
  - `fetchSpotTickers(symbols)`
  - `fetchSpotKlines(symbol, interval, limit)`
  - `fetchFuturesMoneyFlows(symbols, period)`
- `src/store/appStore.ts`：
  - 增加 `marketSeries` state，替代页面直接读 mock 常量。
  - 增加 `marketDataStatus`。
  - 增加 `refreshBinanceMarketData` action。
- `src/App.tsx`：
  - 市场页增加刷新按钮和数据源状态。
  - K 线组件读取 store 的 `marketSeries`。
  - 数据仓页展示真实数据状态。

## Decision (ADR-lite)

**Context**：BitSentinel 后续需要 24h 部署和真实监控，但当前仍是前端原型，没有后端密钥管理能力。

**Decision**：本任务只接 Binance 公共市场数据，私有 API 和真实交易留到后端阶段。

**Consequences**：可以快速验证真实行情驱动的监控界面；缺点是前端直接请求可能受网络、地区、CORS、限流影响，后续生产环境需要后端采集服务。

## Out of Scope

- 不做 Binance API Key 配置。
- 不做账户、余额、订单、真实下单。
- 不做 WebSocket 实时订阅。
- 不做后端数据库采集。

## Research References

- [`research/binance-public-market-api.md`](research/binance-public-market-api.md)：公共行情 API、资金流端点和前端接入边界。

## Technical Notes

- 当前部分中文文件在 PowerShell 输出中可能显示乱码，但源码按 UTF-8 处理。
- 真实 API 请求失败时必须回退，不影响用户继续查看原型。

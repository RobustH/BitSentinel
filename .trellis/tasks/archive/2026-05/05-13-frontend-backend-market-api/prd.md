# 前端接入后端行情 API

## 目标

让前端市场监控页优先从 Python 后端 `/api/market/*` 获取真实行情数据，替代前端直接访问 Binance 的主要路径。前端保留 mock 数据作为失败降级，页面不能因为后端异常变空白。

## 范围

- 新增前端后端行情 API client。
- 在 Zustand store 中新增后端行情刷新 action。
- 将后端 ticker 数据写入现有 `symbols`、`marketDataStatus` 和策略计算流程。
- 让市场监控页触发后端行情刷新。
- 页面显示数据来源为后端 API。

## 非目标

- 不删除现有 Binance 前端原型服务。
- 不接 WebSocket。
- 不做数据入库。
- 不重构 `App.tsx` 大结构。
- 不改后端 API。

## 数据流

```text
Binance -> Python FastAPI /api/market/tickers -> src/services/backendMarketApi.ts -> appStore.refreshBackendMarketData -> 页面展示
```

## 验收标准

- 后端运行时，前端可通过 store action 获取真实 ticker。
- 后端不可用时，保留当前 mock/旧数据并记录错误。
- `marketDataStatus.source` 能区分 `mock`、`binance`、`backend`。
- TypeScript 检查通过。
- 前端 store 测试覆盖成功和失败分支。

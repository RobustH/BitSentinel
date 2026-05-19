# 前端 K 线图接入后端 K 线 API

## 目标

让前端市场监控中的 K 线图可以从 Python 后端 `/api/market/klines` 获取真实 K 线数据，并支持基础周期切换。后端不可用时保留现有 K 线数据，不让图表空白。

## 范围

- 扩展 `src/services/backendMarketApi.ts`，新增 `fetchBackendMarketKlines(symbol, interval, limit)`。
- 扩展 Zustand store：
  - 新增 `refreshBackendKlines(symbol, interval)`。
  - 新增 K 线刷新状态，用于页面展示 loading/error/source/timeframe。
  - 刷新成功后写入 `marketSeries[symbol]`。
  - 刷新失败时保留旧数据。
- 市场监控页：
  - 点击/选择币种后可刷新该币种 K 线。
  - 增加周期选择：`15m / 1h / 4h / 1d`。
  - 图表仍使用现有 Lightweight Charts 组件。
- 增加 store 测试覆盖成功和失败分支。

## 非目标

- 不改后端 API。
- 不做 K 线入库。
- 不做指标计算。
- 不重构 `App.tsx`。
- 不执行 build。

## 数据流

```text
Binance -> Python FastAPI /api/market/klines -> backendMarketApi -> appStore.refreshBackendKlines -> marketSeries -> MiniKline
```

## 验收标准

- TypeScript 检查通过。
- 前端测试通过。
- 后端已运行时，可通过前端 action 获取并写入真实 K 线。
- 后端不可用时，旧 K 线保留，错误写入状态。

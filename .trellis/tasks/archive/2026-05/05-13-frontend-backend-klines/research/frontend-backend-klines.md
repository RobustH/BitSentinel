# 前端 K 线接入研究记录

## 现有状态

- 后端已提供 `GET /api/market/klines?symbol=BTCUSDT&interval=1h&limit=5`。
- 前端已有 `MiniKline` 图表组件，接收 `KlinePoint[]`。
- 前端已有 `marketSeries: Record<string, KlinePoint[]>`。
- 现有 `fetchSpotKlines` 仍直连 Binance，本任务新增后端 K 线入口，不删除旧入口。

## 后端响应字段

后端返回 snake_case：

- `symbol`
- `interval`
- `open_time`
- `open`
- `high`
- `low`
- `close`
- `volume`
- `close_time`
- `quote_volume`
- `trade_count`

前端图表需要：

- `time`
- `open`
- `high`
- `low`
- `close`

## 设计

- API client 负责把后端 K 线转换为 `KlinePoint`。
- Store action 负责写入 `marketSeries[symbol]`。
- 页面只调用 store action，不直接 fetch。
- 周期选择作为页面局部 state，不放入全局 store。

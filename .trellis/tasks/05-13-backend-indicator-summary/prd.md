# 后端指标计算服务原型

## 目标

在 Python 后端提供趋势交易最小指标摘要接口，让 EMA/MACD 趋势判断成为后端事实源。前端只展示后端返回的指标摘要，不在浏览器端计算生产指标。

## 范围

- 后端新增 `GET /api/indicators/summary?symbol=BTCUSDT&interval=1h`。
- 后端复用 Binance REST K 线服务获取 K 线。
- 后端计算：
  - EMA9
  - EMA21
  - EMA55
  - MACD DIF / DEA / Histogram
  - EMA 排列：`bullish` / `bearish` / `mixed`
  - MACD 信号：`bullish_cross` / `bearish_cross` / `bullish` / `bearish` / `neutral`
  - 趋势状态：`bullish` / `bearish` / `neutral`
  - 趋势评分：0-100
- 前端市场抽屉显示该币种、周期的指标摘要。
- 增加后端测试和前端 store 测试。

## 非目标

- 不做指标落库。
- 不做多周期聚合。
- 不做策略 Worker。
- 不引入 TA-Lib 或 pandas-ta。
- 不执行前端 build。

## 数据流

```text
Binance K线 -> Python 指标计算 -> /api/indicators/summary -> 前端 API client -> Zustand -> 市场抽屉展示
```

## 验收标准

- 后端 `ruff check .` 通过。
- 后端 `pytest` 通过。
- 前端 `tsc --noEmit` 通过。
- 前端 `npm test` 通过。
- 本地后端运行时，指标 summary 接口返回 200。

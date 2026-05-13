# 策略条件计算引擎原型调研

## 结论

当前项目已经具备策略实例、周期槽位、信号库、行情数据和监控状态。第一版策略计算引擎应做成前端纯函数服务层，不引入后端、不引入复杂技术指标库，先验证“行情 -> 条件命中 -> 状态机 -> 信号”的产品闭环。

## 当前代码约束

- 策略实例字段：
  - `slots`
  - `signalIdsBySlot`
  - `riskSignalIds`
  - `conditionIds`
- 监控状态粒度：`strategyInstanceId + symbol`
- 行情来源：
  - `symbols`
  - `marketSeries`
  - `moneyFlows`
- 信号触发已有 `triggerMockSignal`，但它是手动模拟，不是计算结果驱动。

## MVP 计算规则

- `ema-trend-up`：EMA9 > EMA21 且 EMA9 斜率向上。
- `ema-cross-up`：最近一根 K 线 EMA9 上穿 EMA21。
- `macd-expansion`：用 EMA12 - EMA26 的差值变化近似判断动量扩大。
- `oi-rising`：OI 变化大于 0。
- `taker-buy-dominant`：主动买入比例大于等于 55。
- `funding-not-hot`：资金费率小于等于 0.08。
- `trend-invalid`：EMA9 < EMA21。
- `structure-squeeze-end`：原型阶段用最近价格波动扩大近似。

## 输出模型

- 每个 `strategyInstanceId + symbol` 输出一条 `StrategyEvaluationResult`。
- 包含条件明细、命中率、下一步等待内容、建议状态、是否触发信号。
- UI 先展示结果，不做复杂解释引擎。

## 后续扩展

- 多周期真实 K 线缓存。
- 指标库模块化。
- 后端 Worker 周期计算。
- 回测与实时计算复用同一套 evaluator。

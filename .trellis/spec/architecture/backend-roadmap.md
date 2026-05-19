# Python 后端路线

## 后端 V1 目标

V1 后端不是一次性做完整量化平台，而是先打通最小闭环：

```text
Binance 数据采集 -> 指标计算 -> 策略状态机 -> 信号生成 -> 前端展示 -> 邮箱告警 -> 模拟交易记录
```

## 第一阶段：后端最小服务骨架

建议 Trellis 任务：

```text
用 Trellis 创建并实现 Python 后端最小服务骨架任务
```

范围：

- `backend/` FastAPI 项目
- `/api/health`
- `.env.example`
- PostgreSQL / TimescaleDB 连接配置
- Binance 公共 API 配置
- 目录预留：
  - `backend/app/api/`
  - `backend/app/core/`
  - `backend/app/models/`
  - `backend/app/services/market_data/`
  - `backend/app/services/indicators/`
  - `backend/app/services/strategy_engine/`
  - `backend/app/services/backtest/`
  - `backend/app/services/alerts/`
- Docker Compose：
  - backend
  - postgres
  - redis 可先预留

## 第二阶段：行情采集

范围：

- Binance REST 补历史 K 线。
- Binance WebSocket 采集实时 ticker/kline。
- 资金费率、OI、主动买卖比、大户多空比。
- 写入 PostgreSQL + TimescaleDB。
- 采集失败重试和断线重连。

## 第三阶段：指标计算服务

范围：

- EMA9 / EMA21 / EMA55
- MACD
- ATR
- KDJ
- 布林带可后置
- 指标结果落库或按需缓存

原则：

- 指标计算必须是后端事实源。
- 前端只能展示指标结果，不负责生产计算。

### 指标摘要 API 契约

#### 1. Scope / Trigger

- Trigger: 新增跨层接口 `GET /api/indicators/summary`，后端负责计算 EMA/MACD 趋势摘要，前端只消费结果。
- 适用范围：趋势监控抽屉、后续策略 Worker 复用同一指标事实源。

#### 2. Signatures

- HTTP: `GET /api/indicators/summary?symbol=BTCUSDT&interval=1h`
- Backend route: `backend/app/api/indicators.py`
- Indicator engine: `backend/app/services/indicators/engine.py`

#### 3. Contracts

- Request:
  - `symbol`: 交易对字符串，例如 `BTCUSDT`。
  - `interval`: Binance K 线周期字符串，例如 `1h`。
- Response:
  - `symbol`: 原请求交易对。
  - `interval`: 原请求周期。
  - `ema`: 包含 `ema9`、`ema21`、`ema55`。
  - `macd`: 包含 `dif`、`dea`、`histogram`。
  - `ema_alignment`: `bullish` / `bearish` / `mixed`。
  - `macd_signal`: `bullish_cross` / `bearish_cross` / `bullish` / `bearish` / `neutral`。
  - `trend`: `bullish` / `bearish` / `neutral`。
  - `score`: 0-100 趋势评分。
- Boundary: 前端不得重新计算生产 EMA/MACD；只能展示 API 返回字段。

#### 4. Validation & Error Matrix

| 条件 | 处理 |
|---|---|
| `symbol` 缺失 | FastAPI 参数校验返回 422 |
| `interval` 缺失 | FastAPI 参数校验返回 422 |
| Binance K 线服务失败 | API 返回服务层错误，不在前端静默伪造指标 |
| K 线数量不足以计算指标 | 后端应返回可解释错误或中性结果，不能让前端补算 |

#### 5. Good/Base/Bad Cases

- Good: 后端返回完整 EMA/MACD 和趋势摘要，前端抽屉直接渲染。
- Base: 指标信号为 `neutral` 时，前端展示中性状态，不推导额外趋势。
- Bad: 在 React 组件或 Zustand action 中重复实现 EMA/MACD 公式。

#### 6. Tests Required

- 后端 API 测试断言 `/api/indicators/summary` 返回 200 和完整字段。
- 后端指标引擎测试覆盖 EMA 排列、MACD 多空信号和趋势评分边界。
- 前端 store 测试断言 action 从后端 API client 获取并保存指标摘要。

#### 7. Wrong vs Correct

#### Wrong

```typescript
// React/Zustand 中临时计算生产指标
const trend = calculateMacdTrend(candles);
```

#### Correct

```typescript
// 前端只消费后端事实源
const summary = await backendMarketApi.getIndicatorSummary(symbol, interval);
```

## 第四阶段：策略 Worker

范围：

- 读取策略模板和策略实例。
- 按 `strategy_instance_id + symbol` 独立维护状态。
- 执行多周期条件链：
  - direction_tf
  - structure_tf
  - trigger_tf
  - confirm_conditions
  - invalidate_conditions
- 生成信号和状态变更事件。

## 第五阶段：回测与复盘

推荐先做轻量事件回放：

- 输入历史 K 线、资金流、策略实例。
- 按时间顺序回放。
- 输出：
  - 信号触发记录
  - 状态流转记录
  - 模拟交易记录
  - 胜率、MFE、MAE、最大回撤

后续再接：

- vectorbt：参数扫描和批量研究。
- backtrader：复杂订单和仓位模拟。

## 第六阶段：告警与模拟交易

范围：

- 邮箱告警优先。
- WebSocket/SSE 推送给前端。
- 信号触发后可生成模拟交易。
- 模拟交易记录开仓、平仓、盈亏、复盘结论。

## 当前前端原型如何迁移

| 前端原型能力 | 后端落地位置 |
|---|---|
| `binanceApi.ts` | `backend/app/services/market_data/binance_rest.py` |
| `binanceWebSocket.ts` | `backend/app/services/market_data/binance_ws.py` |
| `strategyEvaluator.ts` | `backend/app/services/strategy_engine/evaluator.py` |
| Zustand `strategyStates` | PostgreSQL `strategy_states` |
| Zustand `signals` | PostgreSQL `signals` |
| 前端模拟回测 | `backend/app/services/backtest/` |

## 技术判断

Python 后端更适合 BitSentinel 的核心能力。Node 保留在前端，不进入策略计算和回测主链路。
